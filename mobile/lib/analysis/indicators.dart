import 'dart:math' as math;

import '../models/market_models.dart';

class IndicatorEngine {
  const IndicatorEngine._();

  static IndicatorSeries calculate(List<Candle> candles) {
    final closes = candles.map((candle) => candle.close).toList(growable: false);
    final ema20 = emaSeries(closes, 20);
    final ema50 = emaSeries(closes, 50);
    final bands = bollingerSeries(closes, period: 20, standardDeviations: 2);
    final macd = _macd(closes);
    return IndicatorSeries(
      ema20: ema20,
      ema50: ema50,
      bollingerUpper: bands.$1,
      bollingerMiddle: bands.$2,
      bollingerLower: bands.$3,
      rsi14: rsi(closes, period: 14),
      macd: macd.$1,
      macdSignal: macd.$2,
      macdHistogram: macd.$3,
      atr14: atr(candles, period: 14),
    );
  }

  static List<double?> emaSeries(List<double> values, int period) {
    final result = List<double?>.filled(values.length, null);
    if (period <= 0 || values.length < period) return result;

    var current = values.take(period).reduce((a, b) => a + b) / period;
    result[period - 1] = current;
    final multiplier = 2 / (period + 1);
    for (var i = period; i < values.length; i++) {
      current = (values[i] - current) * multiplier + current;
      result[i] = current;
    }
    return result;
  }

  static double? rsi(List<double> values, {int period = 14}) {
    if (period <= 0 || values.length <= period) return null;
    var gains = 0.0;
    var losses = 0.0;
    for (var i = 1; i <= period; i++) {
      final change = values[i] - values[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    var averageGain = gains / period;
    var averageLoss = losses / period;
    for (var i = period + 1; i < values.length; i++) {
      final change = values[i] - values[i - 1];
      averageGain = (averageGain * (period - 1) + (change > 0 ? change : 0)) / period;
      averageLoss = (averageLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    }
    if (averageLoss == 0) return averageGain == 0 ? 50 : 100;
    final relativeStrength = averageGain / averageLoss;
    return 100 - (100 / (1 + relativeStrength));
  }

  static (List<double?>, List<double?>, List<double?>) bollingerSeries(
    List<double> values, {
    int period = 20,
    double standardDeviations = 2,
  }) {
    final upper = List<double?>.filled(values.length, null);
    final middle = List<double?>.filled(values.length, null);
    final lower = List<double?>.filled(values.length, null);
    if (period <= 0 || values.length < period) return (upper, middle, lower);

    for (var end = period - 1; end < values.length; end++) {
      final start = end - period + 1;
      var sum = 0.0;
      for (var i = start; i <= end; i++) {
        sum += values[i];
      }
      final mean = sum / period;
      var squaredDifference = 0.0;
      for (var i = start; i <= end; i++) {
        final difference = values[i] - mean;
        squaredDifference += difference * difference;
      }
      final deviation = math.sqrt(squaredDifference / period);
      middle[end] = mean;
      upper[end] = mean + standardDeviations * deviation;
      lower[end] = mean - standardDeviations * deviation;
    }
    return (upper, middle, lower);
  }

  static double? atr(List<Candle> candles, {int period = 14}) {
    if (period <= 0 || candles.length <= period) return null;
    var current = 0.0;
    for (var i = 1; i <= period; i++) {
      current += _trueRange(candles, i);
    }
    current /= period;
    for (var i = period + 1; i < candles.length; i++) {
      current = (current * (period - 1) + _trueRange(candles, i)) / period;
    }
    return current;
  }

  static double _trueRange(List<Candle> candles, int index) {
    final candle = candles[index];
    final previousClose = candles[index - 1].close;
    return math.max(
      candle.high - candle.low,
      math.max((candle.high - previousClose).abs(), (candle.low - previousClose).abs()),
    ).toDouble();
  }

  static (double?, double?, double?) _macd(List<double> values) {
    final fast = emaSeries(values, 12);
    final slow = emaSeries(values, 26);
    final line = List<double?>.filled(values.length, null);
    for (var i = 0; i < values.length; i++) {
      if (fast[i] != null && slow[i] != null) line[i] = fast[i]! - slow[i]!;
    }
    final first = line.indexWhere((value) => value != null);
    if (first < 0) return (null, null, null);
    final compactLine = line.skip(first).whereType<double>().toList(growable: false);
    final compactSignal = emaSeries(compactLine, 9);
    final currentLine = compactLine.isEmpty ? null : compactLine.last;
    final currentSignal = compactSignal.isEmpty ? null : compactSignal.last;
    if (currentLine == null || currentSignal == null) return (currentLine, currentSignal, null);
    return (currentLine, currentSignal, currentLine - currentSignal);
  }
}
