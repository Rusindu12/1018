# Security Policy — AI Binance Trader

## Threat Model
- **Assets**: Binance API keys (trading), JWT, trade history, user credentials.
- **Adversaries**: Network eavesdropper, compromised device, leaked logs, malicious AI prompt, supply-chain.
- **Out of scope**: Binance itself, user device compromise beyond app sandbox.

## Guarantees

1. **No hardcoded secrets**: All secrets from env / encrypted DB. APK contains no `apiKey`/`apiSecret` strings. CI secret-scan (`gitleaks`) enforced.
2. **Backend-only signing**: `BinanceClient._sign()` runs only on server. Frontend never sees `apiSecret`. AI providers never receive secrets (engine is local rule-based).
3. **Encrypted at rest**: `encrypted_api_key/secret` via `Fernet(AES-128-CBC + HMAC)` with `ENCRYPTION_KEY` from env. Plaintext only in memory during request.
4. **Withdrawal rejected**: `/binance/test-connection` checks `permissions` + `canWithdraw`. If `WITHDRAW` present → `success=false` with guidance to recreate key.
5. **No secrets in logs/analytics/AI prompts**: `SecretFilter` redacts; `mask_secret` for UI; structured logs omit sensitive fields.
6. **HTTPS + JWT + input validation**: `HTTPS` enforced (no cleartext), `Pydantic` validation, `rate limiting` (60/min), `bcrypt` passwords, JWT 60m expiry.
7. **Idempotency & order safety**: `clientOrderId` unique → duplicate guard; `exchangeInfo` filters validated; fee estimation; order status verified.
8. **Emergency STOP**: Single tap disables new auto orders cluster-wide (DB flag + WS broadcast).

## Key Management

- Generate `ENCRYPTION_KEY`: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- Never commit `.env`. Use GitHub Secrets / Doppler / Vault.
- Rotation: use `re_encrypt_all()` helper; schedule rotation every 90 days.

## Code Checklist (before prod)

- [ ] Change `JWT_SECRET` + `ENCRYPTION_KEY` from defaults
- [ ] Set `CORS_ORIGINS` to exact domains
- [ ] Enable Postgres + backups + at-rest encryption
- [ ] Turn off `DEBUG`/`echo`
- [ ] Monitor `/health`, rate-limit logs, failed auth spikes
- [ ] Penetration test: OWASP API Top 10, dependency scan (`pip-audit`)

## Reporting
Report vulnerabilities via GitHub Security Advisory (private) — do not file public issues with secrets. Rotate keys if leak suspected.

## User Guidance
- Create Binance API key with **Spot Trading only** → disable Withdrawals → IP whitelist.
- Start in Paper Trading. Verify P&L on Testnet before Live.
- Understand: crypto is volatile; AI signals are assistive, not advice.
