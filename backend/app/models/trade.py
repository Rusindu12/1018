from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import String, Float, DateTime, Boolean, Integer, ForeignKey, func, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base
import enum

class OrderSide(str, enum.Enum):
    BUY = "BUY"; SELL = "SELL"
class OrderType(str, enum.Enum):
    MARKET = "MARKET"; LIMIT = "LIMIT"; STOP_LOSS = "STOP_LOSS"; TAKE_PROFIT = "TAKE_PROFIT"
class OrderStatus(str, enum.Enum):
    NEW = "NEW"; PARTIALLY_FILLED="PARTIALLY_FILLED"; FILLED="FILLED"; CANCELED="CANCELED"; REJECTED="REJECTED"; EXPIRED="EXPIRED"; PENDING="PENDING"

class Trade(Base):
    __tablename__ = "trades"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)  # e.g. BTCUSDT
    side: Mapped[str] = mapped_column(String(10))
    order_type: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[float] = mapped_column(Float)
    price: Mapped[float | None] = mapped_column(Float, nullable=True)  # limit price
    executed_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    fee: Mapped[float] = mapped_column(Float, default=0.0)
    fee_asset: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=OrderStatus.PENDING.value)
    mode: Mapped[str] = mapped_column(String(20), default="paper")  # paper|manual|live_auto
    signal_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    client_order_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    binance_order_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    profit_loss: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    # For audit: never store raw secrets; store masked key
    masked_api_key: Mapped[str | None] = mapped_column(String(20), nullable=True)

class Order(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trade_id: Mapped[str] = mapped_column(String(36), ForeignKey("trades.id", ondelete="CASCADE"))
    binance_order_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20))
    raw_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

class Position(Base):
    """Paper-trading position tracker (live positions derived from Binance balances)."""
    __tablename__ = "positions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    base_asset: Mapped[str] = mapped_column(String(20))
    quote_asset: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[float] = mapped_column(Float, default=0)
    avg_entry_price: Mapped[float] = mapped_column(Float, default=0)
    unrealized_pnl: Mapped[float] = mapped_column(Float, default=0)
    realized_pnl: Mapped[float] = mapped_column(Float, default=0)
    fees_paid: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
