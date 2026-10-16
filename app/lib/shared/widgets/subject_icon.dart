import 'package:flutter/material.dart';

/// Icon + colour per school subject.
///
/// Used for generated book covers (when a cover image is missing) and for the
/// paper tiles, so the catalogue stays visually scannable without spending
/// Storage space on artwork for 1000+ items.
class SubjectIcon {
  SubjectIcon._();

  static IconData iconFor(String subject) {
    final String key = subject.toLowerCase();
    if (key.contains('math')) return Icons.calculate_outlined;
    if (key.contains('science') || key.contains('biology')) return Icons.science_outlined;
    if (key.contains('physics')) return Icons.bolt_outlined;
    if (key.contains('chem')) return Icons.biotech_outlined;
    if (key.contains('sinhala')) return Icons.translate_outlined;
    if (key.contains('tamil')) return Icons.translate_outlined;
    if (key.contains('english')) return Icons.abc_outlined;
    if (key.contains('history')) return Icons.history_edu_outlined;
    if (key.contains('geograph')) return Icons.public_outlined;
    if (key.contains('ict') || key.contains('computer')) return Icons.memory_outlined;
    if (key.contains('agricult')) return Icons.agriculture_outlined;
    if (key.contains('buddh') || key.contains('hindu') || key.contains('islam') || key.contains('christ')) {
      return Icons.temple_buddhist_outlined;
    }
    if (key.contains('health') || key.contains('physical')) return Icons.sports_handball_outlined;
    if (key.contains('art') || key.contains('aesthetic')) return Icons.palette_outlined;
    if (key.contains('business') || key.contains('account') || key.contains('econom')) {
      return Icons.storefront_outlined;
    }
    if (key.contains('citizen')) return Icons.groups_outlined;
    if (key.contains('home') || key.contains('economic')) return Icons.home_outlined;
    return Icons.menu_book_outlined;
  }

  /// Deterministic pastel colour so the same subject always looks the same.
  static Color colorFor(String subject, {Brightness brightness = Brightness.light}) {
    const List<Color> palette = <Color>[
      Color(0xFF00695C),
      Color(0xFF1565C0),
      Color(0xFF6A1B9A),
      Color(0xFFEF6C00),
      Color(0xFF00838F),
      Color(0xFF2E7D32),
      Color(0xFFAD1457),
      Color(0xFF4527A0),
    ];
    final int hash = subject.toLowerCase().codeUnits.fold<int>(0, (int sum, int c) => sum + c);
    final Color color = palette[hash % palette.length];
    return brightness == Brightness.dark
        ? Color.alphaBlend(color.withValues(alpha: 0.45), const Color(0xFF101413))
        : color;
  }
}
