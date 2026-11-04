class Candle {
  const Candle({
    required this.openTime,
    required this.open,
    required this.high,
    required this.low,
    required this.close,
    required this.volume,
    required this.closeTime,
    this.isClosed = true,
  });

  final DateTime openTime;
  final double open;
  final double high;
  final double low;
  final double close;
  final double volume;
  final DateTime closeTime;
  final bool isClosed;

  factory Candle.fromBinance(List<dynamic> row) {
    return Candle(
      openTime: DateTime.fromMillisecondsSinceEpoch(_asInt(row[0]), isUtc: true),
      open: _asDouble(row[1]),
      high: _asDouble(row[2]),
      low: _asDouble(row[3]),
      close: _asDouble(row[4]),
      volume: _asDouble(row[5]),
      closeTime: DateTime.fromMillisecondsSinceEpoch(_asInt(row[6]), isUtc: true),
      isClosed: true,
    );
  }
}

class PriceTicker {
  const PriceTicker({
    required this.symbol,
    required this.price,
    this.changePercent,
  });

  final String symbol;
  final double price;
  final double? changePercent;
}

class AssetBalance {
  const AssetBalance({
    required this.asset,
    required this.free,
    required this.locked,
    this.usdtValue,
  });

  final String asset;
  final double free;
  final double locked;
  final double? usdtValue;

  double get total => free + locked;
}

class PortfolioSnapshot {
  const PortfolioSnapshot({
    required this.totalValueUsdt,
    required this.assets,
    required this.asOf,
    this.availableBalanceUsdt,
    this.unrealizedPnlUsdt,
    this.dailyPnlUsdt,
    this.unpricedAssetCount = 0,
  });

  final double totalValueUsdt;
  final double? availableBalanceUsdt;
  final double? unrealizedPnlUsdt;
  final double? dailyPnlUsdt;
  final List<AssetBalance> assets;
  final DateTime asOf;
  final int unpricedAssetCount;

  bool get isFutures => unrealizedPnlUsdt != null;
}

class IndicatorSeries {
  const IndicatorSeries({
    required this.ema20,
    required this.ema50,
    required this.bollingerUpper,
    required this.bollingerMiddle,
    required this.bollingerLower,
    required this.rsi14,
    required this.macd,
    required this.macdSignal,
    required this.macdHistogram,
    required this.atr14,
  });

  final List<double?> ema20;
  final List<double?> ema50;
  final List<double?> bollingerUpper;
  final List<double?> bollingerMiddle;
  final List<double?> bollingerLower;
  final double? rsi14;
  final double? macd;
  final double? macdSignal;
  final double? macdHistogram;
  final double? atr14;
}

enum SignalDirection { buy, sell, hold }

extension SignalDirectionLabel on SignalDirection {
  String get label => switch (this) {
        SignalDirection.buy => 'BUY',
        SignalDirection.sell => 'SELL',
        SignalDirection.hold => 'HOLD',
      };
}

class TradingAnalysis {
  const TradingAnalysis({
    required this.direction,
    required this.confidence,
    required this.score,
    required this.entryPrice,
    required this.takeProfit,
    required this.stopLoss,
    required this.riskReward,
    required this.indicators,
    required this.reasons,
    required this.generatedAt,
  });

  final SignalDirection direction;
  final double confidence;
  final double score;
  final double entryPrice;
  final double? takeProfit;
  final double? stopLoss;
  final double? riskReward;
  final IndicatorSeries indicators;
  final List<String> reasons;
  final DateTime generatedAt;
}

class PositionSize {
  const PositionSize({
    required this.quantity,
    required this.riskAmount,
    required this.notionalValue,
  });

  final double quantity;
  final double riskAmount;
  final double notionalValue;
}

class OrderReceipt {
  const OrderReceipt({
    required this.symbol,
    required this.side,
    required this.status,
    required this.orderId,
    required this.executedQuantity,
    this.averagePrice,
  });

  final String symbol;
  final String side;
  final String status;
  final String orderId;
  final double executedQuantity;
  final double? averagePrice;

  factory OrderReceipt.fromJson(Map<String, dynamic> json) {
    return OrderReceipt(
      symbol: json['symbol']?.toString() ?? '',
      side: json['side']?.toString() ?? '',
      status: json['status']?.toString() ?? 'UNKNOWN',
      orderId: json['orderId']?.toString() ?? '',
      executedQuantity: _asDouble(json['executedQty'] ?? json['origQty']),
      averagePrice: _asDoubleOrNull(json['avgPrice']),
    );
  }
}

int _asInt(dynamic value) {
  if (value is int) return value;
  return int.tryParse(value.toString()) ?? 0;
}

double _asDouble(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0.0;
}

double? _asDoubleOrNull(dynamic value) {
  if (value == null) return null;
  final parsed = value is num ? value.toDouble() : double.tryParse(value.toString());
  if (parsed == null || !parsed.isFinite) {
    return null;
  }
  return parsed;
}
