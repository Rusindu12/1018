# AI Binance Trader — Secure AI-Assisted Spot Trading Platform

> **⚠️ Risk Disclosure:** Cryptocurrency trading involves substantial risk of loss and is not suitable for every investor. You can lose all invested capital. Past performance, back-tests and AI signals do **not** guarantee future results. This software is provided for educational and assistive purposes; you remain fully responsible for all trading decisions. Never invest more than you can afford to lose.

**AI Binance Trader** is a secure, production-oriented reference implementation of an AI-assisted Binance Spot trading system consisting of:

* **Android App (Kotlin + Jetpack Compose)** — modern dark-themed dashboard with real-time prices, candlesticks, AI signals, balances, orders, P&L, risk controls and emergency STOP.
* **Secure Backend (Python + FastAPI)** — signs all Binance authenticated requests server-side, encrypts API secrets at rest (Fernet/AES-256), proxies market data via WebSockets, runs the AI/indicator engine and enforces risk & trading-mode rules.

No API secrets are stored in the APK, logs, analytics or AI prompts. All secrets are encrypted in the backend database and signed requests never leave the server.

---

## ✨ Features

### 1. Binance API Integration
- Official Binance REST + WebSocket (Spot + Testnet)
- API Key/Secret encrypted with `ENCRYPTION_KEY` (Fernet) — stored per-user, never logged
- Backend-signed authenticated requests (HMAC-SHA256), API key never exposed to AI providers
- Connection test, balance snapshot, exchangeInfo filters, order-status verification
- Rate-limit, network-failure and duplicate-order handling with idempotency keys
- Supports Testnet / Paper Trading before live

### 2. AI Trading System
- Real-time klines for BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT + custom pairs
- Indicators: RSI(14), MACD(12,26,9), EMA(20/50/200), SMA(20/50), Bollinger Bands(20,2), Volume, ATR
- Rule-based AI ensemble → BUY / SELL / HOLD + `confidence 0-100` + human-readable explanation
- Volatility & trend regime detection; confidence is **not** a probability of profit unless calibrated
- Validated on historical simulation (see `backend/app/services/ai_engine.py`)

### 3. Automated Trading
- Three modes: **Paper (default) → Manual → Live Auto (explicit consent)**
- Market & limit orders via Binance Spot; Stop-Loss / Take-Profit / Trailing-stop emulated in backend when native OCO not available
- Duplicate-order guard (clientOrderId), min-notional & lot-size validation, fee estimation
- Emergency STOP — single tap kills new auto orders across devices
- Order-status polling before reporting success

### 4. Risk Management
- Per-user: max trade amount (USDT), daily loss limit, max open positions, cooldown after N losses
- Validates balance, `LOT_SIZE`, `MIN_NOTIONAL`, `PRICE_FILTER`, fees before submit
- Halts new positions when limits breached; never martingale / auto-increase size
- Structured logs without secrets

### 5. Android Dashboard (Dark Theme)
- Live prices + TradingView-style candlesticks (MPAndroidChart / Compose Charts)
- AI signal cards (BUY/SELL/HOLD, confidence, reasoning)
- Balance tiles (total, free/locked USDT & asset), API connection badge
- Open orders & trade history with fee breakdown
- P&L dashboard (realized/unrealized, fees separately)
- Auto Trading ON/OFF, trading-pair picker, risk sliders
- Notifications: fills, errors, risk-limit hits (FCM + in-app)

---

## 🏗️ Architecture

```
[ Android (Compose) ] --HTTPS/JWT--> [ FastAPI Backend ] --HMAC--> [ Binance API ]
        |                                 |
        +-- WebSocket (market) <-----------+-- WebSocket (Binance streams)
        +-- Encrypted SecureStore (JWT)    +-- Fernet-encrypted DB (Postgres/SQLite)
                                           +-- AI Engine + Risk Manager + Trading Engine
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for sequence diagrams, threat model and data flow.

## 📦 Repository Layout

```
/
├── backend/            # FastAPI secure backend
│   ├── app/main.py
│   ├── app/core/       # config, security, encryption
│   ├── app/models/     # SQLAlchemy ORM
│   ├── app/services/   # binance_client, indicators, ai_engine, risk_manager, trading_engine
│   ├── app/routers/    # REST + WebSocket endpoints
│   └── app/tests/      # unit + integration + simulated trading tests
├── android/            # Kotlin + Jetpack Compose app
│   ├── app/build.gradle.kts
│   ├── app/src/main/java/com/aibinance/trader/...
│   └── ...
├── docs/               # SETUP, SECURITY, API, TRADING_LOGIC
├── .github/workflows/build.yml  # Signed APK CI
└── docker-compose.yml
```

## 🚀 Quick Start

### Prerequisites
- Python 3.11+, Android Studio Hedgehog+, JDK 17
- Binance account (enable **Spot Trading** only — **disable Withdrawals**)
- Postgres 15 (or SQLite for dev) + Redis (optional for rate-limit)

### 1) Backend
```bash
cd backend
cp .env.example .env   # set ENCRYPTION_KEY, JWT_SECRET, BINANCE_TESTNET=true
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# tests
pytest -v --cov=app

# docker
docker compose up --build
```
API docs: http://localhost:8000/docs

### 2) Android
1. Open `android/` in Android Studio.
2. Create `local.properties` (or set env):
   ```
   API_BASE_URL=https://your-backend.example.com/
   WS_BASE_URL=wss://your-backend.example.com/
   ```
3. Run on emulator/device (default = Paper Trading, no real funds).
4. Go to **Settings → Binance API** → paste keys (stored encrypted server-side) → **Test Connection** → **Balance**.

See [`docs/SETUP.md`](docs/SETUP.md) for Testnet setup, signing-key generation and signed APK instructions.

### 3) Trading Modes
- **Paper Trading** (default) — simulated fills against live market price, no Binance calls.
- **Manual** — AI suggests, you tap Approve → backend places real order.
- **Live Auto** — after you set risk limits and confirm the risk disclaimer, backend auto-executes when rules + risk pass.

Switch modes in **Settings → Trading Mode**. Live Auto requires re-confirmation every 24h.

## 🔒 Security Guarantees
- No hard-coded credentials; keys injected via env/SecureStore, encrypted at rest
- Backend-only HMAC signing; frontend never sees `apiSecret`
- `WITHDRAW` permission rejected at connection test
- No secrets in logs, Crashlytics, AI prompts or APK reverse-engineerable strings
- HTTPS + JWT + rate-limiting + input validation (Pydantic)
- `ENCRYPTION_KEY` rotation script included

Full audit: [`docs/SECURITY.md`](docs/SECURITY.md)

## 🧪 Testing
| Suite | Command | Coverage |
|-------|---------|----------|
| Unit (indicators, risk, AI) | `pytest backend/app/tests/test_indicators.py` | KPI calc |
| Integration (Binance mock) | `pytest backend/app/tests/test_binance_client.py` | Signing, errors, filters |
| Simulated trading | `pytest backend/app/tests/test_trading_engine.py` | 1k-candle backtest, drawdown |
| Android UI | `./gradlew :app:testDebugUnitTest` | ViewModels |

No fabricated P&L is displayed as live — demo screenshots are labeled **SIMULATED**.

## 📲 Signed Release APK
GitHub Actions workflow [`.github/workflows/build.yml`](.github/workflows/build.yml) builds a signed APK/AAB on tag push:

```bash
# store signing config in GitHub Secrets:
# ANDROID_KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD
git tag v1.0.0 && git push origin v1.0.0
# artifact: app-release.apk + SBOM
```

Local signed build: see `android/BUILD.md`.

## 📖 Docs
- [Setup & Testnet Guide](docs/SETUP.md)
- [Architecture & Threat Model](docs/ARCHITECTURE.md)
- [Security Policy](docs/SECURITY.md)
- [Trading Logic & AI Signals](docs/TRADING_LOGIC.md)
- [Backend API Reference](docs/API.md)

## 🤝 Contributing & Disclaimer
This is a reference/security-hardened starter, **not financial advice** and **not production-ready** until you complete your own security review, penetration test and regulatory checks. See `LICENSE` (Apache 2.0). Pull requests must pass `pytest` and `detekt` + secret-scan.

## 📄 License
Apache 2.0 — see [LICENSE](LICENSE).

---

**Emergency STOP:** In app → red **STOP AUTO TRADING** banner (always visible when auto is ON) or `POST /api/v1/trading/emergency-stop`.
