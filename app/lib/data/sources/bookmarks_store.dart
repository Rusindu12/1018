import '../models/page_bookmark.dart';
import 'local_store.dart';

/// Bookmarked pages per PDF, keyed by the same `type:id` key used by favorites.
class BookmarksStore {
  BookmarksStore(this._local);

  final LocalStore _local;

  /// `{'book:g10': [3, 17], 'paper:2023ol_p1': [2]}`
  Map<String, List<int>> load() {
    final Map<String, dynamic> raw = _local.getMap(LocalKeys.pageBookmarks);
    final Map<String, List<int>> result = <String, List<int>>{};
    raw.forEach((String key, dynamic value) {
      final PageBookmark? bookmark = PageBookmark.fromJson(key, value);
      if (bookmark != null) result[key] = bookmark.pages;
    });
    return result;
  }

  Future<void> save(Map<String, List<int>> bookmarks) {
    final Map<String, dynamic> payload = <String, dynamic>{};
    bookmarks.forEach((String key, List<int> pages) {
      if (pages.isEmpty) return;
      payload[key] = <String, dynamic>{
        'pages': pages,
        'updatedAt': DateTime.now().toIso8601String(),
      };
    });
    return _local.setMap(LocalKeys.pageBookmarks, payload);
  }
}
