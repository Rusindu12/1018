# Binance AI Desk (Flutter / Android)

This repository keeps the existing NeuraLab website at the root and adds a standalone Flutter Android app under `mobile/`.

## Architecture

```text
mobile/
├── android/                         Android host, manifest, Gradle + signing
├── lib/
│   ├── main.dart                    Flutter entry point
│   ├── app.dart                     Material app/theme setup
│   ├── analysis/
│   │   ├── indicators.dart          EMA, Wilder RSI, MACD, Bollinger, ATR
│   │   ├── ai_trading_engine.dart   Transparent local BUY/SELL/HOLD heuristic
│   │   └── position_sizer.dart      Fixed-risk position-size calculation
│   ├── data/binance/
│   │   ├── binance_api_client.dart Signed Spot / USDⓈ-M Futures REST requests
│   │   ├── market_stream.dart       Reconnecting combined ticker WebSocket
│   │   └── app_preferences_store.dart
│   ├── models/                      Settings, candles, account and order models
│   ├── security/credential_store.dart Android encrypted credential storage
│   ├── state/trading_controller.dart App state and risk guard
│   └── ui/
│       ├── app_shell.dart           Bottom navigation
│       ├── screens/                 Dashboard, chart, signals, settings
│       └── widgets/                 Interactive candlestick chart and order ticket
├── test/                            Indicator, signal and position-size tests
├── pubspec.yaml
└── analysis_options.yaml

.github/workflows/build_apk.yml      CI: analyze, test, build and upload release.apk
```

## What works

- Binance Spot and USDⓈ-M Futures market data over REST and a reconnecting ticker WebSocket.
- Market prices and interactive OHLCV candlesticks, with EMA 20/50 and Bollinger overlays; RSI, MACD and indicator values are shown alongside the chart.
- Local, deterministic signal analysis producing BUY / SELL / HOLD, a heuristic confidence score, entry, ATR-derived take-profit/stop-loss levels, and reasons.
- Spot wallet estimate from currently available `ASSETUSDT` tickers. Futures wallet/equity and unrealized P&L. Futures daily risk P&L is today's realized P&L, commission and funding plus current unrealized P&L (UTC); Futures order submission fails closed if that daily P&L cannot be verified.
- Position sizing from account equity, risk percentage and stop distance.
- User-reviewed Market and Limit (GTC) orders for Spot and USDⓈ-M Futures. Futures supports a reduce-only flag in one-way position mode.
- Testnet by default, environment-specific and market-specific API credentials, an app-side daily Futures loss guard, and no unattended trading.

## AI and P&L limitations

The “AI” module is a readable rules engine over EMA, RSI, MACD, Bollinger Bands and ATR. It is **not** an LLM, trained predictive model, or source of financial advice. Confidence is a heuristic score, not a calibrated probability. Spot P&L is not inferred from wallet balances because Binance's balance endpoint does not include acquisition cost basis; the app labels this honestly. On Futures, if daily income history cannot be read, the daily-loss guard cannot be verified and order submission should remain blocked.

Unattended/background live automation is intentionally not included. Signals can prefill a ticket, but a human must review and confirm each order. Market orders can fill at a different price, and exchange filters, fees, slippage, funding and leverage are not included in the suggested size. The app does not place attached protective stop/target orders.

## Run locally

Install Flutter stable (3.33 or newer), Android Studio/Android SDK, and JDK 17. Then:

```bash
cd mobile
flutter pub get
flutter analyze
flutter test
flutter run
```

The app starts on Binance Spot testnet, which is also the default environment in Settings. Public market data is available without keys. To view an account or submit an order, create a Binance API key for the matching market and environment and enter it under **Settings**. Spot, Futures, testnet and live credentials are stored in separate Android encrypted-storage slots on the device.

Use a dedicated sub-account where possible. Grant only the necessary read and trading permissions, disable withdrawals/transfers, and allowlist the device/network IP at Binance if available. Keep API secrets out of source control, screenshots and support logs. Never use a key with withdrawal permission.

## Build an APK

Build locally:

```bash
cd mobile
flutter pub get
flutter build apk --release
# Output: mobile/build/app/outputs/flutter-apk/app-release.apk
```

Every branch push runs `.github/workflows/build_apk.yml`. The workflow runs `flutter analyze` and `flutter test`, builds the release variant, and uploads an Actions artifact named **`release.apk`** (retained for 30 days). Download it from the repository's **Actions → Build Android APK → workflow run → Artifacts**.

Without Android signing secrets, CI signs with the debug key so the APK can be installed for evaluation; that is **not** suitable for Play Store distribution. To produce an upload-signed APK, create a keystore and configure these repository **Actions secrets**:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded `.jks` / `.keystore` file
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_STORE_PASSWORD`

Example to encode a keystore locally (do not commit the file or the output):

```bash
base64 -w 0 upload-keystore.jks
```

For store release, also review the app ID, version, privacy policy, Binance terms and jurisdictional requirements. Protect the signing secrets and retain the keystore securely; losing it can prevent updates to an existing Play Store app.

## API endpoints

- Spot REST: `api.binance.com`; Spot testnet: `testnet.binance.vision`
- USDⓈ-M Futures REST: `fapi.binance.com`; Futures testnet: `testnet.binancefuture.com`
- Public streams: Binance Spot / Futures ticker combined streams, matching the selected environment

Signed private requests use HMAC-SHA256 locally. The Binance API secret and any AI provider key are not transmitted to a model service; this app does not call an LLM.
