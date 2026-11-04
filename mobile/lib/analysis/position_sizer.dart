import '../models/market_models.dart';

class PositionSizer {
  const PositionSizer._();

  /// Calculates base-asset quantity from a fixed account-risk budget.
  /// It does not account for fees, slippage, funding, leverage, or exchange filters.
  static PositionSize? calculate({
    required double accountEquity,
    required double riskPercent,
    required double entryPrice,
    required double stopPrice,
  }) {
    if (!accountEquity.isFinite || !riskPercent.isFinite || !entryPrice.isFinite || !stopPrice.isFinite) {
      return null;
    }
    if (accountEquity <= 0 || riskPercent <= 0 || riskPercent > 100 || entryPrice <= 0 || stopPrice <= 0) {
      return null;
    }
    final riskPerUnit = (entryPrice - stopPrice).abs();
    if (riskPerUnit <= 0) return null;
    final riskAmount = accountEquity * riskPercent / 100;
    final quantity = riskAmount / riskPerUnit;
    if (!quantity.isFinite || quantity <= 0) return null;
    return PositionSize(
      quantity: quantity,
      riskAmount: riskAmount,
      notionalValue: quantity * entryPrice,
    );
  }
}
