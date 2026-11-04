import 'package:shared_preferences/shared_preferences.dart';

import '../../models/app_settings.dart';

class AppPreferencesStore {
  static const _marketTypeKey = 'market_type';
  static const _testnetKey = 'testnet';
  static const _symbolKey = 'symbol';
  static const _intervalKey = 'interval';
  static const _dailyLossLimitKey = 'daily_loss_limit_usdt';
  static const _riskPercentKey = 'risk_percent';

  Future<AppSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    final marketType = switch (prefs.getString(_marketTypeKey)) {
      'futures' => MarketType.futures,
      _ => MarketType.spot,
    };
    return AppSettings(
      marketType: marketType,
      testnet: prefs.getBool(_testnetKey) ?? true,
      symbol: _validatedSymbol(prefs.getString(_symbolKey)),
      interval: _validatedInterval(prefs.getString(_intervalKey)),
      dailyLossLimitUsdt: _validPositive(
        prefs.getDouble(_dailyLossLimitKey),
        fallback: 25,
        maximum: 1000000,
      ),
      riskPercent: _validPositive(
        prefs.getDouble(_riskPercentKey),
        fallback: 1,
        maximum: 5,
      ),
    );
  }

  Future<void> save(AppSettings settings) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_marketTypeKey, settings.marketType.name);
    await prefs.setBool(_testnetKey, settings.testnet);
    await prefs.setString(_symbolKey, settings.symbol);
    await prefs.setString(_intervalKey, settings.interval);
    await prefs.setDouble(_dailyLossLimitKey, settings.dailyLossLimitUsdt);
    await prefs.setDouble(_riskPercentKey, settings.riskPercent);
  }

  static const allowedSymbols = <String>[
    'BTCUSDT',
    'ETHUSDT',
    'BNBUSDT',
    'SOLUSDT',
  ];

  static const allowedIntervals = <String>[
    '1m',
    '5m',
    '15m',
    '1h',
    '4h',
    '1d',
  ];

  static String _validatedSymbol(String? value) =>
      allowedSymbols.contains(value) ? value! : 'BTCUSDT';

  static String _validatedInterval(String? value) =>
      allowedIntervals.contains(value) ? value! : '1h';

  static double _validPositive(double? value, {required double fallback, required double maximum}) {
    if (value == null || !value.isFinite || value <= 0 || value > maximum) return fallback;
    return value;
  }
}
