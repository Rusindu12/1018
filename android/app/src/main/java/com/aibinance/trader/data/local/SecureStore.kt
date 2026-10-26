package com.aibinance.trader.data.local

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("ai_binance_prefs")

class SecureStore(private val context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val encryptedPrefs by lazy {
        EncryptedSharedPreferences.create(
            context, "secure_prefs", masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    companion object Keys {
        val TOKEN = stringPreferencesKey("jwt_token")
        val API_BASE = stringPreferencesKey("api_base")
        val TRADING_MODE = stringPreferencesKey("trading_mode")
        val SELECTED_SYMBOL = stringPreferencesKey("selected_symbol")
    }

    suspend fun saveToken(token: String) {
        context.dataStore.edit { it[TOKEN] = token }
    }
    suspend fun getToken(): String? = context.dataStore.data.map { it[TOKEN] }.first()
    suspend fun saveTradingMode(mode: String) = context.dataStore.edit { it[TRADING_MODE]=mode }
    suspend fun getTradingMode(): String = context.dataStore.data.map { it[TRADING_MODE] ?: "paper" }.first()
    suspend fun saveSelectedSymbol(sym: String) = context.dataStore.edit { it[SELECTED_SYMBOL]=sym }
    suspend fun getSelectedSymbol(): String = context.dataStore.data.map { it[SELECTED_SYMBOL] ?: "BTCUSDT" }.first()

    // Encrypted API credentials are NOT stored locally — only backend holds encrypted secrets.
    // JWT is stored in EncryptedSharedPreferences for extra protection.
    fun saveJwtSecure(token: String) { encryptedPrefs.edit().putString("jwt_secure", token).apply() }
    fun getJwtSecure(): String? = encryptedPrefs.getString("jwt_secure", null)
}
