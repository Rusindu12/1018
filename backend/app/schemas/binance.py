from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class BinanceCredentialCreate(BaseModel):
    api_key: str = Field(min_length=16, max_length=128, description="Binance API Key (trading permission only)")
    api_secret: str = Field(min_length=16, max_length=128, description="Binance API Secret — never logged")
    label: str = Field(default="default", max_length=100)
    is_testnet: bool = True

class BinanceCredentialOut(BaseModel):
    id: str
    label: str
    is_testnet: bool
    is_active: bool
    masked_api_key: str
    can_trade: Optional[bool] = None
    can_read: Optional[bool] = None
    last_verified_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class ConnectionTestResult(BaseModel):
    success: bool
    can_read: bool
    can_trade: bool
    has_withdraw_permission: bool  # must be False to pass
    balances: Optional[List[dict]] = None
    message: str
    account_type: Optional[str] = None
    permissions: Optional[List[str]] = None

class BalanceAsset(BaseModel):
    asset: str
    free: float
    locked: float
    total: float
    usdt_value: Optional[float] = None

class BalanceResponse(BaseModel):
    balances: List[BalanceAsset]
    total_usdt: float
    available_usdt: float
    source: str  # binance | paper
