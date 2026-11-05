import 'package:flutter/material.dart';

import '../../state/trading_controller.dart';
import '../app_theme.dart';
import '../formatters.dart';
import '../widgets/candle_chart.dart';
import '../widgets/section_card.dart';

class ChartScreen extends StatefulWidget {
  const ChartScreen({required this.controller, super.key});

  final TradingController controller;

  @override
  State<ChartScreen> createState() => _ChartScreenState();
}

class _ChartScreenState extends State<ChartScreen> {
  int? _selectedCandleIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Market chart')),
      body: AnimatedBuilder(
        animation: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          final candles = controller.candles;
          final index = (_selectedCandleIndex ?? (candles.isEmpty ? 0 : candles.length - 1))
              .clamp(0, candles.isEmpty ? 0 : candles.length - 1)
              .toInt();
          final selected = candles.isEmpty ? null : candles[index];
          final indicators = controller.analysis?.indicators;
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              Row(
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: controller.settings.symbol,
                      decoration: const InputDecoration(labelText: 'Market', contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                      items: controller.watchlist.map((symbol) => DropdownMenuItem(value: symbol, child: Text(symbol))).toList(),
                      onChanged: (symbol) {
                        if (symbol != null) {
                          setState(() => _selectedCandleIndex = null);
                          controller.selectSymbol(symbol);
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  DropdownButton<String>(
                    value: controller.settings.interval,
                    underline: const SizedBox.shrink(),
                    borderRadius: BorderRadius.circular(14),
                    items: const ['1m', '5m', '15m', '1h', '4h', '1d']
                        .map((interval) => DropdownMenuItem(value: interval, child: Text(interval)))
                        .toList(),
                    onChanged: (interval) {
                      if (interval != null) {
                        setState(() => _selectedCandleIndex = null);
                        controller.selectInterval(interval);
                      }
                    },
                  ),
                  IconButton(onPressed: controller.refreshMarketData, icon: const Icon(Icons.refresh_rounded)),
                ],
              ),
              const SizedBox(height: 12),
              SectionCard(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(controller.settings.symbol, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                        if (controller.isMarketLoading) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2)),
                        const SizedBox(width: 6),
                        Text(selected == null ? '—' : formatPrice(selected.close), style: const TextStyle(color: AppColors.mint, fontWeight: FontWeight.w800, fontSize: 16)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: 300,
                      width: double.infinity,
                      child: candles.isEmpty
                          ? const Center(child: Text('Loading Binance candles…', style: TextStyle(color: AppColors.muted)))
                          : CandleChart(
                              candles: candles,
                              indicators: indicators,
                              selectedIndex: index,
                              onSelected: (selectedIndex) => setState(() => _selectedCandleIndex = selectedIndex),
                            ),
                    ),
                    if (selected != null) ...[
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 14,
                        runSpacing: 5,
                        children: [
                          _OhlcValue(label: 'O', value: selected.open),
                          _OhlcValue(label: 'H', value: selected.high),
                          _OhlcValue(label: 'L', value: selected.low),
                          _OhlcValue(label: 'C', value: selected.close),
                          _OhlcValue(label: 'VOL', value: selected.volume, compact: true),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (controller.marketError != null) ...[
                const SizedBox(height: 10),
                Text(controller.marketError!, style: const TextStyle(color: AppColors.red)),
              ],
              const SizedBox(height: 16),
              const SectionHeading('Indicators'),
              const SizedBox(height: 10),
              SectionCard(
                child: indicators == null
                    ? const Text('Waiting for enough candles to calculate indicators.', style: TextStyle(color: AppColors.muted))
                    : Column(
                        children: [
                          _IndicatorRow(label: 'RSI (14)', value: indicators.rsi14 == null ? '—' : indicators.rsi14!.toStringAsFixed(2)),
                          _IndicatorRow(label: 'MACD (12, 26, 9)', value: indicators.macdHistogram == null ? '—' : indicators.macdHistogram!.toStringAsFixed(4)),
                          _IndicatorRow(label: 'EMA (20 / 50)', value: '${formatPrice(indicators.ema20.last)} / ${formatPrice(indicators.ema50.last)}'),
                          _IndicatorRow(label: 'Bollinger (20, 2)', value: '${formatPrice(indicators.bollingerLower.last)} – ${formatPrice(indicators.bollingerUpper.last)}', last: true),
                        ],
                      ),
              ),
              const SizedBox(height: 8),
              const Text('Candles update from Binance public market data. Drag or tap the chart to inspect a candle.', style: TextStyle(color: AppColors.muted, fontSize: 11)),
            ],
          );
        },
      ),
    );
  }
}

class _OhlcValue extends StatelessWidget {
  const _OhlcValue({required this.label, required this.value, this.compact = false});
  final String label;
  final double value;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 11, color: AppColors.muted),
        children: [
          TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.mint)),
          TextSpan(text: compact ? formatCompact(value) : formatPrice(value)),
        ],
      ),
    );
  }
}

class _IndicatorRow extends StatelessWidget {
  const _IndicatorRow({required this.label, required this.value, this.last = false});
  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 13),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 12))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
        ],
      ),
    );
  }
}
