from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import get_db
from ..core.config import get_settings
from ..core.security import get_current_user_id

router = APIRouter()
settings = get_settings()

@router.get("/config")
async def public_config(user_id: str = Depends(get_current_user_id)):
    # Non-sensitive public config
    return {
        "app_name": settings.app_name,
        "binance_testnet": settings.binance_testnet,
        "eligible_pairs": ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","ADAUSDT","XRPUSDT","DOGEUSDT","AVAXUSDT"],
        "paper_initial_balance": settings.paper_initial_balance_usdt,
        "indicators": ["RSI","MACD","EMA","SMA","Bollinger","ATR","Volume"],
        "risk_disclosure": "Cryptocurrency trading can result in the loss of capital. Never invest more than you can afford to lose.",
        "disclaimer": "Not financial advice. AI signals are assistive only."
    }

@router.get("/notifications")
async def notifications(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    # Simple mock — in production, fetch from notifications table / FCM
    from sqlalchemy import select
    from ..models.trade import Trade
    res = await db.execute(select(Trade).where(Trade.user_id==user_id).order_by(Trade.created_at.desc()).limit(20))
    trades = res.scalars().all()
    notifs = []
    for t in trades:
        notifs.append({"type":"order","title": f"{t.side} {t.symbol} {t.status}", "detail": f"{t.quantity} @ {t.executed_price or t.price} — fee {t.fee}", "at": t.created_at.isoformat() if t.created_at else None})
    # Add risk events if any
    from ..models.setting import RiskSetting
    r = await db.execute(select(RiskSetting).where(RiskSetting.user_id==user_id))
    risk = r.scalar_one_or_none()
    if risk and risk.daily_loss_accum >= risk.daily_loss_limit_usdt:
        notifs.append({"type":"risk","title":"Daily loss limit reached","detail": f"{risk.daily_loss_accum}/{risk.daily_loss_limit_usdt} USDT","severity":"critical"})
    return {"notifications": notifs}
