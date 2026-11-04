import 'package:binance_ai_desk/analysis/ai_trading_engine.dart';
import 'package:binance_ai_desk/models/market_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AiTradingEngine', () {
    test('requires a minimum candle history', () {
      expect(AiTradingEngine.analyze(_candles(40)), isNull);
    });

    test('returns bounded confidence and ATR risk levels for a rising market', () {
      final analysis = AiTradingEngine.analyze(_candles(100));
      expect(analysis, isNotNull);
      expect(analysis!.direction, SignalDirection.buy);
      expect(analysis.confidence, inInclusiveRange(0, 100));
      expect(analysis.entryPrice, greaterThan(0));
      expect(analysis.stopLoss, lessThan(analysis.entryPrice));
      expect(analysis.takeProfit, greaterThan(analysis.entryPrice));
      expect(analysis.riskReward, greaterThan(0));
      expect(analysis.reasons, isNotEmpty);
    });
  });
}

List<Candle> _candles(int count) {
  return List<Candle>.generate(count, (index) {
    final close = 100 + index * 0.8;
    return Candle(
      openTime: DateTime.utc(2025, 1, 1).add(Duration(hours: index)),
      open: close - 0.3,
      high: close + 0.6,
      low: close - 0.6,
      close: close,
      volume: 10 + index.toDouble(),
      closeTime: DateTime.utc(2025, 1, 1).add(Duration(hours: index + 1)),
    );
  });
}
