package com.aibinance.trader.ui.screens.signals

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.graphics.Color
import com.aibinance.trader.ui.components.SignalCard

@Composable
fun SignalsScreen() {
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("AI BUY / SELL / HOLD Signals", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold) }
        item { Text("Indicators: RSI(14), MACD(12,26,9), EMA(20/50/200), SMA(20/50), Bollinger(20,2), ATR, Volume. Confidence 0-100 reflects indicator agreement, not P(profit).", style = MaterialTheme.typography.bodySmall, color = Color(0xFF848E9C)) }
        item { SignalCard("BTCUSDT","BUY",72,67234.0,"moderate","strong_uptrend","RSI 43.2, MACD +12.3 bullish, EMA20>EMA50>EMA200, BB 2.1% width, volume 1.4x — BUY bias. Use stop-loss 2% below entry.") }
        item { SignalCard("ETHUSDT","SELL",65,3420.0,"high","downtrend","RSI 71 overbought, MACD -5.1 bearish cross, price at upper BB, high volatility ATR 2.8% — consider SELL/reduce. Never increase size to recover losses.") }
        item { SignalCard("BNBUSDT","HOLD",38,610.0,"low","sideways","Sideways range, low vol, RSI 50 neutral — wait for breakout. HOLD.") }
        item { Card { Column(Modifier.padding(12.dp)) { Text("How confidence is computed", style = MaterialTheme.typography.titleSmall); Text("Composite score from 5 indicator groups (RSI, MACD, EMA, BB, Volume) with volatility penalty. HOLD threshold |score|<12. Capped at 72 in high-vol. Not calibrated as probability — validated via backtest in backend tests.", style = MaterialTheme.typography.bodySmall) } } }
    }
}
