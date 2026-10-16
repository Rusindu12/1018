import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Keys used by every local store. Prefixed so a future migration (or the
/// admin panel's web build) can never collide with another app's keys.
class LocalKeys {
  LocalKeys._();

  static const String favorites = 'edulanka.favorites.v1';
  static const String downloads = 'edulanka.downloads.v1';
  static const String pageBookmarks = 'edulanka.page_bookmarks.v1';
  static const String searchHistory = 'edulanka.search_history.v1';
  static const String themeMode = 'edulanka.theme_mode.v1';
  static const String language = 'edulanka.language.v1';
  static const String sortBooks = 'edulanka.sort.books.v1';
  static const String sortPapers = 'edulanka.sort.papers.v1';

  /// Everything except [downloads] - used by "Reset app data".
  static const List<String> resettable = <String>[
    favorites,
    pageBookmarks,
    searchHistory,
    sortBooks,
    sortPapers,
  ];
}

/// Thin, typed, null-safe wrapper around [SharedPreferences].
///
/// Opened once in `main()` and injected through Riverpod, so every store gets
/// synchronous reads (the app never blocks a widget build on disk I/O).
class LocalStore {
  LocalStore(this._prefs);

  final SharedPreferences _prefs;

  static Future<LocalStore> open() async =>
      LocalStore(await SharedPreferences.getInstance());

  // ------------------------------------------------------------------ strings
  String? getString(String key) => _prefs.getString(key);

  Future<void> setString(String key, String value) => _prefs.setString(key, value);

  // -------------------------------------------------------------------- ints
  int? getInt(String key) => _prefs.getInt(key);

  Future<void> setInt(String key, int value) => _prefs.setInt(key, value);

  // -------------------------------------------------------------------- bools
  bool getBool(String key, {bool fallback = false}) =>
      _prefs.getBool(key) ?? fallback;

  Future<void> setBool(String key, bool value) => _prefs.setBool(key, value);

  // ------------------------------------------------------------- json helpers
  /// Reads a JSON encoded map (`{...}`); returns an empty map on any problem -
  /// a corrupted preference must never crash the app on launch.
  Map<String, dynamic> getMap(String key) {
    final String? raw = _prefs.getString(key);
    if (raw == null || raw.isEmpty) return <String, dynamic>{};
    try {
      final dynamic decoded = jsonDecode(raw);
      if (decoded is Map) {
        return decoded.map(
          (dynamic k, dynamic v) => MapEntry<String, dynamic>('$k', v),
        );
      }
    } catch (_) {
      // Corrupt value: drop it so the next write starts clean.
      _prefs.remove(key);
    }
    return <String, dynamic>{};
  }

  Future<void> setMap(String key, Map<String, dynamic> value) =>
      _prefs.setString(key, jsonEncode(value));

  /// Reads a JSON encoded list of maps. Malformed entries are skipped.
  List<Map<String, dynamic>> getMapList(String key) {
    final String? raw = _prefs.getString(key);
    if (raw == null || raw.isEmpty) return <Map<String, dynamic>>[];
    try {
      final dynamic decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .whereType<Map<dynamic, dynamic>>()
            .map((Map<dynamic, dynamic> entry) => entry.map(
                  (dynamic k, dynamic v) => MapEntry<String, dynamic>('$k', v),
                ))
            .toList();
      }
    } catch (_) {
      _prefs.remove(key);
    }
    return <Map<String, dynamic>>[];
  }

  Future<void> setMapList(String key, List<Map<String, dynamic>> value) =>
      _prefs.setString(key, jsonEncode(value));

  List<String> getStringList(String key) => _prefs.getStringList(key) ?? <String>[];

  Future<void> setStringList(String key, List<String> value) =>
      _prefs.setStringList(key, value);

  // ------------------------------------------------------------------ removal
  Future<void> remove(String key) => _prefs.remove(key);

  Future<void> removeAll(Iterable<String> keys) async {
    for (final String key in keys) {
      await _prefs.remove(key);
    }
  }

  /// Wipes favourites, bookmarks and history but keeps downloaded PDFs
  /// (deleting files is the Downloads screen's job).
  Future<void> resetAppData() => removeAll(LocalKeys.resettable);
}
