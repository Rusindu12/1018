import 'package:cloud_firestore/cloud_firestore.dart';

/// Defensive converters for Firestore/admin-uploaded data.
///
/// Documents are created by hand in the admin panel, so a `grade` might arrive
/// as `10`, `"10"`, `10.0` or even missing. Nothing in the app should crash
/// because of that - these helpers always return a usable value.
class ParseUtils {
  ParseUtils._();

  static String str(dynamic value, {String fallback = ''}) {
    if (value == null) return fallback;
    if (value is String) return value.trim();
    if (value is num || value is bool) return '$value';
    return fallback;
  }

  static int integer(dynamic value, {int fallback = 0}) {
    if (value is int) return value;
    if (value is num) return value.round();
    if (value is String) {
      // Handles "10", "Grade 10", "10 "
      final RegExpMatch? match = RegExp(r'\d+').firstMatch(value);
      if (match != null) return int.tryParse(match.group(0)!) ?? fallback;
    }
    return fallback;
  }

  static double decimal(dynamic value, {double fallback = 0}) {
    if (value is double) return value;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value.replaceAll(RegExp(r'[^0-9.]'), '')) ?? fallback;
    return fallback;
  }

  static bool boolean(dynamic value, {bool fallback = false}) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final String v = value.toLowerCase().trim();
      if (v == 'true' || v == 'yes' || v == '1') return true;
      if (v == 'false' || v == 'no' || v == '0') return false;
    }
    return fallback;
  }

  /// Firestore `Timestamp` | ISO string | millis | `DateTime` -> `DateTime?`.
  static DateTime? date(dynamic value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is Timestamp) return value.toDate();
    if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
    if (value is String) return DateTime.tryParse(value) ?? DateTime.tryParse('${value}T00:00:00Z');
    return null;
  }

  /// Accepts a `List` (any element type), a single value, or a comma separated
  /// string: `"grade,medium"` -> `['grade', 'medium']`.
  static List<String> stringList(dynamic value) {
    if (value == null) return const <String>[];
    if (value is List) {
      return value
          .map((dynamic item) => str(item))
          .where((String item) => item.isNotEmpty)
          .toList(growable: false);
    }
    final String single = str(value);
    if (single.isEmpty) return const <String>[];
    return single
        .split(',')
        .map((String part) => part.trim())
        .where((String part) => part.isNotEmpty)
        .toList(growable: false);
  }

  /// Reads the first non-empty value found in [map] for any of [keys].
  /// Lets us tolerate `pdfUrl`, `pdf_url`, `fileUrl` style field naming.
  static dynamic pick(Map<String, dynamic> map, List<String> keys) {
    for (final String key in keys) {
      final dynamic value = map[key];
      if (value == null) continue;
      if (value is String && value.trim().isEmpty) continue;
      return value;
    }
    return null;
  }

  /// `12.5 MB` -> `13_107_200` bytes (used when Firestore stores a pretty size
  /// string instead of a byte count). Returns 0 when it cannot be parsed.
  static int bytesFromSizeString(String raw) {
    final RegExpMatch? match =
        RegExp(r'([0-9]+(?:\.[0-9]+)?)\s*(B|KB|MB|GB)?', caseSensitive: false).firstMatch(raw);
    if (match == null) return 0;
    final double value = double.tryParse(match.group(1) ?? '') ?? 0;
    final String unit = (match.group(2) ?? 'B').toUpperCase();
    const Map<String, int> factor = <String, int>{
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
    };
    return (value * (factor[unit] ?? 1)).round();
  }
}
