import '../models/market_models.dart';
import 'indicators.dart';

/// A transparent, deterministic signal engine. It is a heuristic, not a
/// predictive model; it uses closed and in-progress Binance klines only.
class AiTradingEngine {
  const AiTradingEngine._();

  static TradingAnalysis? analyze(List<Candle> candles) {
    if (candles.length < 55) return null;
    final indicators = IndicatorEngine.calculate(candles);
    final last = candles.last;
    final ema20 = indicators.ema20.last;
    final ema50 = indicators.ema50.last;
    final rsi = indicators.rsi14;
    final macdHistogram = indicators.macdHistogram;
    final upper = indicators.bollingerUpper.last;
    final lower = indicators.bollingerLower.last;
    final atr = indicators.atr14;
    if (ema20 == null || ema50 == null || rsi == null || macdHistogram == null || atr == null) {
      return null;
    }

    var score = 0.0;
    final reasons = <String>[];
    if (ema20 > ema50) {
      score += 1.25;
      reasons.add('EMA20 is above EMA50, indicating a positive short-to-medium trend.');
    } else {
      score -= 1.25;
      reasons.add('EMA20 is below EMA50, indicating a negative short-to-medium trend.');
    }
    if (last.close > ema20) {
      score += 0.65;
      reasons.add('Price is above EMA20.');
    } else {
      score -= 0.65;
      reasons.add('Price is below EMA20.');
    }
    if (macdHistogram > 0) {
      score += 1.1;
      reasons.add('MACD histogram is positive (momentum is improving).');
    } else if (macdHistogram < 0) {
      score -= 1.1;
      reasons.add('MACD histogram is negative (momentum is weakening).');
    }
    if (rsi >= 52 && rsi < 70) {
      score += 0.7;
      reasons.add('RSI is in a constructive, non-overbought range.');
    } else if (rsi <= 48 && rsi > 30) {
      score -= 0.7;
      reasons.add('RSI is in a weak, non-oversold range.');
    } else if (rsi >= 70) {
      score -= 0.35;
      reasons.add('RSI is elevated; chasing a long entry may carry extra risk.');
    } else if (rsi <= 30) {
      score += 0.35;
      reasons.add('RSI is oversold; a reversal is possible but not confirmed.');
    } else {
      reasons.add('RSI is near its neutral zone.');
    }
    if (upper != null && last.close >= upper) {
      score -= 0.45;
      reasons.add('Price is at or above the upper Bollinger Band.');
    } else if (lower != null && last.close <= lower) {
      score += 0.45;
      reasons.add('Price is at or below the lower Bollinger Band.');
    } else {
      reasons.add('Price is inside the Bollinger Bands.');
    }

    final direction = score >= 2.0
        ? SignalDirection.buy
        : score <= -2.0
            ? SignalDirection.sell
            : SignalDirection.hold;
    final confidence = direction == SignalDirection.hold
        ? (62 + (2 - score.abs()) * 8).clamp(62, 78).toDouble()
        : (50 + score.abs() * 8).clamp(55, 92).toDouble();

    double? takeProfit;
    double? stopLoss;
    double? riskReward;
    if (direction == SignalDirection.buy) {
      stopLoss = last.close - atr * 1.5;
      takeProfit = last.close + atr * 2.25;
    } else if (direction == SignalDirection.sell) {
      stopLoss = last.close + atr * 1.5;
      takeProfit = last.close - atr * 2.25;
    }
    if (takeProfit != null && stopLoss != null) {
      final risk = (last.close - stopLoss).abs();
      if (risk > 0) riskReward = (takeProfit - last.close).abs() / risk;
    }
    if (direction == SignalDirection.hold) {
      reasons.add('Signals are mixed; the engine prefers to wait for confirmation.');
    }
    return TradingAnalysis(
      direction: direction,
      confidence: confidence,
      score: score,
      entryPrice: last.close,
      takeProfit: takeProfit,
      stopLoss: stopLoss,
      riskReward: riskReward,
      indicators: indicators,
      reasons: reasons,
      generatedAt: DateTime.now(),
    );
  }
}
