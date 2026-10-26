# Trading Logic & AI Signals — AI Binance Trader

## Supported Pairs
BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT + eligible extras: ADAUSDT, XRPUSDT, DOGEUSDT, AVAXUSDT (configurable via `allowed_symbols`).

## Indicators (all computed on klines, 150-candle window)
| Indicator | Params | Purpose |
|-----------|--------|---------|
| RSI | 14 | Overbought (>70) / oversold (<30) |
| MACD | 12,26,9 | Momentum + histogram divergence |
| EMA | 20,50,200 | Trend regime |
| SMA | 20,50 | Mean reversion |
| Bollinger Bands | 20, 2σ | Volatility & extremes |
| ATR | 14 | Volatility % of price |
| Volume SMA | 20 | Confirmation (ratio) |

See `backend/app/services/indicators.py` for formulas (Wilder RSI, EMA via Pandas).

## AI Ensemble

`ai_engine.evaluate_signal()` composites 5 sub-scores:

```
score = score_rsi (±20) + score_macd (±15) + score_ema (±15) + score_bb (±12) + score_volume (±8)
```

- `score_rsi`: oversold → +20, overbought → -20
- `score_macd`: macd > signal (hist>0) → +15, opposite → -15
- `score_ema`: price > ema20>ema50 plus bonus for >ema200 → ±15
- `score_bb`: near lower band → +12, near upper → -12
- `score_volume`: >1.5x SMA → +8

**Volatility penalty**: `high` → -10, `low` + weak score → -5. `atr_pct` + `bb_width_pct` drive vol class.

**Decision**:
- `|score| < 12` → HOLD (confidence 35-~57)
- `score > 0` → BUY, else SELL
- `raw_conf = min(95, |score|*1.6 - penalty)` → clamped to 5-95, capped at 72 in high-vol, 78 on RSI extremes.

**Confidence disclaimer**: Confidence is **ensemble agreement**, not calibrated P(profit). Text in every signal: “AI confidence reflects indicator agreement… not a guarantee of profit.” Validated via simulated backtest, not claimed live.

**Reasoning builder**: Concatenates trend sentence, RSI state, MACD hist direction, BB position, volume ratio, decision sentence.

## Execution

- **Paper**: `TradingEngine.create_paper_trade()` — fills at last close price, fee 0.1%, updates `Position` (avg entry, realized PnL).
- **Manual**: App shows signal → user taps Approve → `POST /trading/orders` with `mode=manual` → live Binance order.
- **Live Auto**: Allowed only if `mode=live_auto`, `auto_trading_enabled=true`, `emergency_stop=false`, confirmation <24h old, and `RiskManager.full_check()` passes.

## Risk Enforcements
- `max_trade_amount_usdt` — reject if notional > limit
- `daily_loss_limit_usdt` — `daily_loss_accum` tracked; block new positions when breached
- `max_open_positions` — count `Trade` with status `NEW|PARTIALLY_FILLED|PENDING`
- `cooldown_minutes` — after 3 consecutive losses, block for N minutes
- `allowed_symbols` whitelist
- `exchangeInfo` filters: `LOT_SIZE`, `PRICE_FILTER`, `MIN_NOTIONAL` → reject or warn
- Balance + fee buffer (0.2%) check
- **Never martingale**: size never auto-increased after loss; user must manually change `max_trade`.

## Order Types
- Market & Limit via Binance Spot.
- Stop-Loss / Take-Profit / Trailing-stop **emulated** by backend (poll + conditional market order) where native OCO unavailable — safer than unsupported native calls.
- Duplicate guard: `clientOrderId` unique index → 409 on reuse.
- Status verification: `POST /order` → `GET /order` with `orderId` before reporting FILLED.

## Backtest (simulated)
`test_trading_engine.py` runs 1k-candle simulations with paper fills, checks drawdown, win rate. No live P&L fabricated. Production P&L from `trades.profit_loss + positions.realized_pnl` with fees separately.

## Limitations
- Slippage not modeled beyond fee.
- WebSocket gaps → fallback to REST.
- Regime change can invalidate indicator thresholds — re-tune via `indicators.py` hyperparams.
