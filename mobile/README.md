# 📱 CryptoAI PRO — Android app

**එක HTML file එකක් + Capacitor Android shell එකක් = install කරන්න පුළුවන් APK එකක්.**

Crypto market data, candlestick chart, signal engine, paper/live trading, AI bot එකක්,
alerts සහ system monitor එකක් — ඔක්කොම තිබෙන්නේ **`www/index.html` කියන එක ගොනුවක** (317 KB,
external script එකක්වත් නැතුව). Android යෙදුම ඒ ගොනුව WebView එකක ධාවනය කරනවා.

```
mobile/
├── src/
│   ├── shell.html          අත්ත HTML සැකිල්ල (CSS + markup + <script src=…> 6)
│   └── js/
│       ├── i18n.js         English + සිංහල string 129ක්
│       ├── ta.js           තාක්ෂණික දර්ශක 25+ (RSI, MACD, BB, ADX, ATR, SuperTrend, …)
│       ├── patterns.js     ඉටිපන්දම් රටා 25+ (engulfing, hammer, divergence, breakout, …)
│       ├── brain.js        ලකුණු එන්ජිම + strategies 6ක් + backtester + trainable weights + AI clients
│       ├── app.js          UI controller: markets, chart, signals, trade, bot, settings
│       └── sysmgmt.js      System tab: process supervisor, device panel, PIN lock
├── tools/
│   ├── build.mjs           src/ → එක HTML ගොනුවක් (www/index.html + ../cryptoai.html)
│   ├── icons.mjs           resources/icon-source.png → සියලු launcher icon + splash
│   ├── serve.mjs           browser එකේ බලන්න local server එකක්
│   └── smoke.test.mjs      jsdom එකේ ඇත්ත build එක boot කර UI එක drive කරන test 8ක්
├── www/index.html          ⭐ build output — APK එකට යන්නේ මේ ගොනුව
├── capacitor.config.json   appId com.rusindu.cryptoaipro, CapacitorHttp ON, https scheme
├── android/                සම්පූර්ණ Gradle project එක (Android Studio එකේ විවෘත කරන්න පුළුවන්)
└── resources/              icon මූලාශ්‍රය + 512/192px පිටපත්
```

Repo මූලයේ **`cryptoai.html`** කියන ගොනුවත් එකම build එකයි — GitHub Pages / Vercel එකෙන්
browser එකකම ධාවනය කරන්න පුළුවන්.

---

## 1. APK එක ලබා ගන්නා විදිය (පහසුම ක්‍රමය — GitHub Actions)

මෙම sandbox එකේ Android SDK එකක් නැති නිසා APK එක **GitHub Actions එකේ** build වෙනවා
(`.github/workflows/android-apk.yml`). පියවර:

1. මේ branch එක `main` ට merge කරන්න (හෝ Actions tab එකෙන් workflow එක අතින් run කරන්න).
2. GitHub → **Actions → Android APK** → අලුත්ම run එක විවෘත කරන්න (~6–10 මිනිත්තු).
3. APK එක තැන් දෙකක:
   - run එකේ පහළින් **Artifacts → `CryptoAI-PRO-5.0.0-apk`** (GitHub login ඕනෑ)
   - **Releases → “CryptoAI PRO APK (latest build)”** → `CryptoAI-PRO-5.0.0-debug.apk`
     (login ඕනෑ නැතුවම phone එකට download කරන්න පුළුවන් ලින්ක් එකක්)
4. Phone එකේ ගොනුව විවෘත කරන්න → “install unknown apps” අවසර දෙන්න → Install.

`v5.1.0` වගේ **tag** එකක් push කළොත් ඒ නමින් වෙනම Release එකක් හැදෙනවා.

Workflow එක build කරන්න කලින් test දෙකම ධාවනය කරනවා: engine tests 20ක් සහ jsdom UI
smoke tests 8ක්. එකක් හරි fail වුණොත් APK එකක් නිකුත් වෙන්නේ නැත.

## 2. ඔයාගේම PC එකේ build කරනවා නම්

Android Studio (හෝ JDK 17 + Android SDK 34) තිබ්බොත්:

```bash
cd mobile
npm ci                  # Capacitor CLI + jsdom
npm run build           # src/ → www/index.html (එක ගොනුව)
npx cap sync android    # www/ → android/app/src/main/assets/public
npm run apk:debug       # = cd android && ./gradlew assembleDebug
```

APK එක: `mobile/android/app/build/outputs/apk/debug/CryptoAI-PRO-5.0.0-debug.apk`

```bash
npm run open            # Android Studio එකේ project එක විවෘත කරන්න (emulator/device එකට Run)
adb install -r mobile/android/app/build/outputs/apk/debug/*.apk
```

### Release APK එකක් (නිල signing)

```bash
keytool -genkeypair -v -keystore release.keystore -alias cryptoai \
        -keyalg RSA -keysize 2048 -validity 10000
```

`mobile/android/keystore.properties` (මෙය git ට යන්නේ නැත):

```properties
storeFile=../../release.keystore
storePassword=…
keyAlias=cryptoai
keyPassword=…
```

ඉන්පසු `npm run apk:release`. CI එකේදී වුවද, `ANDROID_KEYSTORE_BASE64`,
`KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` කියන **repository secrets** 4ක් දැම්මොත්
Actions එක ඒ keystore එකෙන්ම signed release APK එකක් හදනවා. Secrets නැතිව release build
එක debug key එකෙන් sign වෙනවා — install කරන්න පුළුවන්, Play Store එකට බැහැ.

## 3. app එක වෙනස් කරනවා නම්

```bash
# 1. source එක වෙනස් කරන්න
vim mobile/src/js/app.js        # හෝ mobile/src/shell.html

# 2. එක ගොනුව නැවත හදන්න
cd mobile && npm run build      # www/index.html + ../cryptoai.html දෙකම අලුත් වෙනවා

# 3. browser එකේ ඉක්මනට බලන්න
npm run serve                   # http://localhost:4174

# 4. test + APK
npm test && npx cap sync android && npm run apk:debug
```

**`www/index.html` අතින් edit කරන්න එපා** — ඊළඟ `npm run build` එකේදී ඒ වෙනස්කම් මැකෙනවා.
`tools/build.mjs` එක script 6ම එක `<script>` block එකකට inline කරනවා; ඒ නිසා APK එකට
network එකක්වත්, extra ගොනුවක්වත් ඕනෑ නැත.

Icons අලුත් කරන්න: `resources/icon-source.png` (1024×1024) වෙනස් කර
`npm i -D sharp && node tools/icons.mjs` ධාවනය කරන්න.

## 4. යෙදුමේ තියෙන දේ

| Tab | මොකද වෙන්නේ |
|-----|-------------|
| **Markets** | exchange 5ක (Binance, Bybit, OKX, Coinbase, Kraken) පොදු 24h tickers, sort (volume/gainers/losers/watchlist), search, ★ favourites, sparklines, “Scan all signals” |
| **Chart** | canvas candlestick chart, 1m–1d, EMA20/50, Bollinger, volume, RSI sub-chart, touch crosshair, ATR plan overlay, price alerts |
| **Signals** | −100…+100 score, STRONG BUY…STRONG SELL verdict, trend vs reversion gauges, “why” reasons, multi-timeframe, දර්ශක 15ක්, ATR trade plan, AI explanation, backtest |
| **Trade** | paper account (10,000 USDT), market/limit orders, TP/SL, position-size calculator, stats + equity curve, positions, open orders, history. Binance API keys දුන්නොත් **live** orders ඇත්තටම යවනවා (යෙදුම තුළ පමණි) |
| **Bot** | strategies 6ක්, symbols, TP/SL/exit-mode (min-profit), auto-DCA, crash guard, AI sell-rate, risk brakes (max positions, cooldown, daily loss, brake loss), 24/7 card, cloud bot, activity log, **trainable AI brain** |
| **System** | process supervisor එකක් (ක්‍රියාවලි 8ක් pause/run/restart + priority), latency sparkline, tick histogram, device/runtime panel, engine log, PIN lock |

- **භාෂා 2ක්**: EN ⇄ සිංහල (header එකේ `EN` බොත්තම හෝ Settings → Language). සියලු string
  129ක්ම `src/js/i18n.js` එකේ; dynamic text `L(en, si)` helper එකෙන්.
- **Offline-safe**: network එකක් නැතිව/ exchange එක block කළොත් යෙදුම demo data වලට මාරු වී
  ඒ බව කියනවා (header එකේ රතු/රන් වටය). හිස් තිරයක් කිසිවිට පෙන්නන්නේ නැත.
- **CapacitorHttp ON**: Android යෙදුම තුළ HTTP requests native bridge එක හරහා යනවා — ඒ නිසා
  CORS එකෙන් exchange APIs block වෙන්නේ නැත. Browser එකේදී සමහර exchange CORS නිසා අසාර්ථක
  වෙන්න පුළුවන්; එවිට demo data එනවා.

## 5. Android permissions (මේ 5යි, ඊට වැඩිය නැත)

| Permission | ඇයි |
|---|---|
| `INTERNET` | market data, AI providers, cloud bot, live orders |
| `ACCESS_NETWORK_STATE` | System tab එකේ network තොරතුරු |
| `VIBRATE` | fills/alerts වලදී haptic feedback |
| `WAKE_LOCK` | “keep screen awake” switch එක සහ bot loop එක |
| `POST_NOTIFICATIONS` | Android 13+ trade/alert notifications |

Location, camera, contacts, microphone, storage, SMS — කිසිවක් ඉල්ලන්නේ නැත.
API keys ගබඩා වෙන්නේ උපාංගයේ app storage එකේ පමණි; `allowBackup=false`.

## 6. Troubleshooting

| ප්‍රශ්නය | විසඳුම |
|---|---|
| Actions run එක “SDK location not found” කියනවා | workflow එක SDK packages install කරනවා; නැවත run කරන්න. Local build එකකදී නම් `mobile/android/local.properties` එකට `sdk.dir=/path/to/Android/sdk` දාන්න |
| `./gradlew` permission denied | `chmod +x mobile/android/gradlew` |
| APK එක install වෙන්නේ නැත | පරණ version එකක් තිබ්බොත් uninstall කරන්න (debug/release keys වෙනස් නම්). “unknown sources” අවසර දෙන්න |
| යෙදුම demo data පෙන්නනවා | phone එකේ internet තියෙනවද? exchange එක ඔයාගේ රටේ block ද? Settings → Exchange වෙනත් එකකට මාරු කරන්න |
| Browser එකේ live orders යවන්න බැහැ | නිවැරදියි — browser එකකට sign කරන්න බැහැ. Android යෙදුම භාවිතා කරන්න |
| Chart එක හිස් | කදුලු 30කට වඩා ඕනෑ; timeframe එක 1h/1d ට මාරු කරන්න හෝ ⟳ ඔබන්න |

## 7. Risk

මෙය **මූල්‍ය උපදෙස් නොවේ**. Paper account එක ව්‍යාජ මුදල්. Live trading වලදී ඔබ තැන්පත්
කරන සියල්ල අහිමි විය හැක. Bot එකකට අලාභයක් වළක්වන්න බැහැ — risk limits භාවිතා කරන්න,
කුඩා ප්‍රමාණවලින් පටන් ගන්න, exchange පැත්තේ **trade-only** (withdrawals නොවන) API keys
පමණක් දෙන්න.
