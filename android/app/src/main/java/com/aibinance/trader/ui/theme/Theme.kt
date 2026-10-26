package com.aibinance.trader.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFFF3BA2F), // Binance yellow
    onPrimary = Color(0xFF1A1A1A),
    primaryContainer = Color(0xFF2A2300),
    secondary = Color(0xFF00C087), // profit green
    error = Color(0xFFFF3B30),
    background = Color(0xFF0E141B),
    surface = Color(0xFF1A2329),
    surfaceVariant = Color(0xFF232E38),
    onSurface = Color(0xFFEAECEF),
    outline = Color(0xFF2B3A47)
)

private val LightColorScheme = lightColorScheme(
    primary = Color(0xFFF3BA2F),
    secondary = Color(0xFF00C087),
    background = Color(0xFFFAFAFA),
    surface = Color.White
)

val AIBinanceTypography = Typography(
    headlineLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 28.sp, letterSpacing = (-0.5).sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, color = Color(0xFFB7BDC6)),
    labelSmall = TextStyle(fontSize = 11.sp, letterSpacing = 0.5.sp, fontWeight = FontWeight.Medium)
)

val AIBinanceShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp)
)

@Composable
fun AIBinanceTraderTheme(
    darkTheme: Boolean = true, // force dark for trading dashboard
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(colorScheme = colorScheme, typography = AIBinanceTypography, shapes = AIBinanceShapes, content = content)
}
