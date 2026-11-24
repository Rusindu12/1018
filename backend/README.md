# Private Binance Spot backend

This small Node.js service is an **optional private order proxy** for the CryptoLab Android app. Binance API key/secret are read from the backend process environment only; they are never sent to the APK or returned by the service. It supports spot market buys/sells for BTC/ETH/SOL/BNB against USDT. The app always requires a separate user acknowledgement and confirmation for each order. There is no live auto-trader, leverage, withdrawals, or order-management endpoint.

## Security checklist — do these before using any real funds

1. Create an API key with **Spot Trading only**. Disable withdrawals, margin, futures, and every permission you do not need.
2. Enable Binance's **IP access restriction** and allow only the fixed public IP of this backend host. Do not run a live key on a shared/public host.
3. Keep this service on a private network or behind a VPN/private access layer and a TLS reverse proxy. Do not publish raw port 8787 to the internet. CORS is a browser control, not authentication.
4. Generate a unique random `APP_ACCESS_TOKEN` (`openssl rand -hex 32`). Keep `.env` out of Git, APKs, logs, chat, and screenshots. Rotate the Binance key and backend token immediately if either might be exposed.
5. Start with **Binance Spot Testnet** and test with testnet keys/fake funds. API clocks must be correct. Market orders may slip, partially fill, or fail; neither a stop nor profit is guaranteed.
6. Use the server-side notional cap. The default `MAX_ORDER_USDT=25` applies per request. It is not a daily-loss limit or a guarantee against loss.

This code cannot verify your country-specific legal eligibility, Binance account settings, or the permissions on your key. Confirm those directly with the exchange and a qualified local professional before enabling live mode.

## Configure and run locally

```sh
cp .env.example .env
# Put your random APP_ACCESS_TOKEN and Spot Testnet API key/secret in .env
set -a; . ./.env; set +a
npm run start:backend
```

The backend binds to `127.0.0.1:8787` by default. The Android app cannot reach your computer's `localhost`; deploy the service at a private HTTPS URL reachable by the phone. For app preview/development, add the exact app origin to `APP_ORIGINS`.

## Docker deployment

Build with `docker build -t cryptolab-backend .`. Run it behind your existing VPN/TLS proxy with environment variables supplied by your secret manager or an untracked `.env`; the image contains no keys. Example for a reverse proxy on the same host: `docker run -d --name cryptolab-backend --restart unless-stopped --env-file .env -e HOST=0.0.0.0 -p 127.0.0.1:8787:8787 cryptolab-backend`. The host port is loopback-only; have the TLS proxy/VPN forward to it. Do not mount the repository or `.env` into a public web root.

Example reverse-proxy origin configuration:

```env
APP_ACCESS_TOKEN=<64+ random hex characters>
BINANCE_API_KEY=<Spot Testnet key>
BINANCE_API_SECRET=<Spot Testnet secret>
BINANCE_TESTNET=true
LIVE_TRADING_ENABLED=false
MAX_ORDER_USDT=25
MIN_ORDER_USDT=10
APP_ORIGINS=https://localhost
HOST=0.0.0.0
PORT=8787
```

The proxy must forward `/health` and `/api/*`, preserve the `Authorization` header, and terminate TLS. For a web dev preview, append its exact HTTPS origin to `APP_ORIGINS`; do not use `*`.

## Explicit live-mode opt-in

Only after you have validated testnet, private networking, the IP allowlist, and the read/trade-only key, configure the backend host (not the APK) with both:

```env
BINANCE_TESTNET=false
LIVE_TRADING_ENABLED=true
```

Restart the service and confirm the app identifies it as **LIVE SPOT**. Every live order still needs the user to check the risk acknowledgement and confirm twice. To disable live orders immediately, set `LIVE_TRADING_ENABLED=false` and restart the backend; revoke the Binance API key in the exchange if you suspect compromise.

## API surface

- `GET /health` — minimal liveness check.
- `GET /api/status` — bearer-protected mode, order cap, key-configured boolean; never returns secret values.
- `GET /api/quote?symbol=BTCUSDT` — allowlisted public quote.
- `GET /api/account` — bearer-protected balances limited to USDT/BTC/ETH/SOL/BNB.
- `POST /api/order` — bearer-protected, explicitly confirmed market BUY (USDT quote amount) or SELL (asset quantity); validates symbol, configured cap, Binance step/min-notional rules, and free balance.

The API token is a separate backend access credential; it is not a Binance API key. The app keeps it in memory only. If the app is closed/reloaded, reconnect by entering it again.
