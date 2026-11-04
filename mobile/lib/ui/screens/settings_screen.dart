import 'package:flutter/material.dart';

import '../../models/app_settings.dart';
import '../../state/trading_controller.dart';
import '../app_theme.dart';
import '../widgets/section_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({required this.controller, super.key});

  final TradingController controller;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _apiKeyController = TextEditingController();
  final _secretController = TextEditingController();
  final _lossLimitController = TextEditingController();
  bool _showApiKey = false;
  bool _showSecret = false;
  bool _saving = false;
  bool _savingRisk = false;

  @override
  void dispose() {
    _apiKeyController.dispose();
    _secretController.dispose();
    _lossLimitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings & security')),
      body: AnimatedBuilder(
        animation: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          if (_lossLimitController.text.isEmpty) {
            _lossLimitController.text = controller.settings.dailyLossLimitUsdt.toStringAsFixed(2);
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              const SectionHeading('Exchange'),
              const SizedBox(height: 10),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Market type', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    SegmentedButton<MarketType>(
                      segments: const [
                        ButtonSegment(value: MarketType.spot, label: Text('Spot'), icon: Icon(Icons.currency_exchange_rounded)),
                        ButtonSegment(value: MarketType.futures, label: Text('USDT-M Futures'), icon: Icon(Icons.show_chart_rounded)),
                      ],
                      selected: {controller.settings.marketType},
                      onSelectionChanged: (selection) {
                        controller.updateSettings(controller.settings.copyWith(marketType: selection.first));
                      },
                    ),
                    const SizedBox(height: 14),
                    SwitchListTile.adaptive(
                      contentPadding: EdgeInsets.zero,
                      value: controller.settings.testnet,
                      title: Text(controller.settings.testnet ? 'Testnet enabled' : 'Live trading enabled'),
                      subtitle: Text(controller.settings.testnet
                          ? 'Uses Binance demo endpoints.'
                          : 'Real exchange account and funds. All orders still require confirmation.'),
                      onChanged: (value) => _changeEnvironment(controller, value),
                    ),
                    const Text('Testnet is enabled by default. Spot and Futures use separate test environments and API keys.', style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4)),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const SectionHeading('Binance API credentials'),
              const SizedBox(height: 10),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Icon(controller.hasApiCredentials ? Icons.verified_user_rounded : Icons.lock_outline_rounded, color: controller.hasApiCredentials ? AppColors.mint : AppColors.muted),
                        const SizedBox(width: 8),
                        Expanded(child: Text(controller.hasApiCredentials ? 'Credentials saved on this device' : 'No API credentials saved', style: const TextStyle(fontWeight: FontWeight.w700))),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _apiKeyController,
                      obscureText: !_showApiKey,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: 'API key',
                        suffixIcon: IconButton(
                          tooltip: _showApiKey ? 'Hide API key' : 'Show API key',
                          onPressed: () => setState(() => _showApiKey = !_showApiKey),
                          icon: Icon(_showApiKey ? Icons.visibility_off : Icons.visibility),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    TextField(
                      controller: _secretController,
                      obscureText: !_showSecret,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: 'Secret key',
                        suffixIcon: IconButton(
                          tooltip: _showSecret ? 'Hide secret' : 'Show secret',
                          onPressed: () => setState(() => _showSecret = !_showSecret),
                          icon: Icon(_showSecret ? Icons.visibility_off : Icons.visibility),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.icon(
                      onPressed: _saving ? null : () => _saveCredentials(controller),
                      icon: _saving
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.lock_rounded),
                      label: Text(_saving ? 'Verifying…' : 'Save securely & verify'),
                    ),
                    if (controller.hasApiCredentials) ...[
                      const SizedBox(height: 6),
                      OutlinedButton.icon(
                        onPressed: () => _removeCredentials(controller),
                        icon: const Icon(Icons.delete_outline_rounded),
                        label: const Text('Remove saved credentials'),
                      ),
                    ],
                    if (controller.portfolioError != null) ...[
                      const SizedBox(height: 8),
                      Text(controller.portfolioError!, style: const TextStyle(color: AppColors.red, fontSize: 12)),
                    ],
                    const SizedBox(height: 10),
                    const Text(
                      'Credentials are stored using Android encrypted storage and used locally to sign Binance requests. Never enable withdrawals, transfers or universal permissions. Restrict the key by IP when possible. No key is sent to an AI/LLM service.',
                      style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.45),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const SectionHeading('Risk guard'),
              const SizedBox(height: 10),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Daily loss limit (USDT)', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 5),
                    const Text('Futures order submissions are paused when today’s realized P&L, commissions and funding plus current unrealized P&L reach this loss.', style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _lossLimitController,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: const InputDecoration(prefixText: r'$ ', hintText: '25.00'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        FilledButton.tonal(
                          onPressed: _savingRisk ? null : () => _saveRiskLimit(controller),
                          child: _savingRisk ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Save'),
                        ),
                      ],
                    ),
                    if (controller.dailyLossLimitReached) ...[
                      const SizedBox(height: 10),
                      const Text('Limit reached: new orders are blocked by the app risk guard.', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700, fontSize: 12)),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const SectionHeading('Trading behavior'),
              const SizedBox(height: 10),
              const SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.touch_app_rounded, color: AppColors.teal),
                        SizedBox(width: 9),
                        Expanded(child: Text('Manual confirmation is always required', style: TextStyle(fontWeight: FontWeight.w700))),
                      ],
                    ),
                    SizedBox(height: 9),
                    Text('This release does not run unattended or background auto-trading. AI signals can prefill a Spot or Futures Market/Limit ticket, but every order needs your review and a final confirmation. This avoids accidental trades when the app is idle, disconnected or missing a protective exit.', style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.45)),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              const Text('Analysis is educational and heuristic, not financial advice. Crypto trading can result in total loss. Validate all behavior on testnet before using live credentials.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.45)),
            ],
          );
        },
      ),
    );
  }

  Future<void> _changeEnvironment(TradingController controller, bool testnet) async {
    if (!testnet) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          icon: const Icon(Icons.warning_amber_rounded, color: AppColors.red),
          title: const Text('Enable live trading?'),
          content: const Text('Live mode can submit real exchange orders. Check your API-key permissions and exchange account. This app does not guarantee profits or prevent all losses.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Stay on testnet')),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.red),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Enable live mode'),
            ),
          ],
        ),
      );
      if (!mounted || confirmed != true) return;
    }
    await controller.updateSettings(controller.settings.copyWith(testnet: testnet));
  }

  Future<void> _saveCredentials(TradingController controller) async {
    setState(() => _saving = true);
    var success = false;
    String? storageError;
    try {
      success = await controller.saveAndVerifyCredentials(
        apiKey: _apiKeyController.text,
        secretKey: _secretController.text,
      );
    } on Object catch (error) {
      storageError = error.toString();
    }
    if (!mounted) return;
    setState(() {
      _saving = false;
      _apiKeyController.clear();
      _secretController.clear();
    });
    final message = success
        ? 'Credentials verified for ${controller.settings.marketType.label}.'
        : storageError ?? controller.portfolioError ?? 'Could not verify credentials.';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _removeCredentials(TradingController controller) async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove credentials?'),
        content: const Text('The API key and secret will be deleted from secure storage on this device.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove')),
        ],
      ),
    );
    if (!mounted || accepted != true) return;
    await controller.removeCredentials();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Credentials removed.')));
  }

  Future<void> _saveRiskLimit(TradingController controller) async {
    final value = double.tryParse(_lossLimitController.text.trim());
    if (value == null || !value.isFinite || value <= 0 || value > 1000000) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a daily loss limit greater than 0 and no more than 1,000,000 USDT.')));
      return;
    }
    setState(() => _savingRisk = true);
    try {
      await controller.setRiskLimits(dailyLossLimitUsdt: value);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Risk limit saved.')));
    } on Object catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _savingRisk = false);
    }
  }
}
