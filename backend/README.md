# Backend — AI Binance Trader (FastAPI)

Secure FastAPI service that proxies market data, runs AI signals, enforces risk, and **signs Binance requests server-side**.

## Run
`cp .env.example .env` (set `ENCRYPTION_KEY` + `JWT_SECRET`), `pip install -r requirements.txt`, `uvicorn app.main:app --reload`.

See root `README.md` + `docs/SETUP.md`.

## Key Endpoints
- `POST /api/v1/auth/*` — register/login
- `POST /api/v1/binance/credentials` + `test-connection` + `balances`
- `GET /api/v1/market/prices|klines|indicators|signals` + `WS /market/ws`
- `POST /api/v1/trading/orders` + `GET /trading/pnl` + `emergency-stop`
- `PUT /api/v1/risk/settings`

## Test
`ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())") JWT_SECRET=test pytest -v`
