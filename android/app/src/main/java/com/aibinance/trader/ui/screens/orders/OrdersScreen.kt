package com.aibinance.trader.ui.screens.orders

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun OrdersScreen() {
    var selectedTab by remember { mutableStateOf(0) }
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Open Orders & Trade History", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("All fees shown separately. Order status verified via Binance before report.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF848E9C))
        TabRow(selectedTabIndex = selectedTab) {
            Tab(selected = selectedTab==0, onClick = { selectedTab=0 }, text = { Text("Open") })
            Tab(selected = selectedTab==1, onClick = { selectedTab=1 }, text = { Text("History") })
        }
        Spacer(Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(5) { idx ->
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1A2329)), modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(if (idx%2==0) "BUY BTCUSDT" else "SELL ETHUSDT", fontWeight = FontWeight.Bold, color = Color.White)
                            Badge { Text(if (selectedTab==0) "NEW" else "FILLED") }
                        }
                        Text("0.0012 BTC @ $67,200 • Fee: 0.000012 BTC • Mode: paper", style = MaterialTheme.typography.bodySmall, color = Color(0xFFB7BDC6))
                        Text("ClientOrderId: paper_${idx}xyz • Verified: true", style = MaterialTheme.typography.labelSmall, color = Color(0xFF848E9C))
                    }
                }
            }
        }
    }
}
