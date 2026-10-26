from pydantic import BaseModel, Field
from typing import Optional

class RiskSettingCreate(BaseModel):
    max_trade_amount_usdt: float = Field(ge=5, le=100000)
    daily_loss_limit_usdt: float = Field(ge=5, le=100000)
    max_open_positions: int = Field(ge=1, le=20)
    cooldown_minutes: int = Field(ge=0, le=1440)
    stop_loss_pct: float = Field(ge=0.1, le=20)
    take_profit_pct: float = Field(ge=0.1, le=50)
    trailing_stop_pct: Optional[float] = Field(default=None, ge=0.1, le=20)
    allowed_symbols: str = Field(default="BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT")

class RiskSettingOut(RiskSettingCreate):
    id: str
    daily_loss_accum: float
    consecutive_losses: int
    class Config:
        from_attributes = True
