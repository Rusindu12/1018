package com.aibinance.trader.data.api

import com.aibinance.trader.data.models.*
import retrofit2.http.*

interface ApiService {
    @POST("api/v1/auth/register")
    suspend fun register(@Body body: Map<String,String>): Map<String,Any>
    @POST("api/v1/auth/login")
    suspend fun login(@Body body: Map<String,String>): Map<String,Any>

    @GET("api/v1/market/prices")
    suspend fun getPrices(@Query("symbols") symbols: String): Map<String,Any>
    @GET("api/v1/market/klines/{symbol}")
    suspend fun getKlines(@Path("symbol") symbol: String, @Query("interval") interval: String = "1h", @Query("limit") limit: Int = 100): Map<String,Any>
    @GET("api/v1/market/indicators/{symbol}")
    suspend fun getIndicators(@Path("symbol") symbol: String, @Query("interval") interval: String = "1h"): Map<String,Any>
    @GET("api/v1/market/signals/{symbol}")
    suspend fun getSignal(@Path("symbol") symbol: String, @Query("interval") interval: String = "1h"): SignalDto
    @GET("api/v1/market/signals")
    suspend fun getSignals(@Query("symbols") symbols: String, @Query("interval") interval: String = "1h"): Map<String,Any>

    @POST("api/v1/binance/credentials")
    suspend fun saveCredentials(@Body body: Map<String,Any>): Map<String,Any>
    @POST("api/v1/binance/test-connection")
    suspend fun testConnection(): ConnectionTestDto
    @GET("api/v1/binance/balances")
    suspend fun getBalances(): BalanceResponseDto

    @GET("api/v1/trading/mode")
    suspend fun getTradingMode(): TradingModeDto
    @PUT("api/v1/trading/mode")
    suspend fun updateTradingMode(@Body body: TradingModeUpdateDto): TradingModeDto
    @POST("api/v1/trading/emergency-stop")
    suspend fun emergencyStop(): Map<String,Any>
    @POST("api/v1/trading/emergency-stop/clear")
    suspend fun clearEmergencyStop(): Map<String,Any>
    @POST("api/v1/trading/orders")
    suspend fun createOrder(@Body body: OrderCreateDto): OrderDto
    @GET("api/v1/trading/orders")
    suspend fun getOrders(@Query("symbol") symbol: String? = null, @Query("limit") limit: Int = 50): List<OrderDto>
    @GET("api/v1/trading/pnl")
    suspend fun getPnl(): PnlDto

    @GET("api/v1/risk/settings")
    suspend fun getRiskSettings(): RiskSettingDto
    @PUT("api/v1/risk/settings")
    suspend fun updateRiskSettings(@Body body: RiskSettingDto): RiskSettingDto
}
