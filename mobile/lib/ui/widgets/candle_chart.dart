import 'package:flutter/material.dart';

import '../../models/market_models.dart';
import '../app_theme.dart';

class CandleChart extends StatelessWidget {
  const CandleChart({
    required this.candles,
    required this.indicators,
    required this.selectedIndex,
    required this.onSelected,
    super.key,
  });

  final List<Candle> candles;
  final IndicatorSeries? indicators;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        void select(Offset localPosition) {
          const left = 8.0;
          const right = 62.0;
          final plotWidth = constraints.maxWidth - left - right;
          if (plotWidth <= 0 || candles.isEmpty) return;
          final raw = ((localPosition.dx - left) / plotWidth * candles.length).floor();
          onSelected(raw.clamp(0, candles.length - 1).toInt());
        }

        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (details) => select(details.localPosition),
          onHorizontalDragUpdate: (details) => select(details.localPosition),
          child: CustomPaint(
            size: Size(constraints.maxWidth, constraints.maxHeight),
            painter: _CandlePainter(
              candles: candles,
              indicators: indicators,
              selectedIndex: selectedIndex,
            ),
          ),
        );
      },
    );
  }
}

class _CandlePainter extends CustomPainter {
  _CandlePainter({required this.candles, required this.indicators, required this.selectedIndex});

  final List<Candle> candles;
  final IndicatorSeries? indicators;
  final int selectedIndex;

  @override
  void paint(Canvas canvas, Size size) {
    if (candles.isEmpty || size.width <= 70 || size.height <= 80) return;
    const left = 8.0;
    const right = 62.0;
    const top = 10.0;
    const bottom = 36.0;
    final plot = Rect.fromLTRB(left, top, size.width - right, size.height - bottom);
    final values = candles.expand((candle) => [candle.high, candle.low]).toList();
    var minPrice = values.reduce((a, b) => a < b ? a : b);
    var maxPrice = values.reduce((a, b) => a > b ? a : b);
    if (minPrice == maxPrice) {
      minPrice *= 0.995;
      maxPrice *= 1.005;
    }
    final padding = (maxPrice - minPrice) * 0.06;
    minPrice -= padding;
    maxPrice += padding;
    final priceRange = maxPrice - minPrice;

    double yFor(double price) => plot.bottom - (price - minPrice) / priceRange * plot.height;
    double xFor(int index) => plot.left + (index + 0.5) * plot.width / candles.length;

    final gridPaint = Paint()..color = AppColors.grid..strokeWidth = 1;
    for (var i = 0; i <= 4; i++) {
      final y = plot.top + plot.height * i / 4;
      canvas.drawLine(Offset(plot.left, y), Offset(plot.right, y), gridPaint);
      final price = maxPrice - (maxPrice - minPrice) * i / 4;
      _drawLabel(canvas, price.toStringAsFixed(price < 1 ? 5 : 1), Offset(plot.right + 5, y - 6), AppColors.muted);
    }

    final bollingerUpper = indicators?.bollingerUpper;
    final bollingerLower = indicators?.bollingerLower;
    final ema20 = indicators?.ema20;
    final ema50 = indicators?.ema50;
    _drawIndicator(canvas, bollingerUpper, xFor, yFor, AppColors.teal.withValues(alpha: 0.6), 1);
    _drawIndicator(canvas, bollingerLower, xFor, yFor, AppColors.teal.withValues(alpha: 0.6), 1);
    _drawIndicator(canvas, ema20, xFor, yFor, AppColors.mint, 1.5);
    _drawIndicator(canvas, ema50, xFor, yFor, const Color(0xFFFFC857), 1.5);

    final volumeMax = candles.map((candle) => candle.volume).fold<double>(0, (a, b) => a > b ? a : b);
    final volumeBase = size.height - 8;
    const volumeHeight = 20.0;
    final gap = plot.width / candles.length;
    final bodyWidth = (gap * 0.58).clamp(1.4, 11.0).toDouble();
    final selected = selectedIndex.clamp(0, candles.length - 1).toInt();
    final crosshairPaint = Paint()..color = AppColors.muted.withValues(alpha: 0.5)..strokeWidth = 1;

    for (var i = 0; i < candles.length; i++) {
      final candle = candles[i];
      final bullish = candle.close >= candle.open;
      final color = bullish ? AppColors.mint : AppColors.red;
      final paint = Paint()..color = color..strokeWidth = 1;
      final x = xFor(i);
      canvas.drawLine(Offset(x, yFor(candle.high)), Offset(x, yFor(candle.low)), paint);
      final openY = yFor(candle.open);
      final closeY = yFor(candle.close);
      var rectTop = openY < closeY ? openY : closeY;
      var rectBottom = openY > closeY ? openY : closeY;
      if (rectBottom - rectTop < 1.5) rectBottom = rectTop + 1.5;
      canvas.drawRect(Rect.fromLTRB(x - bodyWidth / 2, rectTop, x + bodyWidth / 2, rectBottom), paint);
      if (volumeMax > 0) {
        final barHeight = (candle.volume / volumeMax * volumeHeight).clamp(1.0, volumeHeight).toDouble();
        canvas.drawRect(
          Rect.fromLTRB(x - bodyWidth / 2, volumeBase - barHeight, x + bodyWidth / 2, volumeBase),
          Paint()..color = color.withValues(alpha: 0.38),
        );
      }
    }

    final selectedX = xFor(selected);
    canvas.drawLine(Offset(selectedX, plot.top), Offset(selectedX, volumeBase), crosshairPaint);
    final selectedPrice = yFor(candles[selected].close);
    canvas.drawLine(Offset(plot.left, selectedPrice), Offset(plot.right, selectedPrice), crosshairPaint);
    _drawLabel(canvas, 'VOL', Offset(plot.left, volumeBase - volumeHeight - 12), AppColors.muted);
    _drawLabel(canvas, 'EMA 20', Offset(plot.left, size.height - 1), AppColors.mint);
    _drawLabel(canvas, 'EMA 50', Offset(plot.left + 55, size.height - 1), const Color(0xFFFFC857));
  }

  void _drawIndicator(
    Canvas canvas,
    List<double?>? values,
    double Function(int) xFor,
    double Function(double) yFor,
    Color color,
    double strokeWidth,
  ) {
    if (values == null || values.length != candles.length) return;
    final path = Path();
    var started = false;
    for (var i = 0; i < values.length; i++) {
      final value = values[i];
      if (value == null || !value.isFinite) {
        started = false;
        continue;
      }
      final point = Offset(xFor(i), yFor(value));
      if (!started) {
        path.moveTo(point.dx, point.dy);
        started = true;
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    canvas.drawPath(path, Paint()..color = color..strokeWidth = strokeWidth..style = PaintingStyle.stroke..strokeCap = StrokeCap.round);
  }

  void _drawLabel(Canvas canvas, String text, Offset position, Color color) {
    final textPainter = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w500)),
      textDirection: TextDirection.ltr,
      maxLines: 1,
    )..layout(maxWidth: 60);
    textPainter.paint(canvas, position);
  }

  @override
  bool shouldRepaint(covariant _CandlePainter oldDelegate) {
    return oldDelegate.candles != candles ||
        oldDelegate.indicators != indicators ||
        oldDelegate.selectedIndex != selectedIndex;
  }
}
