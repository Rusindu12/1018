package com.aibinance.trader.utils

import java.text.NumberFormat
import java.util.Locale

fun formatPrice(v: Double): String = NumberFormat.getCurrencyInstance(Locale.US).format(v)
fun formatPct(v: Double): String = String.format(Locale.US, "%.2f%%", v)
fun maskApiKey(key: String): String = if (key.length < 8) "****" else key.take(4) + "****" + key.takeLast(4)
