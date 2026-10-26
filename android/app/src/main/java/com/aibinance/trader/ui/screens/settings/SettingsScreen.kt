package com.aibinance.trader.ui.screens.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aibinance.trader.data.local.SecureStore
import com.aibinance.trader.data.models.TradingModeUpdateDto
import com.aibinance.trader.data.repository.TraderRepository
import kotlinx.coroutines.launch

class SettingsViewModel(private val repo: TraderRepository, private val store: SecureStore) : ViewModel() {
    var apiKey by mutableStateOf("")
    var apiSecret by mutableStateOf("")
    var isTestnet by mutableStateOf(true)
    var connectionResult by mutableStateOf<String?>(null)
    var tradingMode by mutableStateOf("paper")
    var autoOn by mutableStateOf(false)
    var showLiveConfirm by mutableStateOf(false)
    var balanceText by mutableStateOf<String?>(null)
    var pair by mutableStateOf("BTCUSDT")

    fun saveCreds() {
        viewModelScope.launch {
            try {
                repo.saveCredentials(apiKey.trim(), apiSecret.trim(), isTestnet)
                connectionResult = "Credentials saved (encrypted on server). Now tap Test Connection."
            } catch (e: Exception) { connectionResult = "Save failed: ${e.message}" }
        }
    }
    fun testConnection() {
        viewModelScope.launch {
            try {
                val res = repo.testConnection()
                connectionResult = if (res.success) "✅ ${res.message}" else "❌ ${res.message}"
                val bal = repo.getBalances()
                balanceText = "Available: $${bal.available_usdt} USDT • Source: ${bal.source}"
            } catch (e: Exception) { connectionResult = "❌ ${e.message}" }
        }
    }
    fun changeMode(newMode: String, confirmLive: Boolean=false) {
        viewModelScope.launch {
            try {
                val updated = repo.updateTradingMode(TradingModeUpdateDto(mode=newMode, auto_trading_enabled = autoOn, confirm_live = confirmLive, disclaimer_accepted = confirmLive))
                tradingMode = updated.mode; autoOn = updated.auto_trading_enabled
                store.saveTradingMode(newMode)
                connectionResult = "Mode → ${updated.mode.uppercase()} (Auto=${updated.auto_trading_enabled})"
            } catch (e: Exception) { connectionResult = "Mode change failed: ${e.message}" }
        }
    }
}

@Composable
fun SettingsScreen(vm: SettingsViewModel = org.koin.androidx.compose.koinViewModel()) {
    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color(0xFF1A2329))) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Binance API (Spot Trading only)", fontWeight = FontWeight.Bold)
                Text("Never enable Withdrawal. Keys are encrypted server-side, never in APK/logs/AI.", style = MaterialTheme.typography.bodySmall, color = Color(0xFF848E9C))
                OutlinedTextField(value = vm.apiKey, onValueChange = { vm.apiKey = it }, label = { Text("API Key") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(value = vm.apiSecret, onValueChange = { vm.apiSecret = it }, label = { Text("API Secret") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Testnet Mode"); Switch(checked = vm.isTestnet, onCheckedChange = { vm.isTestnet = it })
                }
                Button(onClick = { vm.saveCreds() }, modifier = Modifier.fillMaxWidth()) { Text("Save & Encrypt on Server") }
                Button(onClick = { vm.testConnection() }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C087))) { Text("🔗 Test Connection + Fetch Balance") }
                if (vm.connectionResult != null) Text(vm.connectionResult!!, color = if (vm.connectionResult!!.startsWith("✅")) Color(0xFF00C087) else Color(0xFFFFB800), style = MaterialTheme.typography.bodySmall)
                if (vm.balanceText != null) Text(vm.balanceText!!, style = MaterialTheme.typography.bodySmall, color = Color.White)
                // Pair selection
                Divider(color = Color(0xFF2B3A47))
                Text("Default Trading Pair", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT").forEach { p ->
                        FilterChip(selected = vm.pair==p, onClick = { vm.pair=p }, label = { Text(p) })
                    }
                }
            }
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Trading Mode", fontWeight = FontWeight.Bold)
                Text("Paper (default, no real money) → Manual (you approve) → Live Auto (backend executes after consent + risk).", style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ChoiceChip("Paper", vm.tradingMode=="paper") { vm.changeMode("paper") }
                    ChoiceChip("Manual", vm.tradingMode=="manual") { vm.changeMode("manual") }
                    ChoiceChip("Live Auto", vm.tradingMode=="live_auto") { vm.showLiveConfirm = true }
                }
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Auto Trading ON/OFF"); Switch(checked = vm.autoOn, onCheckedChange = { vm.autoOn = it; vm.changeMode(vm.tradingMode) })
                }
                if (vm.showLiveConfirm) {
                    Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF4A0000))) {
                        Column(Modifier.padding(12.dp)) {
                            Text("⚠️ Enable Live Auto Trading?", fontWeight = FontWeight.Bold, color = Color.White)
                            Text("This will place REAL Binance Spot orders with real money. You must set risk limits and accept that you can lose all capital. Confirmation valid 24h.", style = MaterialTheme.typography.bodySmall, color = Color(0xFFFFC2C2))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().padding(top=8.dp)) {
                                Button(colors = ButtonDefaults.buttonColors(containerColor = Color.Red), onClick = { vm.changeMode("live_auto", confirmLive=true); vm.showLiveConfirm=false }, modifier = Modifier.weight(1f)) { Text("I Understand — Enable Live") }
                                OutlinedButton(onClick = { vm.showLiveConfirm=false }, modifier = Modifier.weight(1f)) { Text("Cancel", color = Color.White) }
                            }
                        }
                    }
                }
                Text("Current: ${vm.tradingMode} • Auto=${vm.autoOn}", style = MaterialTheme.typography.labelSmall)
            }
        }
        Text("Notifications: Order fills, errors & risk-limit events via in-app + FCM", style = MaterialTheme.typography.bodySmall, color = Color(0xFF848E9C))
        Text("Security: Secrets stored encrypted on backend, signed requests never leave server. HTTPS + JWT + input validation. See docs/SECURITY.md", style = MaterialTheme.typography.labelSmall, color = Color(0xFF848E9C))
    }
}

@Composable private fun ChoiceChip(label: String, selected: Boolean, onClick: ()->Unit) {
    FilterChip(selected = selected, onClick = onClick, label = { Text(label) }, colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Color(0xFFF3BA2F), selectedLabelColor = Color.Black))
}
