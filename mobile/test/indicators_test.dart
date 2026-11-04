import 'package:binance_ai_desk/analysis/indicators.dart';
import 'package:binance_ai_desk/models/market_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('IndicatorEngine', () {
    test('EMA seeds from the first full period and follows a flat series', () {
      final ema = IndicatorEngine.emaSeries([10, 10, 10, 10, 10], 3);
      expect(ema.take(2), everyElement(isNull));
      expect(ema.skip(2), everyElement(10));
    });

    test('RSI reports strong momentum for strictly rising closes', () {
      final closes = List<double>.generate(40, (index) => 100 + index.toDouble());
      expect(IndicatorEngine.rsi(closes), 100);
    });

    test('Bollinger bands are centered and symmetric for a flat market', () {
      final bands = IndicatorEngine.bollingerSeries(List<double>.filled(20, 7));
      expect(bands.$1.last, 7);
      expect(bands.$2.last, 7);
      expect(bands.$3.last, 7);
    });

    test('ATR returns null until a full period of ranges is available', () {
      final candles = List<Candle>.generate(
        14,
        (index) => Candle(
          openTime: DateTime.utc(2025, 1, 1).add(Duration(minutes: index)),
          open: 10,
          high: 12,
          low: 9,
          close: 11,
          volume: 1,
          closeTime: DateTime.utc(2025, 1, 1).add(Duration(minutes: index + 1)),
        ),
      );
      expect(IndicatorEngine.atr(candles), isNull);
      final extended = [...candles, candles.last];
      expect(IndicatorEngine.atr(extended), 3);
    });
  });
}
