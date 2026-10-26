from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone

from ..core.database import get_db
from ..core.security import get_current_user_id
from ..core.encryption import decrypt_secret, mask_secret
from ..core.config import get_settings
from ..models.api_credential import ApiCredential
from ..models.setting import RiskSetting, TradingModeState
from ..models.trade import Trade, Position
from ..schemas.trading import OrderCreate, OrderResponse, PnlResponse, TradingModeUpdate, TradingModeOut
from ..services.binance_client import BinanceClient
from ..services.market_data import get_klines_normalized, get_exchange_filters
from ..services.risk_manager import RiskManager
from ..services.trading_engine import TradingEngine

router = APIRouter()

async def _get_or_create_state(db: AsyncSession, user_id: str):
    settings = get_settings()
    # Risk
    res = await db.execute(select(RiskSetting).where(RiskSetting.user_id==user_id))
    risk = res.scalar_one_or_none()
    if not risk:
        risk = RiskSetting(
            user_id=user_id,
            max_trade_amount_usdt=settings.default_max_trade_usdt,
            daily_loss_limit_usdt=settings.default_daily_loss_limit_usdt,
            max_open_positions=settings.default_max_open_positions,
            cooldown_minutes=settings.default_cooldown_minutes,
        )
        db.add(risk)
        await db.flush()
    # Mode
    res = await db.execute(select(TradingModeState).where(TradingModeState.user_id==user_id))
    mode = res.scalar_one_or_none()
    if not mode:
        mode = TradingModeState(user_id=user_id, mode=settings.default_trading_mode, auto_trading_enabled=False)
        db.add(mode)
        await db.flush()
    return risk, mode

@router.get("/mode", response_model=TradingModeOut)
async def get_mode(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    _, mode = await _get_or_create_state(db, user_id)
    return TradingModeOut(mode=mode.mode, auto_trading_enabled=mode.auto_trading_enabled, emergency_stop=mode.emergency_stop, live_confirmed_at=mode.live_confirmed_at)

@router.put("/mode", response_model=TradingModeOut)
async def update_mode(payload: TradingModeUpdate, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    _, mode = await _get_or_create_state(db, user_id)
    if payload.mode == "live_auto":
        if not payload.confirm_live or not payload.disclaimer_accepted:
            raise HTTPException(status_code=403, detail="Live Auto Trading requires explicit confirmation: check 'confirm_live' and 'disclaimer_accepted' with risk disclosure.")
        # Ensure credential has trading permission
        res = await db.execute(select(ApiCredential).where(ApiCredential.user_id==user_id, ApiCredential.is_active==True))
        cred = res.scalars().first()
        if not cred or not cred.can_trade:
            raise HTTPException(status_code=422, detail="Verify Binance connection first (Test Connection must show can_trade=true).")
        mode.live_confirmed_at = datetime.now(timezone.utc)
        mode.auto_trading_enabled = True if payload.auto_trading_enabled is not False else False
        mode.emergency_stop = False
    else:
        if payload.auto_trading_enabled is not None:
            mode.auto_trading_enabled = payload.auto_trading_enabled
        # manual/paper don't need live confirmation
        mode.auto_trading_enabled = payload.auto_trading_enabled if payload.auto_trading_enabled is not None else mode.auto_trading_enabled

    mode.mode = payload.mode
    await db.flush()
    return TradingModeOut(mode=mode.mode, auto_trading_enabled=mode.auto_trading_enabled, emergency_stop=mode.emergency_stop, live_confirmed_at=mode.live_confirmed_at)

@router.post("/emergency-stop")
async def emergency_stop(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    engine = TradingEngine(db)
    state = await engine.emergency_stop(user_id, reason="User pressed EMERGENCY STOP")
    return {"emergency_stop": state.emergency_stop, "at": state.emergency_stop_at, "message": "All new auto orders halted. Disable STOP to resume."}

@router.post("/emergency-stop/clear")
async def clear_stop(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    _, mode = await _get_or_create_state(db, user_id)
    mode.emergency_stop = False; mode.emergency_stop_at = None; mode.emergency_stop_reason = None
    await db.flush()
    return {"emergency_stop": False, "message": "Emergency STOP cleared. Auto trading may resume if enabled."}

@router.post("/orders", response_model=OrderResponse)
async def create_order(payload: OrderCreate, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    risk_setting, mode_state = await _get_or_create_state(db, user_id)
    effective_mode = payload.mode_override or mode_state.mode
    engine = TradingEngine(db)

    # Trading mode guard
    if effective_mode == "live_auto" and not mode_state.auto_trading_enabled:
        raise HTTPException(status_code=403, detail="Auto trading is OFF. Enable Auto Trading ON/OFF toggle first.")
    if mode_state.emergency_stop and effective_mode == "live_auto":
        raise HTTPException(status_code=422, detail="Emergency STOP active — cannot place auto orders.")

    # Resolve price for checks
    price = payload.price
    if payload.order_type == "MARKET" and not price:
        # Fetch latest price for paper/risk checks
        try:
            klines = await get_klines_normalized(payload.symbol, "1m", 5)
            price = klines[-1]["close"]
        except Exception:
            price = 0

    # Manual mode requires explicit user approval flag — here we treat the POST as approval
    # Paper path (default, no Binance creds needed)
    if effective_mode == "paper":
        quantity = payload.quantity or (payload.quote_order_qty / price if price and payload.quote_order_qty else 0)
        if quantity <= 0:
            raise HTTPException(status_code=422, detail="Quantity or quoteOrderQty required")
        trade = await engine.create_paper_trade(
            user_id=user_id, symbol=payload.symbol, side=payload.side,
            quantity=quantity, price=price, client_order_id=payload.client_order_id,
            stop_loss_pct=payload.stop_loss_pct, take_profit_pct=payload.take_profit_pct
        )
        return OrderResponse(
            id=trade.id, symbol=trade.symbol, side=trade.side, order_type=trade.order_type,
            quantity=trade.quantity, price=trade.price, executed_price=trade.executed_price,
            status=trade.status, mode=trade.mode, client_order_id=trade.client_order_id,
            binance_order_id=trade.binance_order_id, fee=trade.fee, created_at=trade.created_at
        )

    # Live path — need Binance creds
    res = await db.execute(select(ApiCredential).where(ApiCredential.user_id==user_id, ApiCredential.is_active==True))
    cred = res.scalars().first()
    if not cred:
        raise HTTPException(status_code=404, detail="No Binance credentials. Add API key/secret in Settings → Binance API.")
    api_key = decrypt_secret(cred.encrypted_api_key); api_secret = decrypt_secret(cred.encrypted_api_secret)
    client = BinanceClient(api_key=api_key, api_secret=api_secret, is_testnet=cred.is_testnet)

    # Gather context for risk
    filters = await get_exchange_filters(payload.symbol)
    # Avail USDT
    try:
        info = await client.account_info()
        avail_usdt = 0
        for b in info.get("balances", []):
            if b["asset"] == "USDT":
                avail_usdt = float(b["free"]); break
    except Exception:
        avail_usdt = 0
    # Count open positions
    open_count_res = await db.execute(select(func.count(Trade.id)).where(Trade.user_id==user_id, Trade.status.in_(["NEW","PARTIALLY_FILLED","PENDING"])))
    open_count = open_count_res.scalar() or 0

    risk_mgr = RiskManager(risk_setting, mode_state, balances={}, exchange_filters=filters)
    # For live order, need quantity or quoteOrderQty
    try:
        trade = await engine.create_live_trade(
            user_id=user_id, symbol=payload.symbol, side=payload.side, order_type=payload.order_type,
            quantity=payload.quantity, price=payload.price, quote_order_qty=payload.quote_order_qty,
            client_order_id=payload.client_order_id, binance_client=client,
            risk_manager=risk_mgr, available_usdt=avail_usdt, current_open=open_count,
            masked_api_key=mask_secret(api_key)
        )
        return OrderResponse(
            id=trade.id, symbol=trade.symbol, side=trade.side, order_type=trade.order_type,
            quantity=trade.quantity, price=trade.price, executed_price=trade.executed_price,
            status=trade.status, mode=trade.mode, client_order_id=trade.client_order_id,
            binance_order_id=trade.binance_order_id, fee=trade.fee, created_at=trade.created_at
        )
    finally:
        await client.close()

@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(symbol: str | None = None, limit: int = 50, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    engine = TradingEngine(db)
    trades = await engine.list_trades(user_id, limit=limit, symbol=symbol)
    return [
        OrderResponse(
            id=t.id, symbol=t.symbol, side=t.side, order_type=t.order_type,
            quantity=t.quantity, price=t.price, executed_price=t.executed_price,
            status=t.status, mode=t.mode, client_order_id=t.client_order_id,
            binance_order_id=t.binance_order_id, fee=t.fee, created_at=t.created_at
        ) for t in trades
    ]

@router.get("/pnl", response_model=PnlResponse)
async def get_pnl(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    # Aggregate from trades + positions
    trades_res = await db.execute(select(Trade).where(Trade.user_id==user_id))
    trades = trades_res.scalars().all()
    realized = sum(t.profit_loss or 0 for t in trades)
    fees = sum(t.fee for t in trades)
    pos_res = await db.execute(select(Position).where(Position.user_id==user_id))
    positions = pos_res.scalars().all()
    unrealized = sum(p.unrealized_pnl for p in positions)
    pos_realized = sum(p.realized_pnl for p in positions)
    total_realized = realized + pos_realized
    # daily PnL from today's trades
    from datetime import timedelta
    today_trades = [t for t in trades if t.created_at and (datetime.now(timezone.utc) - (t.created_at.replace(tzinfo=timezone.utc) if t.created_at.tzinfo is None else t.created_at)).days == 0]
    daily = sum(t.profit_loss or 0 for t in today_trades)
    wins = len([t for t in trades if (t.profit_loss or 0) > 0])
    win_rate = wins / len(trades) if trades else 0
    return PnlResponse(realized_pnl=round(total_realized,2), unrealized_pnl=round(unrealized,2), total_fees=round(fees,2), total_trades=len(trades), win_rate=round(win_rate,3), daily_pnl=round(daily,2))
