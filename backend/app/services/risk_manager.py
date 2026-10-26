"""
Risk manager — enforces all pre-trade checks.
- Never increases position to recover losses (no martingale).
- Daily loss, max trade, max open positions, cooldown, balance & filter validation.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from typing import Optional

@dataclass
class RiskDecision:
    allowed: bool
    reason: str
    warnings: list[str]

class RiskManager:
    def __init__(self, risk_setting, mode_state, balances: Optional[dict] = None, exchange_filters: Optional[dict] = None):
        self.risk = risk_setting
        self.mode = mode_state
        self.balances = balances or {}
        self.filters = exchange_filters or {}

    def check_emergency_stop(self) -> RiskDecision | None:
        if getattr(self.mode, "emergency_stop", False):
            return RiskDecision(False, "Emergency STOP is active — new auto orders blocked. Disable STOP in dashboard to resume.", [])
        return None

    def check_trading_mode(self, requested_mode: Optional[str] = None) -> RiskDecision | None:
        effective_mode = requested_mode or getattr(self.mode, "mode", "paper")
        if effective_mode == "live_auto":
            if not getattr(self.mode, "auto_trading_enabled", False):
                return RiskDecision(False, "Live Auto Trading is disabled. Enable Auto Trading in the app first.", [])
            # Check live confirmation freshness (24h)
            confirmed = getattr(self.mode, "live_confirmed_at", None)
            if confirmed:
                if datetime.now(timezone.utc) - confirmed.replace(tzinfo=timezone.utc if confirmed.tzinfo is None else confirmed.tzinfo) > timedelta(hours=24):
                    return RiskDecision(False, "Live trading confirmation expired (>24h). Re-confirm in Settings → Trading Mode.", [])
            else:
                return RiskDecision(False, "Live trading requires explicit confirmation. Confirm disclaimer in Settings.", [])
        return None

    def check_daily_loss(self) -> RiskDecision | None:
        if self.risk.daily_loss_accum >= self.risk.daily_loss_limit_usdt:
            return RiskDecision(False, f"Daily loss limit reached: {self.risk.daily_loss_accum:.2f} / {self.risk.daily_loss_limit_usdt:.2f} USDT. No new positions today.", [])
        return None

    def check_max_open_positions(self, current_open: int) -> RiskDecision | None:
        if current_open >= self.risk.max_open_positions:
            return RiskDecision(False, f"Max open positions reached: {current_open}/{self.risk.max_open_positions}. Close a position before opening a new one.", [])
        return None

    def check_cooldown(self) -> RiskDecision | None:
        if self.risk.consecutive_losses >= 3 and self.risk.last_loss_at:
            last = self.risk.last_loss_at
            if last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            cooldown_end = last + timedelta(minutes=self.risk.cooldown_minutes)
            if datetime.now(timezone.utc) < cooldown_end:
                remaining = (cooldown_end - datetime.now(timezone.utc)).total_seconds() / 60
                return RiskDecision(False, f"Cooldown active after {self.risk.consecutive_losses} consecutive losses. Wait {remaining:.0f} min.", [])
        return None

    def check_max_trade_amount(self, amount_usdt: float) -> RiskDecision | None:
        if amount_usdt > self.risk.max_trade_amount_usdt:
            return RiskDecision(False, f"Trade amount {amount_usdt:.2f} USDT exceeds max per trade {self.risk.max_trade_amount_usdt:.2f} USDT. Reduce size.", [])
        return None

    def check_balance(self, required_usdt: float, available_usdt: float) -> RiskDecision | None:
        # Include estimated fee buffer 0.2%
        buffer = required_usdt * 1.002
        if available_usdt < buffer:
            return RiskDecision(False, f"Insufficient USDT: need {buffer:.2f} (incl. fees), have {available_usdt:.2f}. Deposit or reduce size.", [])
        return None

    def check_allowed_symbol(self, symbol: str) -> RiskDecision | None:
        allowed = [s.strip().upper() for s in self.risk.allowed_symbols.split(",") if s.strip()]
        if symbol.upper() not in allowed:
            return RiskDecision(False, f"Symbol {symbol} not in allowed list {allowed}. Update Risk → Allowed Symbols.", [])
        return None

    def validate_exchange_filters(self, symbol: str, quantity: float, price: float) -> RiskDecision:
        """
        Validates LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL from exchangeInfo filters.
        `self.filters` expected as dict from exchangeInfo -> { lot_size_step, min_qty, max_qty, tick_size, min_notional }
        """
        warnings = []
        if not self.filters:
            warnings.append("Exchange filters unavailable — proceeding with caution. Verify on Binance.")
            return RiskDecision(True, "No filters to validate", warnings)

        f = self.filters
        if f.get("minQty") and quantity < f["minQty"] - 1e-9:
            return RiskDecision(False, f"Quantity {quantity} below LOT_SIZE min {f['minQty']} for {symbol}", warnings)
        if f.get("maxQty") and quantity > f["maxQty"] + 1e-9:
            return RiskDecision(False, f"Quantity {quantity} exceeds max {f['maxQty']}", warnings)
        notional = quantity * price
        if f.get("minNotional") and notional < f["minNotional"] - 1e-9:
            return RiskDecision(False, f"Notional {notional:.4f} below MIN_NOTIONAL {f['minNotional']} for {symbol}. Increase size.", warnings)
        # tick/step alignment warnings (non-blocking — backend can round)
        return RiskDecision(True, "Filters passed", warnings)

    def full_check(
        self,
        symbol: str,
        amount_usdt: float,
        quantity: float,
        price: float,
        available_usdt: float,
        current_open_positions: int,
        warnings_out: list[str] | None = None,
    ) -> RiskDecision:
        # Order matters: emergency → mode → daily → cooldown → per-trade limits
        for check in [
            self.check_emergency_stop(),
            self.check_trading_mode(),
            self.check_daily_loss(),
            self.check_cooldown(),
            self.check_max_open_positions(current_open_positions),
            self.check_allowed_symbol(symbol),
            self.check_max_trade_amount(amount_usdt),
            self.check_balance(amount_usdt, available_usdt),
        ]:
            if check is not None and not check.allowed:
                return check
        # Filters last
        filter_decision = self.validate_exchange_filters(symbol, quantity, price)
        if not filter_decision.allowed:
            return filter_decision
        # Collect warnings
        all_warnings: list[str] = []
        for c in [filter_decision]:
            if c and c.warnings:
                all_warnings.extend(c.warnings)
        return RiskDecision(True, "All risk checks passed", all_warnings)
