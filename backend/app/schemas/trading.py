from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime

SignalAction = Literal["BUY", "SELL", "HOLD"]

class SignalResponse(BaseModel):
    symbol: str
    action: SignalAction
    confidence: int = Field(ge=0, le=100, description="Ensemble confidence 0-100, NOT probability of profit")
    price: float
    indicators: dict
    reasoning: str
    volatility: str
    trend: str
    timeframe: str = "1h"
    generated_at: datetime
    disclaimer: str = "AI confidence is not a guarantee of profit. Validate before trading."

class OrderCreate(BaseModel):
    symbol: str = Field(pattern=r"^[A-Z0-9]{5,20}$")
    side: Literal["BUY","SELL"]
    order_type: Literal["MARKET","LIMIT"] = "MARKET"
    quantity: Optional[float] = None
    quote_order_qty: Optional[float] = None  # USDT amount for market buy
    price: Optional[float] = None  # required for LIMIT
    stop_loss_pct: Optional[float] = Field(default=None, ge=0.1, le=20)
    take_profit_pct: Optional[float] = Field(default=None, ge=0.1, le=50)
    client_order_id: Optional[str] = None
    mode_override: Optional[Literal["paper","manual","live_auto"]] = None

class OrderResponse(BaseModel):
    id: str
    symbol: str
    side: str
    order_type: str
    quantity: float
    price: Optional[float]
    executed_price: Optional[float]
    status: str
    mode: str
    client_order_id: str
    binance_order_id: Optional[int]
    fee: float
    created_at: datetime
    class Config:
        from_attributes = True

class PnlResponse(BaseModel):
    realized_pnl: float
    unrealized_pnl: float
    total_fees: float
    total_trades: int
    win_rate: float
    daily_pnl: float

class TradingModeUpdate(BaseModel):
    mode: Literal["paper","manual","live_auto"]
    auto_trading_enabled: Optional[bool] = None
    confirm_live: bool = Field(default=False, description="Must be True to enable live_auto")
    disclaimer_accepted: bool = Field(default=False)

class TradingModeOut(BaseModel):
    mode: str
    auto_trading_enabled: bool
    emergency_stop: bool
    live_confirmed_at: Optional[datetime]
