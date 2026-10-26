from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from ..core.database import Base

class RiskSetting(Base):
    __tablename__ = "risk_settings"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    max_trade_amount_usdt: Mapped[float] = mapped_column(Float, default=100.0)
    daily_loss_limit_usdt: Mapped[float] = mapped_column(Float, default=50.0)
    max_open_positions: Mapped[int] = mapped_column(Integer, default=3)
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=15)
    stop_loss_pct: Mapped[float] = mapped_column(Float, default=2.0)  # %
    take_profit_pct: Mapped[float] = mapped_column(Float, default=4.0)
    trailing_stop_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    allowed_symbols: Mapped[str] = mapped_column(String(500), default="BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT")
    daily_loss_accum: Mapped[float] = mapped_column(Float, default=0.0)
    consecutive_losses: Mapped[int] = mapped_column(Integer, default=0)
    last_loss_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class TradingModeState(Base):
    __tablename__ = "trading_mode_state"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    mode: Mapped[str] = mapped_column(String(20), default="paper")  # paper|manual|live_auto
    auto_trading_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    emergency_stop: Mapped[bool] = mapped_column(Boolean, default=False)
    emergency_stop_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    emergency_stop_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    live_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
