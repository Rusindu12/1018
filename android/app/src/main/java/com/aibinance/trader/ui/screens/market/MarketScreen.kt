package com.aibinance.trader.ui.screens.market

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight

@Composable
fun MarketScreen() {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Markets — Live Prices & Candlesticks", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("WebSocket: wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/ethusdt@kline_1m (proxied via backend)", style = MaterialTheme.typography.bodySmall, color = Color(0xFF848E9C))
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1A2329)), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp)) {
                listOf("BTCUSDT $67,234 +1.2%", "ETHUSDT $3,421 +2.4%", "BNBUSDT $612 -0.3%", "SOLUSDT $142 +3.1%").forEach { t ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(t, color = Color.White)
                        Text(if ("+" in t) "▲" else "▼", color = if ("+" in t) Color(0xFF00C087) else Color.Red)
                    }
                    Divider(color = Color(0xFF2B3A47))
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth().height(200.dp)) {
            Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
                Text("Interactive TradingView-style chart\nTimeframes: 1m 5m 15m 1h 4h 1d\nIndicators toggle: RSI/MACD/BB/EMA", color = Color(0xFFB7BDC6))
            }
        }
    }
}
