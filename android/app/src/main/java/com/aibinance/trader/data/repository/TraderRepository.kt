package com.aibinance.trader.data.repository

import com.aibinance.trader.data.api.ApiService
import com.aibinance.trader.data.models.*

class TraderRepository(private val api: ApiService) {
    suspend fun login(email: String, password: String) = api.login(mapOf("email" to email, "password" to password))
    suspend fun saveCredentials(apiKey: String, apiSecret: String, isTestnet: Boolean) =
        api.saveCredentials(mapOf("api_key" to apiKey, "api_secret" to apiSecret, "is_testnet" to isTestnet))
    suspend fun testConnection() = api.testConnection()
    suspend fun getBalances() = api.getBalances()
    suspend fun getSignal(symbol: String) = api.getSignal(symbol)
    suspend fun getSignals(symbols: String) = api.getSignals(symbols)
    suspend fun getKlines(symbol: String, interval: String="1h") = api.getKlines(symbol, interval)
    suspend fun getTradingMode() = api.getTradingMode()
    suspend fun updateTradingMode(body: TradingModeUpdateDto) = api.updateTradingMode(body)
    suspend fun emergencyStop() = api.emergencyStop()
    suspend fun clearStop() = api.clearEmergencyStop()
    suspend fun createOrder(body: OrderCreateDto) = api.createOrder(body)
    suspend fun getOrders() = api.getOrders()
    suspend fun getPnl() = api.getPnl()
    suspend fun getRiskSettings() = api.getRiskSettings()
    suspend fun updateRiskSettings(body: RiskSettingDto) = api.updateRiskSettings(body)
}
