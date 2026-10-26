# Keep models for Moshi
-keep class com.aibinance.trader.data.models.** { *; }
-keepclasseswithmembers class * {
    @com.squareup.moshi.Json *;
}
# Security: obfuscate but don't expose secrets
