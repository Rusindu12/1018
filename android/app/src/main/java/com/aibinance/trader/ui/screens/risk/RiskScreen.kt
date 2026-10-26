package com.aibinance.trader.ui.screens.risk

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.font.FontWeight

@Composable
fun RiskScreen() {
    var maxTrade by remember { mutableStateOf("100") }
    var dailyLoss by remember { mutableStateOf("50") }
    var maxPos by remember { mutableStateOf("3") }
    var cooldown by remember { mutableStateOf("15") }
    var sl by remember { mutableStateOf("2") }
    var tp by remember { mutableStateOf("4") }
    var allowed by remember { mutableStateOf("BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT") }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Risk Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("Trading halts when limits reached. Never martingale — size stays fixed.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF848E9C))
        OutlinedTextField(value = maxTrade, onValueChange = { maxTrade = it }, label = { Text("Max Trade (USDT)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = dailyLoss, onValueChange = { dailyLoss = it }, label = { Text("Daily Loss Limit (USDT)") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = maxPos, onValueChange = { maxPos = it }, label = { Text("Max Open Positions") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = cooldown, onValueChange = { cooldown = it }, label = { Text("Cooldown after 3 losses (min)") }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(value = sl, onValueChange = { sl = it }, label = { Text("Stop Loss %") }, modifier = Modifier.weight(1f))
            OutlinedTextField(value = tp, onValueChange = { tp = it }, label = { Text("Take Profit %") }, modifier = Modifier.weight(1f))
        }
        OutlinedTextField(value = allowed, onValueChange = { allowed = it }, label = { Text("Allowed Symbols (comma)") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { /* PUT /api/v1/risk/settings */ }, modifier = Modifier.fillMaxWidth()) { Text("Save Risk Settings") }
        Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF2B1A00))) {
            Column(Modifier.padding(12.dp)) {
                Text("⚠️ You can lose all capital. Past returns ≠ future.", color = Color(0xFFFFB800), style = MaterialTheme.typography.labelSmall)
                Text("Cooldown prevents revenge trading. Daily loss limit stops new positions for the day.", style = MaterialTheme.typography.bodySmall, color = Color(0xFFFFE9A6))
            }
        }
    }
}
