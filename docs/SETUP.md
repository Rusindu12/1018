# Setup Guide — AI Binance Trader

## 1. Binance Testnet Account
1. Go to https://testnet.binance.vision/ → Log In with GitHub → Generate API Key.
2. Enable **Enable Trading**, **Enable Reading**. **Leave Enable Withdrawals OFF**. Whitelist your server IP.
3. Copy API Key + Secret.

> Paper Trading works without Binance keys (simulated fills). Start there.

## 2. Backend (FastAPI)

```bash
cd backend
cp .env.example .env
# Generate keys:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"   # -> ENCRYPTION_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"  # -> JWT_SECRET
# Edit .env:
# ENCRYPTION_KEY=...  (44-char base64)
# JWT_SECRET=...
# BINANCE_TESTNET=true
pip install -r requirements.txt
uvicorn app.main:app --reload
# http://localhost:8000/docs
```

### Docker
```bash
docker compose up --build
# DB at localhost:5432, Redis 6379
```

### Key rotation
If you rotate `ENCRYPTION_KEY`, run `python backend/scripts/rotate_keys.py --old $OLD --new $NEW` (see `backend/app/core/encryption.py` helper).

## 3. Android App

1. Install Android Studio Hedgehog+ + JDK 17.
2. Open `android/` folder.
3. Create/verify `local.properties`:
```
sdk.dir=/path/to/Android/Sdk
API_BASE_URL=http://10.0.2.2:8000/   # emulator → host
WS_BASE_URL=ws://10.0.2.2:8000/api/v1/market/ws
```
For physical device, use LAN IP `http://192.168.x.x:8000/`.

4. Run → Dashboard defaults to **Paper Trading**.
5. Bottom nav → Settings → Register/Login → Paste Binance Testnet Key/Secret → Save & Encrypt → Test Connection.
6. Choose pair (e.g., BTCUSDT), view AI signals, set Risk (max trade, daily loss), pick Mode.

### Trading Modes
- **Paper**: simulated fill at market price, no Binance call.
- **Manual**: AI suggests → you tap “Create Order” → backend places order.
- **Live Auto**: Requires: (a) Risk limits set, (b) Test Connection shows `can_trade=true`, (c) tap “Enable Live” and accept disclaimer. Re-confirm every 24h. Emergency STOP always available.

## 4. Tests

```bash
cd backend
ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())") JWT_SECRET=test pytest -v --cov=app
./gradlew :app:testDebugUnitTest
```

## 5. Signed Release Build

Local:
```bash
cd android
# Generate keystore once: keytool -genkey -v -keystore ai-binance.jks -alias aibinance -keyalg RSA -keysize 2048 -validity 9125
# Put in android/app/ and add to android/gradle.properties or env (never commit):
# MYAPP_RELEASE_STORE_FILE=ai-binance.jks
# MYAPP_RELEASE_STORE_PASSWORD=...
# MYAPP_RELEASE_KEY_ALIAS=aibinance
# MYAPP_RELEASE_KEY_PASSWORD=...
./gradlew assembleRelease  # -> app/build/outputs/apk/release/app-release.apk
```

CI (GitHub Actions):
- Set Secrets: `ANDROID_KEYSTORE_BASE64` (base64 of .jks), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
- Push tag `v*` → workflow builds signed APK + AAB artifact.

## 6. Deploy Backend (example: Fly.io / Render / VPS)

- Set env vars from `.env.example` (never log).
- Use Postgres (Neon/Supabase) + Redis (Upstash) for prod.
- Enable HTTPS (LetsEncrypt).
- Set `CORS_ORIGINS` to your app domain.
- Turn `BINANCE_TESTNET=false` only after Testnet success + user consent flow tested.
- Monitor `/health` and logs (secrets redacted).

## 7. Troubleshooting
- `401 Invalid token` → re-login; JWT expired (60m).
- `Withdrawal permission` error → recreate Binance key without withdrawal.
- `LOT_SIZE`/`MIN_NOTIONAL` error → increase quantity (check Risk → Available USDT).
- APK install blocked → enable Install Unknown Apps for file manager.
