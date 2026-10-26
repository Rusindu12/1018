"""Central configuration via pydantic-settings. All secrets from env, never hardcoded."""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = Field(default="AI Binance Trader")
    app_env: str = Field(default="development")
    debug: bool = False
    log_level: str = "INFO"

    host: str = "0.0.0.0"
    port: int = 8000
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    # Security
    encryption_key: str = Field(..., description="Fernet 44-char base64 key")
    jwt_secret: str = Field(...)
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    database_url: str = "sqlite:///./ai_binance_trader.db"
    redis_url: str = "redis://localhost:6379/0"

    binance_api_base: str = "https://api.binance.com"
    binance_testnet: bool = True
    binance_testnet_base: str = "https://testnet.binance.vision"
    binance_ws_base: str = "wss://stream.binance.com:9443"
    binance_ws_testnet_base: str = "wss://testnet.binance.vision"

    default_max_trade_usdt: float = 100.0
    default_daily_loss_limit_usdt: float = 50.0
    default_max_open_positions: int = 3
    default_cooldown_minutes: int = 15
    default_trading_mode: str = "paper"
    paper_initial_balance_usdt: float = 10000.0

    ws_heartbeat_seconds: int = 30
    enable_live_trading: bool = False
    require_live_confirmation: bool = True
    rate_limit_per_minute: int = 60
    binance_recv_window: int = 5000

    sentry_dsn: str = ""

    @field_validator("cors_origins")
    @classmethod
    def _noop(cls, v):  # keep as string, split in main.py
        return v

    @property
    def binance_base_url(self) -> str:
        return self.binance_testnet_base if self.binance_testnet else self.binance_api_base

    @property
    def binance_ws_url(self) -> str:
        return self.binance_ws_testnet_base if self.binance_testnet else self.binance_ws_base

    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
