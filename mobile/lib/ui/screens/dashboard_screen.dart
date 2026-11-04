import 'package:flutter/material.dart';

import '../../models/market_models.dart';
import '../../state/trading_controller.dart';
import '../app_theme.dart';
import '../formatters.dart';
import '../widgets/section_card.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({required this.controller, super.key});

  final TradingController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Binance AI Desk'),
            SizedBox(height: 2),
            Text('MARKET OVERVIEW', style: TextStyle(color: AppColors.muted, fontSize: 10, letterSpacing: 1.4)),
          ],
        ),
        actions: [
          AnimatedBuilder(
            animation: controller,
            builder: (context, _) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(child: _EnvironmentPill(testnet: controller.settings.testnet)),
            ),
          ),
          IconButton(
            tooltip: 'Refresh account and markets',
            onPressed: controller.refreshDashboard,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          final portfolio = controller.portfolio;
          return RefreshIndicator(
            onRefresh: controller.refreshDashboard,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
              children: [
                if (controller.settings.testnet) const _TestnetBanner(),
                if (controller.dailyLossLimitReached) ...[
                  const SizedBox(height: 12),
                  const _RiskWarning(),
                ],
                const SizedBox(height: 12),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Estimated account value',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.muted),
                            ),
                          ),
                          _ModePill(label: controller.settings.marketType.label),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        portfolio != null
                            ? formatMoney(portfolio.totalValueUsdt)
                            : controller.isPortfolioLoading
                                ? 'Loading account…'
                                : controller.hasApiCredentials
                                    ? '—'
                                    : 'Connect an API key',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      if (portfolio != null) ...[
                        const SizedBox(height: 14),
                        const Divider(height: 1),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _Metric(
                                label: portfolio.isFutures ? 'Unrealized P&L' : 'PnL tracking',
                                value: portfolio.isFutures ? formatMoney(portfolio.unrealizedPnlUsdt) : 'Cost basis needed',
                                valueColor: _pnlColor(portfolio.unrealizedPnlUsdt),
                              ),
                            ),
                            Expanded(
                              child: _Metric(
                                label: portfolio.isFutures ? 'Today (UTC)*' : 'Available balance',
                                value: portfolio.isFutures
                                    ? formatMoney(portfolio.dailyPnlUsdt)
                                    : formatMoney(portfolio.availableBalanceUsdt),
                                valueColor: _pnlColor(portfolio.dailyPnlUsdt),
                              ),
                            ),
                          ],
                        ),
                        if (portfolio.isFutures) ...[
                          const SizedBox(height: 8),
                          const Text(
                            '*Daily risk metric = realized P&L, commissions and funding since 00:00 UTC, plus current unrealized P&L.',
                            style: TextStyle(color: AppColors.muted, fontSize: 11),
                          ),
                          if (portfolio.dailyPnlUsdt == null) ...[
                            const SizedBox(height: 6),
                            const Text('Daily P&L is unavailable; Futures orders are blocked until the loss guard can be verified.', style: TextStyle(color: AppColors.red, fontSize: 11)),
                          ],
                        ] else if (portfolio.unpricedAssetCount > 0) ...[
                          const SizedBox(height: 8),
                          Text(
                            '${portfolio.unpricedAssetCount} wallet asset(s) have no direct USDT price and are excluded from the estimate.',
                            style: const TextStyle(color: AppColors.muted, fontSize: 11),
                          ),
                        ],
                      ] else if (!controller.hasApiCredentials) ...[
                        const SizedBox(height: 6),
                        const Text(
                          'Public market data works without credentials. Add a restricted key in Settings to view your private account.',
                          style: TextStyle(color: AppColors.muted, height: 1.4),
                        ),
                      ] else if (controller.portfolioError != null) ...[
                        const SizedBox(height: 8),
                        Text(controller.portfolioError!, style: const TextStyle(color: AppColors.red)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                SectionHeading(
                  'Markets',
                  trailing: TextButton.icon(
                    onPressed: () => controller.refreshMarketData(),
                    icon: const Icon(Icons.show_chart_rounded, size: 18),
                    label: const Text('Analysis'),
                  ),
                ),
                const SizedBox(height: 10),
                SectionCard(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                  child: Column(
                    children: [
                      for (var index = 0; index < controller.watchlist.length; index++) ...[
                        _MarketRow(
                          symbol: controller.watchlist[index],
                          ticker: controller.prices[controller.watchlist[index]],
                          selected: controller.settings.symbol == controller.watchlist[index],
                          onTap: () => controller.selectSymbol(controller.watchlist[index]),
                        ),
                        if (index < controller.watchlist.length - 1) const Divider(height: 1),
                      ],
                    ],
                  ),
                ),
                if (controller.marketError != null) ...[
                  const SizedBox(height: 10),
                  Text(controller.marketError!, style: const TextStyle(color: AppColors.red)),
                ],
                const SizedBox(height: 20),
                SectionCard(
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(color: AppColors.mint.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
                        child: const Icon(Icons.auto_awesome_rounded, color: AppColors.mint),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Local AI analysis', style: TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 3),
                            Text(
                              controller.analysis == null
                                  ? 'Gathering candles for ${controller.settings.symbol}'
                                  : '${controller.analysis!.direction.label} · ${formatPercent(controller.analysis!.confidence)} confidence',
                              style: const TextStyle(color: AppColors.muted, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  static Color _pnlColor(double? value) {
    if (value == null || value == 0) return AppColors.muted;
    return value > 0 ? AppColors.mint : AppColors.red;
  }
}

class _EnvironmentPill extends StatelessWidget {
  const _EnvironmentPill({required this.testnet});
  final bool testnet;

  @override
  Widget build(BuildContext context) {
    final color = testnet ? AppColors.teal : AppColors.red;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(30)),
      child: Text(testnet ? 'TESTNET' : 'LIVE', style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 0.8)),
    );
  }
}

class _ModePill extends StatelessWidget {
  const _ModePill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: AppColors.surfaceRaised, borderRadius: BorderRadius.circular(30)),
      child: Text(label, style: const TextStyle(fontSize: 11, color: AppColors.teal, fontWeight: FontWeight.w700)),
    );
  }
}

class _TestnetBanner extends StatelessWidget {
  const _TestnetBanner();

  @override
  Widget build(BuildContext context) {
    return const SectionCard(
      backgroundColor: Color(0xFF142523),
      padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(Icons.science_outlined, color: AppColors.teal, size: 20),
          SizedBox(width: 10),
          Expanded(child: Text('TESTNET mode — orders use demo funds, not real assets.', style: TextStyle(color: AppColors.teal, fontSize: 12, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

class _RiskWarning extends StatelessWidget {
  const _RiskWarning();

  @override
  Widget build(BuildContext context) {
    return const SectionCard(
      backgroundColor: Color(0xFF321D21),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: AppColors.red),
          SizedBox(width: 10),
          Expanded(child: Text('Daily Futures loss limit reached. New orders are paused by the app risk guard.', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value, required this.valueColor});
  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
        const SizedBox(height: 5),
        Text(value, style: TextStyle(color: valueColor, fontSize: 14, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _MarketRow extends StatelessWidget {
  const _MarketRow({required this.symbol, required this.ticker, required this.selected, required this.onTap});
  final String symbol;
  final PriceTicker? ticker;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final change = ticker?.changePercent;
    final changeColor = change == null || change == 0 ? AppColors.muted : (change > 0 ? AppColors.mint : AppColors.red);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: AppColors.surfaceRaised, borderRadius: BorderRadius.circular(12)),
              child: Center(child: Text(symbol.substring(0, 1), style: const TextStyle(color: AppColors.mint, fontWeight: FontWeight.w800))),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(symbol.replaceAll('USDT', ''), style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('USDT · ${selected ? 'Selected' : 'Tap to analyze'}', style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(ticker == null ? '—' : formatPrice(ticker!.price), style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(formatPercent(change), style: TextStyle(color: changeColor, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
