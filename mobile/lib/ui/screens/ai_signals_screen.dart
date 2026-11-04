import 'package:flutter/material.dart';

import '../../analysis/position_sizer.dart';
import '../../models/market_models.dart';
import '../../models/order_request.dart';
import '../../state/trading_controller.dart';
import '../app_theme.dart';
import '../formatters.dart';
import '../widgets/order_ticket_dialog.dart';
import '../widgets/section_card.dart';

class AiSignalsScreen extends StatefulWidget {
  const AiSignalsScreen({required this.controller, super.key});

  final TradingController controller;

  @override
  State<AiSignalsScreen> createState() => _AiSignalsScreenState();
}

class _AiSignalsScreenState extends State<AiSignalsScreen> {
  late final TextEditingController _equityController;
  late final TextEditingController _riskController;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _equityController = TextEditingController();
    _riskController = TextEditingController(text: widget.controller.settings.riskPercent.toString());
  }

  @override
  void dispose() {
    _equityController.dispose();
    _riskController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('AI trading assistant'),
        actions: [IconButton(onPressed: widget.controller.refreshMarketData, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: AnimatedBuilder(
        animation: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          final analysis = controller.analysis;
          final portfolio = controller.portfolio;
          final defaultEquity = portfolio?.availableBalanceUsdt ?? portfolio?.totalValueUsdt ?? 0.0;
          if (_equityController.text.isEmpty && defaultEquity > 0) {
            _equityController.text = defaultEquity.toStringAsFixed(2);
          }
          final equity = double.tryParse(_equityController.text.trim()) ?? defaultEquity;
          final riskPercent = double.tryParse(_riskController.text.trim()) ?? controller.settings.riskPercent;
          final fallbackStop = analysis == null
              ? 0.0
              : analysis.direction == SignalDirection.sell
                  ? analysis.entryPrice * 1.01
                  : analysis.entryPrice * 0.99;
          final stopPrice = analysis?.stopLoss ?? fallbackStop;
          final position = analysis == null || stopPrice <= 0
              ? null
              : PositionSizer.calculate(
                  accountEquity: equity,
                  riskPercent: riskPercent,
                  entryPrice: analysis.entryPrice,
                  stopPrice: stopPrice,
                );
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              if (controller.settings.testnet) const _TestnetNotice(),
              const SizedBox(height: 12),
              if (analysis == null)
                SectionCard(
                  child: Column(
                    children: [
                      const Icon(Icons.hourglass_top_rounded, color: AppColors.teal, size: 30),
                      const SizedBox(height: 10),
                      const Text('Building a signal', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                      const SizedBox(height: 6),
                      Text(
                        controller.marketError ?? 'At least 55 candles are required to calculate the indicators.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: AppColors.muted, height: 1.4),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(onPressed: controller.refreshMarketData, icon: const Icon(Icons.refresh), label: const Text('Refresh candles')),
                    ],
                  ),
                )
              else ...[
                _SignalCard(analysis: analysis, symbol: controller.settings.symbol),
                const SizedBox(height: 14),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Why this signal?', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 12),
                      for (final reason in analysis.reasons) ...[
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(padding: EdgeInsets.only(top: 6), child: Icon(Icons.circle, size: 6, color: AppColors.teal)),
                            const SizedBox(width: 9),
                            Expanded(child: Text(reason, style: const TextStyle(color: AppColors.muted, fontSize: 12, height: 1.4))),
                          ],
                        ),
                        const SizedBox(height: 9),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Position size calculator', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      const Text('Risk budget = equity × risk %. Quantity uses the signal stop distance (HOLD uses an illustrative 1% stop); fees, slippage, leverage and exchange lot-size rules are not included.', style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4)),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _equityController,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(labelText: 'Equity (USDT)'),
                              onChanged: (_) => setState(() {}),
                            ),
                          ),
                          const SizedBox(width: 10),
                          SizedBox(
                            width: 100,
                            child: TextField(
                              controller: _riskController,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(labelText: 'Risk %'),
                              onChanged: (_) => setState(() {}),
                              onEditingComplete: () {
                                final parsed = double.tryParse(_riskController.text.trim());
                                if (parsed != null && parsed > 0 && parsed <= 5) {
                                  unawaited(controller.setRiskLimits(riskPercent: parsed));
                                }
                                FocusScope.of(context).unfocus();
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(13),
                        decoration: BoxDecoration(color: AppColors.surfaceRaised, borderRadius: BorderRadius.circular(14)),
                        child: position == null
                            ? const Text('Enter valid equity and risk values to calculate quantity.', style: TextStyle(color: AppColors.muted, fontSize: 12))
                            : Column(
                                children: [
                                  _ResultRow(label: 'Suggested quantity', value: '${position.quantity.toStringAsPrecision(6)} ${controller.settings.symbol.replaceAll('USDT', '')}'),
                                  _ResultRow(label: 'Risk at stop', value: formatMoney(position.riskAmount)),
                                  _ResultRow(label: 'Estimated notional', value: formatMoney(position.notionalValue), last: true),
                                ],
                              ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _submitting || controller.dailyLossLimitReached
                      ? null
                      : () => _reviewAndSubmit(controller, analysis, position),
                  icon: _submitting
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.fact_check_outlined),
                  label: Text(controller.dailyLossLimitReached
                      ? 'Orders paused by daily risk limit'
                      : analysis.direction == SignalDirection.hold
                          ? 'Open manual order ticket'
                          : 'Review ${analysis.direction.label} order'),
                ),
                const SizedBox(height: 8),
                const Text('The assistant is a local indicator heuristic, not an LLM or a prediction guarantee. Every order requires a separate review and confirmation.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4)),
              ],
            ],
          );
        },
      ),
    );
  }

  Future<void> _reviewAndSubmit(TradingController controller, TradingAnalysis analysis, PositionSize? position) async {
    final side = analysis.direction == SignalDirection.sell ? 'SELL' : 'BUY';
    final initialPrice = controller.prices[controller.settings.symbol]?.price ?? analysis.entryPrice;
    final order = await showDialog<OrderRequest>(
      context: context,
      builder: (context) => OrderTicketDialog(
        symbol: controller.settings.symbol,
        marketType: controller.settings.marketType,
        testnet: controller.settings.testnet,
        currentPrice: initialPrice,
        initialSide: side,
        initialQuantity: analysis.direction == SignalDirection.hold ? null : position?.quantity,
      ),
    );
    if (!mounted || order == null) return;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: Icon(controller.settings.testnet ? Icons.science_outlined : Icons.warning_amber_rounded, color: controller.settings.testnet ? AppColors.teal : AppColors.red),
        title: Text(controller.settings.testnet ? 'Confirm testnet order' : 'Confirm LIVE order'),
        content: Text(
          '${order.side} ${order.quantity} ${order.symbol.replaceAll('USDT', '')} · ${order.type}${order.limitPrice == null ? '' : ' at ${formatPrice(order.limitPrice)} USDT'}\n\n'
          '${order.reduceOnly ? 'Reduce-only is enabled. ' : ''}'
          '${controller.settings.testnet ? 'This uses demo funds.' : 'This submits a real exchange order. The AI signal is not financial advice.'}',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Go back')),
          FilledButton(
            style: controller.settings.testnet ? null : FilledButton.styleFrom(backgroundColor: AppColors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Place order'),
          ),
        ],
      ),
    );
    if (!mounted || accepted != true) return;
    setState(() => _submitting = true);
    try {
      final receipt = await controller.submitOrder(order);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Order ${receipt.status.toLowerCase()} · ID ${receipt.orderId}')),
      );
    } on Object catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }
}

class _SignalCard extends StatelessWidget {
  const _SignalCard({required this.analysis, required this.symbol});
  final TradingAnalysis analysis;
  final String symbol;

  @override
  Widget build(BuildContext context) {
    final color = switch (analysis.direction) {
      SignalDirection.buy => AppColors.mint,
      SignalDirection.sell => AppColors.red,
      SignalDirection.hold => AppColors.teal,
    };
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(symbol, style: const TextStyle(color: AppColors.muted, fontSize: 12)),
                    const SizedBox(height: 3),
                    Text(analysis.direction.label, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 30, letterSpacing: 1.2)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
                child: Column(
                  children: [
                    Text(formatPercent(analysis.confidence), style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 16)),
                    const Text('HEURISTIC', style: TextStyle(color: AppColors.muted, fontSize: 8, letterSpacing: 0.8)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(5),
            child: LinearProgressIndicator(value: analysis.confidence / 100, minHeight: 5, color: color, backgroundColor: AppColors.surfaceRaised),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _PriceLevel(label: 'Entry', value: analysis.entryPrice, valueColor: Colors.white)),
              Expanded(child: _PriceLevel(label: 'Take profit', value: analysis.takeProfit, valueColor: AppColors.mint)),
              Expanded(child: _PriceLevel(label: 'Stop loss', value: analysis.stopLoss, valueColor: AppColors.red)),
            ],
          ),
          if (analysis.riskReward != null) ...[
            const SizedBox(height: 12),
            Text('Illustrative risk/reward: 1 : ${analysis.riskReward!.toStringAsFixed(2)} · ATR-based levels', style: const TextStyle(color: AppColors.muted, fontSize: 11)),
          ],
          const SizedBox(height: 10),
          Text('Score ${analysis.score.toStringAsFixed(2)} · ${analysis.generatedAt.toLocal().toString().substring(0, 16)}', style: const TextStyle(color: AppColors.muted, fontSize: 10)),
        ],
      ),
    );
  }
}

class _PriceLevel extends StatelessWidget {
  const _PriceLevel({required this.label, required this.value, required this.valueColor});
  final String label;
  final double? value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 10)),
        const SizedBox(height: 4),
        Text(formatPrice(value), style: TextStyle(color: valueColor, fontWeight: FontWeight.w700, fontSize: 12)),
      ],
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({required this.label, required this.value, this.last = false});
  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 9),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 11))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11)),
        ],
      ),
    );
  }
}

class _TestnetNotice extends StatelessWidget {
  const _TestnetNotice();

  @override
  Widget build(BuildContext context) {
    return const SectionCard(
      backgroundColor: Color(0xFF142523),
      child: Row(
        children: [
          Icon(Icons.science_outlined, color: AppColors.teal),
          SizedBox(width: 10),
          Expanded(child: Text('Signals are advisory. Test all behavior on testnet before considering live use.', style: TextStyle(color: AppColors.teal, fontSize: 12))),
        ],
      ),
    );
  }
}
