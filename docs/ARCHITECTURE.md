# Architecture — AI Binance Trader

## Overview
```
Android (Kotlin + Compose)  --HTTPS+JWT-->  FastAPI Backend  --HMAC-SHA256-->  Binance Spot API
       |        |                                  |                                     |
       +--WS (market relay) <-----------+--Binance WS (kline@1m)              Public klines/ticker
       +--Encrypted JWT (Device)         +--Fernet DB (Postgres)               + Signed: account/openOrders/order
                                         +--AI Engine + Risk + Trading Engine
```

## Components
- **Backend (`backend/app`)**
  - `core/config.py` — env-driven, no hardcoded secrets
  - `core/encryption.py` — Fernet encrypt API secrets per-user
  - `core/security.py` — bcrypt + JWT
  - `services/binance_client.py` — only place that signs (HMAC). Handles 429/418 with backoff, verifies order status.
  - `services/indicators.py` — RSI/MACD/EMA/SMA/BB/ATR/Volume
  - `services/ai_engine.py` — ensemble scoring → BUY/SELL/HOLD + confidence + reasoning. Confidence capped in high-vol, NOT P(profit).
  - `services/risk_manager.py` — emergency STOP, daily loss, max open, cooldown, max trade, balance, allowed symbols, exchange filters
  - `services/trading_engine.py` — idempotent order create, paper simulation vs live Binance, emergency-stop gate
  - `services/market_data.py` + `websocket_manager.py` — public klines cache + Binance WS proxy rebroadcast
  - `routers/*` — auth, binance, market, trading, risk, system
  - `models/*` — User, ApiCredential (encrypted), Trade/Order/Position, RiskSetting, TradingModeState

- **Android (`android/app`)**
  - Jetpack Compose dark theme, single-activity + Navigation Compose
  - `data/api/ApiService.kt` — Retrofit to backend (HTTPS)
  - `data/local/SecureStore.kt` — DataStore + EncryptedSharedPreferences for JWT; **no API secrets stored locally**
  - `di/AppModule.kt` — Koin
  - `ui/screens/*` — dashboard/market/signals/orders/portfolio/risk/settings — all spec requirements
  - Emergency STOP banner always visible when auto ON (Dashboard + Risk screens)

## Sequence: Place Order (Live Auto)
1. App shows AI signal → user has Auto=ON, Mode=live_auto, risk configured + 24h confirmation.
2. Backend cron or user taps Create Order → `POST /trading/orders`.
3. TradingEngine checks: emergency STOP → mode → daily loss → cooldown → max positions → allowed symbol → max trade → balance → exchange filters.
4. If pass: creates `Trade` PENDING, then `BinanceClient.create_order(signed)` with `newClientOrderId`.
5. Verifies via `GET /order` before returning success. Retries on 429.

## Data Flow
- Market data: Binance public → backend cache (10s TTL) → REST + WS to app.
- Secrets: User enters key/secret in Settings → `POST /binance/credentials` → backend `encrypt_secret` → DB. Decrypted only in memory for signing.

## Database Schema (simplified)
- `users(id,email,hashed_password, live_consent_at)`
- `api_credentials(id,user_id,encrypted_api_key,encrypted_api_secret,is_testnet,can_trade,can_read)`
- `trades(id,user_id,symbol,side,order_type,quantity,price,executed_price,fee,mode,client_order_id unique,binance_order_id,status)`
- `orders(id,trade_id,binance_order_id,status,raw_response)`
- `positions(id,user_id,symbol,quantity,avg_entry_price,realized/unrealized,fees)`
- `risk_settings(user_id,max_trade,daily_loss,max_open,cooldown,sl/tp,allowed_symbols,daily_accum,consecutive_losses)`
- `trading_mode_state(user_id,mode,auto_enabled,emergency_stop, live_confirmed_at)`

## Scaling & Ops
- Backend stateless (JWT); DB is source of truth.
- Redis optional for rate-limit & WS pub/sub.
- Structured logging (secret-filter) + health endpoint.
