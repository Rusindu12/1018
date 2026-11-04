import 'package:intl/intl.dart';

final _currency = NumberFormat.currency(symbol: r'$', decimalDigits: 2);
final _price = NumberFormat('#,##0.00##');
final _smallPrice = NumberFormat('0.00000000');
final _percent = NumberFormat('0.00');

String formatMoney(num? value) => value == null ? '—' : _currency.format(value);

String formatPrice(num? value) {
  if (value == null) return '—';
  return value.abs() < 1 ? _smallPrice.format(value) : _price.format(value);
}

String formatPercent(num? value) => value == null ? '—' : '${_percent.format(value)}%';

String formatCompact(num? value) {
  if (value == null) return '—';
  return NumberFormat.compact().format(value);
}
