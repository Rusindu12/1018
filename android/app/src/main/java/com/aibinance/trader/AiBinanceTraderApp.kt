package com.aibinance.trader

import android.app.Application
import com.aibinance.trader.di.appModule
import org.koin.android.ext.koin.androidContext
import org.koin.core.context.startKoin

class AiBinanceTraderApp : Application() {
    override fun onCreate() {
        super.onCreate()
        startKoin {
            androidContext(this@AiBinanceTraderApp)
            modules(appModule)
        }
    }
}
