from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..core.database import get_db
from ..core.security import get_current_user_id
from ..models.setting import RiskSetting
from ..schemas.risk import RiskSettingCreate, RiskSettingOut

router = APIRouter()

@router.get("/settings", response_model=RiskSettingOut)
async def get_risk(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    from .trading import _get_or_create_state
    risk, _ = await _get_or_create_state(db, user_id)
    return RiskSettingOut(
        id=risk.id, max_trade_amount_usdt=risk.max_trade_amount_usdt,
        daily_loss_limit_usdt=risk.daily_loss_limit_usdt, max_open_positions=risk.max_open_positions,
        cooldown_minutes=risk.cooldown_minutes, stop_loss_pct=risk.stop_loss_pct,
        take_profit_pct=risk.take_profit_pct, trailing_stop_pct=risk.trailing_stop_pct,
        allowed_symbols=risk.allowed_symbols, daily_loss_accum=risk.daily_loss_accum,
        consecutive_losses=risk.consecutive_losses
    )

@router.put("/settings", response_model=RiskSettingOut)
async def update_risk(payload: RiskSettingCreate, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    from .trading import _get_or_create_state
    risk, _ = await _get_or_create_state(db, user_id)
    # Validation: daily loss should not be >> max trade * 10 (basic sanity)
    if payload.daily_loss_limit_usdt < payload.max_trade_amount_usdt * 0.25:
        raise HTTPException(status_code=422, detail="Daily loss limit too low vs max trade — increase daily limit or reduce max trade.")
    for field in ["max_trade_amount_usdt","daily_loss_limit_usdt","max_open_positions","cooldown_minutes","stop_loss_pct","take_profit_pct","trailing_stop_pct","allowed_symbols"]:
        setattr(risk, field, getattr(payload, field))
    await db.flush()
    return RiskSettingOut(
        id=risk.id, max_trade_amount_usdt=risk.max_trade_amount_usdt,
        daily_loss_limit_usdt=risk.daily_loss_limit_usdt, max_open_positions=risk.max_open_positions,
        cooldown_minutes=risk.cooldown_minutes, stop_loss_pct=risk.stop_loss_pct,
        take_profit_pct=risk.take_profit_pct, trailing_stop_pct=risk.trailing_stop_pct,
        allowed_symbols=risk.allowed_symbols, daily_loss_accum=risk.daily_loss_accum,
        consecutive_losses=risk.consecutive_losses
    )
