# API Reference — AI Binance Trader Backend

Base URL: `https://api.example.com` (or `http://localhost:8000`)
Prefix: `/api/v1`
Auth: `Authorization: Bearer <JWT>` (except `/health`, `/`, `/auth/*`, `/market/prices|klines` optionally public)

Interactive docs: `GET /docs` (Swagger) + `GET /redoc`.

## Auth
```
POST /api/v1/auth/register   {email, password} -> {access_token, token_type, expires_in}
POST /api/v1/auth/login      {email, password} -> same
GET  /api/v1/auth/me         (auth) -> {id,email,created_at}
```

## Binance
```
POST /api/v1/binance/credentials              (auth) {api_key, api_secret, label, is_testnet} -> masked key
GET  /api/v1/binance/credentials              (auth) -> list of masked credentials
POST /api/v1/binance/test-connection?credential_id=  (auth) -> {success, can_read, can_trade, has_withdraw_permission, message, permissions}
GET  /api/v1/binance/balances                 (auth) -> {balances:[{asset,free,locked,total}], total_usdt, available_usdt, source}
DELETE /api/v1/binance/credentials/{id}       (auth)
```
**Security**: Never log `api_secret`; rejected if `has_withdraw_permission=true`.

## Market (public)
```
GET /api/v1/market/prices?symbols=BTCUSDT,ETHUSDT
GET /api/v1/market/klines/{symbol}?interval=1h&limit=100
GET /api/v1/market/indicators/{symbol}?interval=1h         -> {indicators:{rsi,macd,ema20,...}}
GET /api/v1/market/signals/{symbol}?interval=1h            -> {symbol,action,confidence,price,indicators,reasoning,volatility,trend,disclaimer}
GET /api/v1/market/signals?symbols=BTCUSDT,ETHUSDT&interval=1h -> {signals:[...]}
GET /api/v1/market/exchange-filters/{symbol}
WS  /api/v1/market/ws  (auth optional) -> {type:"market.kline", data: Binance raw}
```

## Trading
```
GET  /api/v1/trading/mode                -> {mode, auto_trading_enabled, emergency_stop, live_confirmed_at}
PUT  /api/v1/trading/mode   {mode:paper|manual|live_auto, auto_trading_enabled?, confirm_live, disclaimer_accepted}
POST /api/v1/trading/emergency-stop     -> {emergency_stop:true, at}
POST /api/v1/trading/emergency-stop/clear
POST /api/v1/trading/orders  {symbol, side:BUY|SELL, order_type:MARKET|LIMIT, quantity?, quoteOrderQty?, price?, stop_loss_pct?, take_profit_pct?, clientOrderId?} -> OrderDto
GET  /api/v1/trading/orders?symbol=&limit=50 -> OrderDto[]
GET  /api/v1/trading/pnl     -> {realized_pnl, unrealized_pnl, total_fees, total_trades, win_rate, daily_pnl}
```

## Risk
```
GET /api/v1/risk/settings               -> {max_trade_amount_usdt, daily_loss_limit_usdt, max_open_positions, cooldown_minutes, stop_loss_pct, take_profit_pct, allowed_symbols, daily_loss_accum, consecutive_losses}
PUT /api/v1/risk/settings   (same body) -> updated
```

## System
```
GET /health                          -> {status, app, env, testnet}
GET /api/v1/system/config            (auth) -> {app_name, binance_testnet, eligible_pairs, paper_initial_balance, indicators, risk_disclosure}
GET /api/v1/system/notifications     (auth) -> {notifications:[{type,title,detail,at}]}
```

### Example: Place Paper Order
```bash
TOKEN=$(curl -s http://localhost:8000/api/v1/auth/login -H "Content-type: application/json" -d '{"email":"a@a.com","password":"pass12345"}' | jq -r .access_token)
curl -H "Authorization: Bearer $TOKEN" -H "Content-type: application/json" -d '{"symbol":"BTCUSDT","side":"BUY","order_type":"MARKET","quote_order_qty":20}' http://localhost:8000/api/v1/trading/orders
```

### Errors
- `401` invalid token, `409` duplicate clientOrderId, `422` risk limit, `403` live confirm missing, `502` Binance upstream.
- All errors JSON: `{"detail": "..."}`
