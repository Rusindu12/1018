import '../../core/config/app_config.dart';
import 'local_store.dart';

/// The "recent searches" chips on the search screen.
class SearchHistoryStore {
  SearchHistoryStore(this._local);

  final LocalStore _local;

  /// Newest first, at most [AppConfig.maxRecentSearches] entries.
  List<String> load() => _local.getStringList(LocalKeys.searchHistory);

  Future<List<String>> add(String query) async {
    final String value = query.trim();
    if (value.length < 2) return load();
    final List<String> next = <String>[value]
      ..addAll(load().where((String item) => item.toLowerCase() != value.toLowerCase()));
    final List<String> trimmed = next.take(AppConfig.maxRecentSearches).toList();
    await _local.setStringList(LocalKeys.searchHistory, trimmed);
    return trimmed;
  }

  Future<List<String>> remove(String query) async {
    final List<String> next =
        load().where((String item) => item.toLowerCase() != query.trim().toLowerCase()).toList();
    await _local.setStringList(LocalKeys.searchHistory, next);
    return next;
  }

  Future<void> clear() => _local.remove(LocalKeys.searchHistory);
}
