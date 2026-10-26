package com.aibinance.trader.ui.screens.dashboard

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavHostController
import com.aibinance.trader.data.local.SecureStore
import com.aibinance.trader.data.models.SignalDto
import com.aibinance.trader.data.repository.TraderRepository
import com.aibinance.trader.ui.components.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.koin.androidx.compose.koinViewModel

class DashboardViewModel(private val repo: TraderRepository, private val store: SecureStore) : ViewModel() {
    var balances by mutableStateOf<com.aibinance.trader.data.models.BalanceResponseDto?>(null)
    var signals by mutableStateOf<List<SignalDto>>(emptyList())
    var mode by mutableStateOf<com.aibinance.trader.data.models.TradingModeDto?>(null)
    var pnl by mutableStateOf<com.aibinance.trader.data.models.PnlDto?>(null)
    var loading by mutableStateOf(true)
    var error by mutableStateOf<String?>(null)
    var isAutoOn by mutableStateOf(false)
    var emergencyStop by mutableStateOf(false)
    var selectedSymbol by mutableStateOf("BTCUSDT")

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            loading = true; error = null
            try {
                balances = try { repo.getBalances() } catch (e: Exception) { null }
                mode = try { repo.getTradingMode() } catch (e: Exception) { null }
                emergencyStop = mode?.emergency_stop == true
                isAutoOn = mode?.auto_trading_enabled == true
                selectedSymbol = store.getSelectedSymbol()
                // Signals
                val sigs = try { repo.getSignals("BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT") } catch (e: Exception) { emptyMap<String,Any>() }
                // Parse generically
                pnl = try { repo.getPnl() } catch (e: Exception) { null }
            } catch (e: Exception) { error = e.message }
            loading = false
        }
    }

    fun toggleAuto(enabled: Boolean) {
        viewModelScope.launch {
            try {
                val cur = repo.getTradingMode()
                repo.updateTradingMode(com.aibinance.trader.data.models.TradingModeUpdateDto(mode = cur.mode, auto_trading_enabled = enabled))
                isAutoOn = enabled
            } catch (e: Exception) { error = e.message }
        }
    }
    fun emergencyStopNow() {
        viewModelScope.launch {
            try { repo.emergencyStop(); emergencyStop = true } catch (e: Exception) { error = e.message }
        }
    }
    fun clearStop() {
        viewModelScope.launch {
            try { repo.clearStop(); emergencyStop = false } catch (e: Exception) { error = e.message }
        }
    }
}

@Composable
fun DashboardScreen(nav: NavHostController, vm: DashboardViewModel = koinViewModel()) {
    val symbols = listOf("BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT")
    var selected by remember { mutableStateOf(vm.selectedSymbol) }

    LazyColumn(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { RiskWarningBanner() }
        item {
            EmergencyStopBar(isArmed = vm.emergencyStop, onStop = { vm.emergencyStopNow() }, onClear = { vm.clearStop() })
        }
        item {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("AI Binance Trader", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold)
                ConnectionBadge(connected = vm.balances != null, source = vm.balances?.source)
            }
            Text("Paper Trading • Testnet default • Never share withdrawal keys", style = MaterialTheme.typography.labelSmall, color = Color(0xFF848E9C))
        }
        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF1A2329)), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(14.dp)) {
                    Text("Account Balance", style = MaterialTheme.typography.titleSmall, color = Color(0xFF848E9C))
                    val bal = vm.balances
                    if (bal != null) {
                        Text("$${String.format("%.2f", bal.available_usdt)} USDT available", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("Total: $${String.format("%.2f", bal.total_usdt)} • Source: ${bal.source}", style = MaterialTheme.typography.bodySmall)
                        // Asset chips
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            bal.balances.forEach { a ->
                                AssistChip(onClick = {}, label = { Text("${a.asset}: ${String.format("%.4f", a.free)}") })
                            }
                        }
                    } else {
                        Text("No balance yet — configure Binance API in Settings → Test Connection.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        item {
            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFF1E2C1B))) {
                Column(Modifier.padding(14.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Auto Trading", fontWeight = FontWeight.Bold)
                        Switch(checked = vm.isAutoOn, onCheckedChange = { vm.toggleAuto(it) })
                    }
                    Text("Mode: ${vm.mode?.mode ?: "paper"} • Auto executes only when risk limits pass.", style = MaterialTheme.typography.bodySmall)
                    if (vm.mode?.mode == "live_auto") Text("⚡ Live Auto — real funds! Emergency STOP always visible.", color = Color(0xFFFFB800), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.horizontalScroll(rememberScrollState())) {
                symbols.forEach { s ->
                    FilterChip(selected = selected==s, onClick = { selected = s }, label = { Text(s) })
                }
            }
        }
        // Live price & sparkline placeholder
        item {
            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFF232E38))) {
                Column(Modifier.padding(12.dp)) {
                    Text("$selected • 1h Candlesticks (live via WebSocket)", style = MaterialTheme.typography.titleSmall)
                    // In production: Vico/MPAndroidChart candlesticks fed by repo.getKlines + WebSocket stream
                    Box(Modifier.fillMaxWidth().height(160.dp).padding(8.dp), contentAlignment = androidx.compose.ui.Alignment.Center) {
                        Text("📈 Candlestick Chart — connect to /api/v1/market/ws for realtime ticks\n(Pinched-zoom, crosshair & indicators overlay)", color = Color(0xFFB7BDC6), style = MaterialTheme.typography.bodySmall)
                    }
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Text("RSI • MACD • EMA • Bollinger • Volume", style = MaterialTheme.typography.labelSmall)
                        TextButton(onClick = { vm.refresh() }) { Text("Refresh") }
                    }
                }
            }
        }
        item {
            Text("AI Signals", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        }
        // Example signal cards (wire to real API)
        item {
            SignalCard(symbol = "BTCUSDT", action = "HOLD", confidence = 42, price = 67234.5, volatility = "moderate", trend = "sideways", reasoning = "Trend is sideways (EMA20 67100 vs EMA50 67050). RSI 52 neutral. MACD histogram -0.12 bearish. Price within Bollinger Bands. Volume 0.9x. Composite score +6 below threshold — HOLD.")
        }
        item {
            SignalCard(symbol = "ETHUSDT", action = "BUY", confidence = 68, price = 3421.1, volatility = "moderate", trend = "strong_uptrend", reasoning = "Trend is strong uptrend (EMA20 3400 > EMA50 3350). RSI 58 neutral. MACD histogram +1.2 bullish momentum. Price above EMA200 support. Volume 1.6x confirms move. Composite score +22 suggests accumulation — consider BUY with strict stop-loss.")
        }
        item {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text("P&L Dashboard", style = MaterialTheme.typography.titleSmall)
                    val pnl = vm.pnl
                    if (pnl != null) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column { Text("Realized", style = MaterialTheme.typography.labelSmall); Text("$${pnl.realized_pnl}", color = if (pnl.realized_pnl>=0) Color(0xFF00C087) else Color.Red, fontWeight = FontWeight.Bold) }
                            Column { Text("Unrealized", style = MaterialTheme.typography.labelSmall); Text("$${pnl.unrealized_pnl}", color = if (pnl.unrealized_pnl>=0) Color(0xFF00C087) else Color.Red) }
                            Column { Text("Fees", style = MaterialTheme.typography.labelSmall); Text("$${pnl.total_fees}", color = Color(0xFF848E9C)) }
                            Column { Text("Win Rate", style = MaterialTheme.typography.labelSmall); Text("${String.format("%.1f", pnl.win_rate*100)}%", fontWeight = FontWeight.Bold) }
                        }
                    } else {
                        Text("P&L loads after first trade. Fees shown separately.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
        item {
            if (vm.error != null) Text("Error: ${vm.error}", color = Color.Red, style = MaterialTheme.typography.bodySmall)
            if (vm.loading) LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
        }
    }
}
