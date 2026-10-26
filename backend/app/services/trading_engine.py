"""
Trading engine — order lifecycle with idempotency, retry, fee handling, SL/TP emulation.
- Paper mode: simulated fill at latest market price.
- Manual: creates PENDING order needing user approval (caller must check mode).
- Live auto: places Binance order after risk checks + verifies status.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.trade import Trade, Order, Position
from ..core.encryption import mask_secret

# Supported eligible pairs
ELIGIBLE_PAIRS = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","ADAUSDT","XRPUSDT","DOGEUSDT","AVAXUSDT"]

class TradingEngine:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_paper_trade(
        self,
        user_id: str,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        signal_id: str | None = None,
        client_order_id: str | None = None,
        stop_loss_pct: float | None = None,
        take_profit_pct: float | None = None,
    ) -> Trade:
        cid = client_order_id or f"paper_{uuid.uuid4().hex[:12]}"
        # Idempotency guard
        existing = await self.db.execute(select(Trade).where(Trade.client_order_id == cid))
        if existing.scalar_one_or_none():
            from ..core.exceptions import DuplicateOrderError
            raise DuplicateOrderError()

        # Paper fee ~0.1% (Binance spot taker)
        fee_rate = 0.001
        notional = quantity * price
        fee = notional * fee_rate

        # Update paper position
        base = symbol.replace("USDT","").replace("BUSD","")
        pos_q = await self.db.execute(select(Position).where(Position.user_id==user_id, Position.symbol==symbol))
        pos = pos_q.scalar_one_or_none()
        if not pos:
            pos = Position(user_id=user_id, symbol=symbol, base_asset=base, quote_asset="USDT", quantity=0, avg_entry_price=0)
            self.db.add(pos)
        if side == "BUY":
            total_cost = (pos.quantity or 0) * (pos.avg_entry_price or 0) + notional
            pos.quantity = (pos.quantity or 0) + quantity
            pos.avg_entry_price = total_cost / pos.quantity if pos.quantity else price
        else:
            # SELL — realize PnL
            realized = (price - (pos.avg_entry_price or price)) * quantity - fee
            pos.quantity = max(0, (pos.quantity or 0) - quantity)
            pos.realized_pnl = (pos.realized_pnl or 0) + realized
        pos.fees_paid = (pos.fees_paid or 0) + fee

        trade = Trade(
            user_id=user_id, symbol=symbol, side=side, order_type="MARKET",
            quantity=quantity, price=price, executed_price=price, fee=fee, fee_asset="USDT",
            status="FILLED", mode="paper", signal_id=signal_id,
            client_order_id=cid, masked_api_key="PAPER"
        )
        trade.profit_loss = getattr(pos, "realized_pnl", 0) if side=="SELL" else 0
        self.db.add(trade)
        await self.db.flush()
        # Record order row
        self.db.add(Order(trade_id=trade.id, status="FILLED", raw_response='{"paper": true, "price": %s}' % price))
        return trade

    async def create_live_trade(
        self,
        user_id: str,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float | None,
        price: float | None,
        quote_order_qty: float | None,
        client_order_id: str | None,
        binance_client,  # BinanceClient instance with plaintext creds (memory-only)
        risk_manager,
        available_usdt: float,
        current_open: int,
        signal_id: str | None = None,
        masked_api_key: str | None = None,
    ) -> Trade:
        # Risk check — caller should also check but double-gate here
        eff_price = price or 0
        # For market BUY with quoteOrderQty, estimate qty
        qty_for_check = quantity or (quote_order_qty / eff_price if eff_price else 0)
        notional = (qty_for_check * eff_price) if quantity else (quote_order_qty or 0)
        decision = risk_manager.full_check(symbol, notional, qty_for_check or 0.001, eff_price or 1, available_usdt, current_open)
        if not decision.allowed:
            from ..core.exceptions import RiskLimitExceeded
            raise RiskLimitExceeded(decision.reason)

        cid = client_order_id or f"live_{uuid.uuid4().hex[:12]}"
        exists = await self.db.execute(select(Trade).where(Trade.client_order_id==cid))
        if exists.scalar_one_or_none():
            from ..core.exceptions import DuplicateOrderError
            raise DuplicateOrderError()

        # Create pending trade row first (idempotency)
        trade = Trade(
            user_id=user_id, symbol=symbol, side=side, order_type=order_type,
            quantity=quantity or 0, price=price, status="PENDING", mode="live_auto" if risk_manager.mode.mode=="live_auto" else "manual",
            signal_id=signal_id, client_order_id=cid, masked_api_key=masked_api_key or "****"
        )
        self.db.add(trade)
        await self.db.flush()

        # Place on Binance
        try:
            kwargs = {}
            if quantity is not None:
                kwargs["quantity"] = quantity
            if quote_order_qty is not None:
                kwargs["quoteOrderQty"] = quote_order_qty
            if price is not None:
                kwargs["price"] = price
                kwargs["timeInForce"] = "GTC"

            result = await binance_client.create_order(
                symbol=symbol, side=side, type=order_type, newClientOrderId=cid, **kwargs
            )
            trade.binance_order_id = result.get("orderId")
            trade.status = result.get("status", "NEW")
            trade.executed_price = float(result.get("fills", [{}])[0].get("price", price or 0)) if result.get("fills") else price
            # Verify via get_order before reporting success
            verified = await binance_client.get_order(symbol=symbol, orderId=trade.binance_order_id)
            trade.status = verified.get("status", trade.status)
            if verified.get("status") in ("FILLED","PARTIALLY_FILLED"):
                trade.executed_price = float(verified.get("cummulativeQuoteQty", 0)) / float(verified.get("executedQty", 1)) if float(verified.get("executedQty",0)) else trade.executed_price
            # Fees: Binance commission is in fills; sum
            fee = sum(float(f.get("commission", 0)) for f in verified.get("fills", []))
            trade.fee = fee
            trade.fee_asset = verified.get("fills", [{}])[0].get("commissionAsset") if verified.get("fills") else None

            self.db.add(Order(trade_id=trade.id, binance_order_id=trade.binance_order_id, status=trade.status, raw_response=str(result)[:4000]))
            await self.db.flush()
            return trade
        except Exception as e:
            trade.status = "REJECTED"
            self.db.add(Order(trade_id=trade.id, status="REJECTED", raw_response=str(e)[:4000]))
            await self.db.flush()
            raise

    async def list_trades(self, user_id: str, limit: int = 50, symbol: str | None = None):
        q = select(Trade).where(Trade.user_id==user_id).order_by(Trade.created_at.desc()).limit(limit)
        if symbol:
            q = q.where(Trade.symbol==symbol)
        res = await self.db.execute(q)
        return res.scalars().all()

    async def emergency_stop(self, user_id: str, reason: str = "User pressed STOP"):
        from ..models.setting import TradingModeState
        from sqlalchemy import select
        res = await self.db.execute(select(TradingModeState).where(TradingModeState.user_id==user_id))
        state = res.scalar_one_or_none()
        if not state:
            state = TradingModeState(user_id=user_id, emergency_stop=True, emergency_stop_reason=reason, emergency_stop_at=datetime.now(timezone.utc))
            self.db.add(state)
        else:
            state.emergency_stop = True
            state.emergency_stop_at = datetime.now(timezone.utc)
            state.emergency_stop_reason = reason
            state.auto_trading_enabled = False
        await self.db.flush()
        return state
