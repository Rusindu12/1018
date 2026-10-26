# Android Build Guide

See docs/SETUP.md for full instructions.

Quick:
```
cd android
./gradlew assembleDebug           # debug APK
./gradlew assembleRelease          # signed if keystore configured
```
Keystore config via `gradle.properties` or env:
```
MYAPP_RELEASE_STORE_FILE=ai-binance.jks
MYAPP_RELEASE_STORE_PASSWORD=***
MYAPP_RELEASE_KEY_ALIAS=aibinance
MYAPP_RELEASE_KEY_PASSWORD=***
```
Never commit keystore or passwords.
