enum MarketType { spot, futures }

extension MarketTypeLabel on MarketType {
  String get label => this == MarketType.spot ? 'Spot' : 'USDT-M Futures';

  String get accountLabel => this == MarketType.spot ? 'Spot account' : 'Futures account';
}

class AppSettings {
  const AppSettings({
    this.marketType = MarketType.spot,
    this.testnet = true,
    this.symbol = 'BTCUSDT',
    this.interval = '1h',
    this.dailyLossLimitUsdt = 25,
    this.riskPercent = 1,
  });

  final MarketType marketType;
  final bool testnet;
  final String symbol;
  final String interval;
  final double dailyLossLimitUsdt;
  final double riskPercent;

  AppSettings copyWith({
    MarketType? marketType,
    bool? testnet,
    String? symbol,
    String? interval,
    double? dailyLossLimitUsdt,
    double? riskPercent,
  }) {
    return AppSettings(
      marketType: marketType ?? this.marketType,
      testnet: testnet ?? this.testnet,
      symbol: symbol ?? this.symbol,
      interval: interval ?? this.interval,
      dailyLossLimitUsdt: dailyLossLimitUsdt ?? this.dailyLossLimitUsdt,
      riskPercent: riskPercent ?? this.riskPercent,
    );
  }
}
