package com.aibinance.trader.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun RiskWarningBanner() {
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF3A2500)), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text("⚠️ Risk Warning", style = MaterialTheme.typography.labelSmall, color = Color(0xFFFFB800))
            Text("Crypto trading can result in total loss of capital. AI signals are not financial advice.", style = MaterialTheme.typography.bodySmall, color = Color(0xFFFFE9A6))
        }
    }
}

@Composable
fun EmergencyStopBar(isArmed: Boolean, onStop: () -> Unit, onClear: () -> Unit) {
    if (isArmed) {
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF4A0000)), modifier = Modifier.fillMaxWidth().padding(8.dp)) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f)) { Text("🛑 EMERGENCY STOP ACTIVE", color = Color.White, fontWeight = FontWeight.Bold); Text("New auto orders blocked.", style = MaterialTheme.typography.bodySmall, color = Color(0xFFFFC2C2)) }
                Button(colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Color.Red), onClick = onClear) { Text("Clear") }
            }
        }
    } else {
        Button(
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFCF142B), contentColor = Color.White),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            onClick = onStop
        ) { Text("🛑 EMERGENCY STOP — Halt Auto Trading", fontWeight = FontWeight.ExtraBold) }
    }
}

@Composable
fun ConnectionBadge(connected: Boolean, source: String?) {
    val color = if (connected) Color(0xFF00C087) else Color(0xFFFF3B30)
    AssistChip(onClick = {}, label = { Text(if (connected) "● Binance Connected (${source ?: "live"})" else "○ Disconnected") }, colors = AssistChipDefaults.assistChipColors(labelColor = color))
}

@Composable
fun SignalCard(symbol: String, action: String, confidence: Int, reasoning: String, volatility: String, trend: String, price: Double) {
    val color = when (action) { "BUY" -> Color(0xFF00C087); "SELL" -> Color(0xFFFF3B30); else -> Color(0xFF848E9C) }
    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2A34)), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(symbol, style = MaterialTheme.typography.titleMedium, color = Color.White)
                Badge(containerColor = color) { Text(action, color = Color.White, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) }
            }
            Spacer(Modifier.height(6.dp))
            Text("Price: $${String.format("%.2f", price)}", color = Color(0xFFEAECEF))
            Text("Confidence: $confidence/100 — $volatility volatility • ${trend.replace("_"," ")}", style = MaterialTheme.typography.bodySmall, color = Color(0xFFB7BDC6))
            Divider(Modifier.padding(vertical=8.dp), color = Color(0xFF2B3A47))
            Text(reasoning, style = MaterialTheme.typography.bodySmall, color = Color(0xFFD0D6DC))
            Text("AI confidence is not a guarantee of profit. Verify before trading.", style = MaterialTheme.typography.labelSmall, color = Color(0xFF848E9C), modifier = Modifier.padding(top=6.dp))
        }
    }
}
