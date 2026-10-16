# Build & release

## Everyday commands

```bash
cd app
flutter pub get
flutter analyze                                  # 0 issues expected
flutter test                                     # unit + widget tests, no network
flutter run                                      # debug, demo mode if Firebase is absent
flutter build apk --release --split-per-abi       # recommended: ~7 MB per ABI
flutter build apk --release                       # universal APK (~20 MB)
flutter build appbundle --release                 # Play Store upload (AAB)
```

## Size budget (target: < 30 MB)

| Part | Approx. |
|---|---|
| Flutter engine + Android runtime | 6–8 MB |
| App code (Dart AOT, `dart:io`, no tree-shaking blockers) | ~2 MB |
| `flutter_pdfview` + platform PDF engine | ~1 MB |
| Firebase SDKs (core, firestore, storage, auth) | ~2.5 MB |
| Bundled demo catalogue + sample PDF + icons | ~0.2 MB |
| **Total (arm64, split APK)** | **≈ 11 MB** |

`--split-per-abi` plus `resourceConfigurations += ["en","si","ta"]` (already in
`android/app/build.gradle`) is what keeps it there. You can add
`--obfuscate --split-debug-info=build/symbols` — the app has no reflection or
JSON codegen, so it survives obfuscation (keep the symbols for crash reports).

## Release signing

1. Create a keystore:

```bash
keytool -genkey -v -keystore ~/edulanka-upload.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias upload
```

2. Create `app/android/key.properties` (**never commit it** — `.gitignore` blocks it):

```properties
storePassword=********
keyPassword=********
keyAlias=upload
storeFile=/absolute/path/to/edulanka-upload.jks
```

3. `flutter build appbundle --release` now signs with your key. Without the file the
build still succeeds but falls back to debug signing (fine for local testing,
rejected by Play).

## Play Store checklist

| Item | Where |
|---|---|
| App name, short & full description | Play Console listing — mention "free, no ads" and the trilingual support |
| Feature graphic 1024×500, screenshots ×4+ | take them from the four tabs + the viewer |
| Icon 512×512 | `app/assets/images/app_icon.png` (generated) |
| Privacy policy URL | `/privacy` inside the app + a web copy (the in-app policy text is in `privacy_policy_page.dart`; host the same text anywhere) |
| Data safety form | "No data collected, no data shared" — accurate: no accounts, no analytics, no ads; downloads/counters are anonymous |
| Content rating | everyone; it is an education app |
| Target API level | inherited from the Flutter SDK (`flutter.targetSdkVersion`) |
| AAB upload | `flutter build appbundle --release` |
| Versioning | bump `version: 1.0.0+1` in `pubspec.yaml` — Play requires an increasing `versionCode` |

## Optional platforms

The repository ships the Android runner (and the widget tests). If you want iOS,
web or desktop:

```bash
cd app
flutter create --platforms=ios .
flutter create --platforms=web .
```

Then re-apply the two Android-specific settings to the new platform folders:

* iOS: `ios/Runner/Info.plist` — add `CFBundleLocalizations` = `en, si, ta`, and
  set `ios/Runner/GoogleService-Info.plist` if you use Firebase.
* Web: `web/index.html` — set the theme colour to `#00695C`; note that
  `flutter_pdfview` is not supported on web (the viewer would need
  `pdf.js`/`syncfusion` instead), so the web build is best used as a catalogue
  browser.

For **Flutter Web used as an admin panel**, prefer the existing `admin_web/`
folder: it is 50 KB instead of several MB, and it needs no build step to deploy.

## CI (GitHub Actions, free for public repos)

`.github/workflows/ci.yml` runs on every push/PR:

1. `flutter pub get`
2. `flutter analyze`
3. `flutter test`
4. `flutter build apk --debug --split-per-abi` (proves the Android build works)
5. uploads the debug APK as a build artifact you can sideload

Add a release job later with `flutter build appbundle --release` gated on a tag.

## Troubleshooting builds

| Error | Fix |
|---|---|
| `flutter.sdk not set in local.properties` | run `flutter pub get` (or `flutter build`) once from `app/`; the Flutter tool writes it |
| `Namespace not specified` | the `namespace` is set in `app/android/app/build.gradle`; make sure you kept it |
| `minSdkVersion 21 cannot be smaller than 23` | Firebase Auth 5.x needs API 23 — `minSdk = 23` is already configured |
| Gradle can't find `google-services.json` | the plugin line must be uncommented **and** the file placed in `app/android/app/` |
| `Execution failed for task ':app:processDebugGoogleServices'` | package name in Firebase ≠ `applicationId` |
| Kotlin/Java version errors | the project uses Java 17 / Kotlin 1.9.24 (`android/settings.gradle`); upgrade with `flutter upgrade` |
