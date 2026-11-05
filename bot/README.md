# Experimental Binance Spot Testnet bot

This is a **separate, self-hosted command-line prototype**, not an Android service. It cannot place real-money orders: its API endpoint is hard-coded to `https://testnet.binance.vision`. It is not production-ready and has not been validated against a live Testnet account in this environment. Do not use production keys. Nothing is stored in the browser or sent to the dashboard.

The bot runs only while its process is running. It watches BTC/USDT hourly closed candles, trains the same experimental local model and compares its holdout accuracy against the training-majority baseline. A score threshold may open a test position; the opposite score or 2%/3% thresholds on a later closed candle may close it. These are **not exchange stop orders**: the bot must be online, and price can move substantially between candles. No guaranteed risk limit, profit or predictive power. Holdout accuracy from such a small sample is not proof of an edge. Trading fees, slippage, dust and model drift matter.

## Run

Node.js 18+ is required. Set up a Binance Spot Testnet account and Testnet-only API credentials independently. Never paste keys into chat or commit them. Start with dry-run (no API key required):

```sh
node bot/testnet.js
```

To enable **Testnet-only** orders, set `BINANCE_TESTNET_API_KEY` and `BINANCE_TESTNET_API_SECRET` in your terminal environment and run:

```sh
node bot/testnet.js --testnet-orders
```

Optional `BOT_ORDER_USDT` (10–100, default 20) and `BOT_MAX_DAILY_ORDERS` (1–5, default 3) set hard bounds. Binance Testnet resets balances and orders periodically. The bot uses a single BTCUSDT position and is not safe to share an account with other trading systems. The daily order cap blocks new buys after the limit, but a sell to exit an existing position can exceed it.

Ctrl+C stops the process; it does not close positions. State is saved in `.bot-state/` (or `BOT_STATE_DIR`). Do not edit/delete it while running. An exclusive lock prevents two instances sharing that directory; after an unclean crash, first verify the old process is gone, then remove `instance.lock`. If an order times out, is rejected or has an unexpected response, `pending` remains recorded and the bot stops. Before clearing it manually, look up the client order ID on Binance Testnet and reconcile balances, fills and `position` with the exchange. Never automatically retry an uncertain order. Restart only after reconciliation. Protect state and credentials with operating-system access controls.

Before any real-money product: independent security and trading-risk review, exchange reconciliation, durable transactional storage, verified key isolation, kill switches, exchange-native protective orders, monitoring, backtesting and forward testing, regulatory/compliance review and real-device testing are needed. This prototype is not a substitute.
