import 'package:intl/intl.dart';

/// Small, dependency-free helpers used across the UI.
class FormatUtils {
  FormatUtils._();

  static const List<String> _units = <String>['B', 'KB', 'MB', 'GB'];

  /// `1536000` -> `1.5 MB`. Used by every list tile that shows a file size.
  static String fileSize(num bytes) {
    if (bytes <= 0) return '0 B';
    double size = bytes.toDouble();
    int unit = 0;
    while (size >= 1024 && unit < _units.length - 1) {
      size /= 1024;
      unit++;
    }
    final String value = size >= 100 || unit == 0
        ? size.toStringAsFixed(0)
        : size.toStringAsFixed(1);
    return '$value ${_units[unit]}';
  }

  /// Same as [fileSize] but for human readable strings coming from Firestore
  /// (e.g. "12.5 MB" written by the admin panel). Falls back to `--` on junk.
  static String safeSizeString(String? raw, {int fallbackBytes = 0}) {
    final String value = (raw ?? '').trim();
    if (value.isNotEmpty) return value;
    if (fallbackBytes > 0) return fileSize(fallbackBytes);
    return '--';
  }

  /// `1843200` -> `1.8 MB` for progress text.
  static String progressLabel(int received, int total) {
    if (total <= 0) return fileSize(received);
    final int percent = ((received / total) * 100).clamp(0, 100).round();
    return '$percent%  ·  ${fileSize(received)} / ${fileSize(total)}';
  }

  /// Firestore `Timestamp` or `DateTime` or ISO `String` -> `2024-06-15`.
  static String date(dynamic value) {
    final DateTime? parsed = parseDate(value);
    if (parsed == null) return '--';
    return DateFormat('yyyy-MM-dd').format(parsed);
  }

  static DateTime? parseDate(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value);
    // Firestore Timestamp without importing cloud_firestore into the utils layer.
    try {
      final dynamic millis = (value as dynamic).millisecondsSinceEpoch;
      if (millis is int) return DateTime.fromMillisecondsSinceEpoch(millis);
    } catch (_) {
      // Not a Timestamp - ignore.
    }
    return null;
  }

  /// Firestore `Timestamp` -> milliseconds since epoch (or 0).
  static int timestampMillis(dynamic value) =>
      parseDate(value)?.millisecondsSinceEpoch ?? 0;

  /// Normalises any text into lowercase latin-ish search tokens.
  /// Sinhala/Tamil scripts are unicode-safe (no diacritic stripping) so that
  /// `ගණිතය` still matches `ගණිතය`.
  static String normalize(String input) =>
      input.toLowerCase().trim().replaceAll(RegExp(r'\s+'), ' ');

  /// Splits a title into searchable keywords, used by the admin panel and the
  /// client-side fallback search.
  static List<String> keywordsFrom(String title, [List<String> extra = const <String>[]]) {
    final Set<String> tokens = <String>{};
    final String normalized = normalize(title);
    if (normalized.isNotEmpty) {
      tokens.add(normalized);
      for (final String word in normalized.split(' ')) {
        if (word.length > 1) tokens.add(word);
      }
    }
    for (final String item in extra) {
      final String value = normalize(item);
      if (value.isNotEmpty) tokens.add(value);
    }
    return tokens.toList(growable: false);
  }

  /// Chinese-remainder style shortening for long titles in tight cards.
  static String ellipsis(String value, int max) =>
      value.length <= max ? value : '${value.substring(0, max - 1).trimRight()}…';

  /// 1500 -> "1.5K", 1200000 -> "1.2M". Used for download counters.
  static String compactNumber(int value) {
    if (value < 1000) return '$value';
    if (value < 1000000) return '${(value / 1000).toStringAsFixed(value % 1000 == 0 ? 0 : 1)}K';
    return '${(value / 1000000).toStringAsFixed(1)}M';
  }
}
