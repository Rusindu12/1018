import 'package:binance_ai_desk/analysis/position_sizer.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PositionSizer', () {
    test('calculates quantity from fixed USDT risk and stop distance', () {
      final size = PositionSizer.calculate(
        accountEquity: 1000,
        riskPercent: 1,
        entryPrice: 100,
        stopPrice: 90,
      );
      expect(size, isNotNull);
      expect(size!.riskAmount, 10);
      expect(size.quantity, 1);
      expect(size.notionalValue, 100);
    });

    test('rejects invalid risk inputs and zero stop distance', () {
      expect(PositionSizer.calculate(accountEquity: 100, riskPercent: 1, entryPrice: 10, stopPrice: 10), isNull);
      expect(PositionSizer.calculate(accountEquity: -1, riskPercent: 1, entryPrice: 10, stopPrice: 9), isNull);
    });
  });
}
