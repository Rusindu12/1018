package com.aibinance.trader.data.models

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PriceTicker(val symbol: String, val price: String)

@JsonClass(generateAdapter = true)
data class CandleDto(
    val open_time: Long, val open: Double, val high: Double, val low: Double,
    val close: Double, val volume: Double, val close_time: Long
)

@JsonClass(generateAdapter = true)
data class SignalDto(
    val symbol: String, val action: String, val confidence: Int,
    val price: Double, val indicators: Map<String, Double>,
    val reasoning: String, val volatility: String, val trend: String,
    val timeframe: String, val generated_at: String, val disclaimer: String
)

@JsonClass(generateAdapter = true)
data class BalanceAssetDto(val asset: String, val free: Double, val locked: Double, val total: Double)

@JsonClass(generateAdapter = true)
data class BalanceResponseDto(val balances: List<BalanceAssetDto>, val total_usdt: Double, val available_usdt: Double, val source: String)

@JsonClass(generateAdapter = true)
data class ConnectionTestDto(val success: Boolean, val can_read: Boolean, val can_trade: Boolean, val has_withdraw_permission: Boolean, val message: String, val permissions: List<String>?)

@JsonClass(generateAdapter = true)
data class TradingModeDto(val mode: String, val auto_trading_enabled: Boolean, val emergency_stop: Boolean, val live_confirmed_at: String?)

@JsonClass(generateAdapter = true)
data class TradingModeUpdateDto(val mode: String, val auto_trading_enabled: Boolean?=null, val confirm_live: Boolean=false, val disclaimer_accepted: Boolean=false)

@JsonClass(generateAdapter = true)
data class RiskSettingDto(val max_trade_amount_usdt: Double, val daily_loss_limit_usdt: Double, val max_open_positions: Int, val cooldown_minutes: Int, val stop_loss_pct: Double, val take_profit_pct: Double, val trailing_stop_pct: Double?, val allowed_symbols: String)

@JsonClass(generateAdapter = true)
data class OrderCreateDto(val symbol: String, val side: String, val order_type: String, val quantity: Double?=null, val quote_order_qty: Double?=null, val price: Double?=null, val stop_loss_pct: Double?=null, val take_profit_pct: Double?=null, val client_order_id: String?=null)

@JsonClass(generateAdapter = true)
data class OrderDto(val id: String, val symbol: String, val side: String, val order_type: String, val quantity: Double, val price: Double?, val executed_price: Double?, val status: String, val mode: String, val client_order_id: String, val binance_order_id: Long?, val fee: Double, val created_at: String)

@JsonClass(generateAdapter = true)
data class PnlDto(val realized_pnl: Double, val unrealized_pnl: Double, val total_fees: Double, val total_trades: Int, val win_rate: Double, val daily_pnl: Double)
