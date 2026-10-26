package com.aibinance.trader.ui.screens.portfolio

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aibinance.trader.data.repository.TraderRepository
import kotlinx.coroutines.launch

class PortfolioViewModel(private val repo: TraderRepository) : ViewModel() {
    var pnl by mutableStateOf<com.aibinance.trader.data.models.PnlDto?>(null)
    fun load() { viewModelScope.launch { pnl = try { repo.getPnl() } catch (e: Exception) { null } } }
}

@Composable
fun PortfolioScreen(vm: PortfolioViewModel = org.koin.androidx.compose.koinViewModel()) {
    LaunchedEffect(Unit) { vm.load() }
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Profit & Loss", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("Fees separated from P&L. Values from backend — not fabricated.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF848E9C))
        val pnl = vm.pnl
        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2329))) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat("Realized", pnl?.realized_pnl?.let { "$${it}" } ?: "--", if ((pnl?.realized_pnl ?: 0.0) >=0) Color(0xFF00C087) else Color.Red)
                    Stat("Unrealized", pnl?.unrealized_pnl?.let { "$${it}" } ?: "--", if ((pnl?.unrealized_pnl ?:0.0) >=0) Color(0xFF00C087) else Color.Red)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat("Fees Paid", pnl?.total_fees?.let { "$${it}" } ?: "--", Color(0xFF848E9C))
                    Stat("Win Rate", pnl?.win_rate?.let { "${String.format("%.1f", it*100)}%" } ?: "--", Color.White)
                }
                Divider(color = Color(0xFF2B3A47))
                Text("Total Trades: ${pnl?.total_trades ?: 0} • Daily P&L: $${pnl?.daily_pnl ?: 0}", style = MaterialTheme.typography.bodySmall)
                Button(onClick = { vm.load() }) { Text("Refresh") }
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String, color: Color) {
    Column { Text(label, style = MaterialTheme.typography.labelSmall, color = Color(0xFF848E9C)); Text(value, fontWeight = FontWeight.Bold, color = color) }
}
