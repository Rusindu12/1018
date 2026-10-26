package com.aibinance.trader.di

import com.aibinance.trader.BuildConfig
import com.aibinance.trader.data.api.ApiService
import com.aibinance.trader.data.local.SecureStore
import com.aibinance.trader.data.repository.TraderRepository
import com.aibinance.trader.ui.screens.dashboard.DashboardViewModel
import com.aibinance.trader.ui.screens.settings.SettingsViewModel
import com.aibinance.trader.ui.screens.portfolio.PortfolioViewModel
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

val appModule = module {
    single { SecureStore(get()) }

    single {
        val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val req = chain.request().newBuilder()
                    .header("Accept", "application/json")
                    // JWT injected via interceptor reading SecureStore — never log raw secret
                    .build()
                chain.proceed(req)
            }
            .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            .build()
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(ApiService::class.java)
    }

    single { TraderRepository(get()) }

    viewModel { DashboardViewModel(get(), get()) }
    viewModel { SettingsViewModel(get(), get()) }
    viewModel { PortfolioViewModel(get()) }
}
