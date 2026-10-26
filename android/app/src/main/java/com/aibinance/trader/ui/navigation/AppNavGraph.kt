package com.aibinance.trader.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aibinance.trader.ui.screens.dashboard.DashboardScreen
import com.aibinance.trader.ui.screens.market.MarketScreen
import com.aibinance.trader.ui.screens.signals.SignalsScreen
import com.aibinance.trader.ui.screens.orders.OrdersScreen
import com.aibinance.trader.ui.screens.portfolio.PortfolioScreen
import com.aibinance.trader.ui.screens.settings.SettingsScreen
import com.aibinance.trader.ui.screens.risk.RiskScreen

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Dashboard : Screen("dashboard", "Dashboard", Icons.Filled.Dashboard)
    data object Market : Screen("market", "Markets", Icons.Filled.CandlestickChart)
    data object Signals : Screen("signals", "AI Signals", Icons.Filled.AutoAwesome)
    data object Orders : Screen("orders", "Orders", Icons.Filled.ReceiptLong)
    data object Portfolio : Screen("portfolio", "P&L", Icons.Filled.AccountBalanceWallet)
    data object Risk : Screen("risk", "Risk", Icons.Filled.Shield)
    data object Settings : Screen("settings", "Settings", Icons.Filled.Settings)
}

@Composable
fun AppNavGraph() {
    val nav = rememberNavController()
    val items = listOf(Screen.Dashboard, Screen.Market, Screen.Signals, Screen.Orders, Screen.Portfolio, Screen.Risk, Screen.Settings)
    Scaffold(
        bottomBar = {
            NavigationBar {
                val cur by nav.currentBackStackEntryAsState()
                val route = cur?.destination?.route
                items.forEach { s ->
                    NavigationBarItem(
                        selected = route == s.route,
                        onClick = { nav.navigate(s.route) { launchSingleTop = true } },
                        icon = { Icon(s.icon, contentDescription = s.label) },
                        label = { Text(s.label) }
                    )
                }
            }
        }
    ) { pad ->
        NavHost(navController = nav, startDestination = Screen.Dashboard.route, modifier = Modifier.padding(pad)) {
            composable(Screen.Dashboard.route) { DashboardScreen(nav) }
            composable(Screen.Market.route) { MarketScreen() }
            composable(Screen.Signals.route) { SignalsScreen() }
            composable(Screen.Orders.route) { OrdersScreen() }
            composable(Screen.Portfolio.route) { PortfolioScreen() }
            composable(Screen.Risk.route) { RiskScreen() }
            composable(Screen.Settings.route) { SettingsScreen() }
        }
    }
}
