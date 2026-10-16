import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/catalog_item.dart';
import '../../data/models/downloaded_file.dart';
import '../../data/repositories/download_repository.dart';
import '../../data/sources/bookmarks_store.dart';
import '../../data/sources/favorites_store.dart';
import '../../data/sources/search_history_store.dart';
import '../errors/app_exception.dart';
import 'app_providers.dart';

/// Providers for "the user's own library": favourites, page bookmarks,
/// downloads and search history. All of it is local-only and free.

// ----------------------------------------------------------------- favorites
class FavoritesController extends Notifier<List<CatalogItem>> {
  late FavoritesStore _store;

  @override
  List<CatalogItem> build() {
    _store = FavoritesStore(ref.watch(localStoreProvider));
    return _store.load();
  }

  bool contains(CatalogItem item) =>
      state.any((CatalogItem entry) => itemKey(entry) == itemKey(item));

  /// Adds or removes [item]; returns true when it ended up favourited.
  Future<bool> toggle(CatalogItem item) async {
    final List<CatalogItem> next = List<CatalogItem>.from(state);
    final int index =
        next.indexWhere((CatalogItem entry) => itemKey(entry) == itemKey(item));
    final bool nowFavorite = index < 0;
    if (nowFavorite) {
      next.insert(0, item); // newest first
    } else {
      next.removeAt(index);
    }
    state = next;
    await _store.save(next);
    return nowFavorite;
  }

  /// Swipe-to-remove.
  Future<void> removeAt(int index) async {
    if (index < 0 || index >= state.length) return;
    final List<CatalogItem> next = List<CatalogItem>.from(state)..removeAt(index);
    state = next;
    await _store.save(next);
  }

  /// "Reset app data" in Settings: forget every favourite.
  Future<void> clearAll() async {
    state = const <CatalogItem>[];
    await _store.save(const <CatalogItem>[]);
  }

  /// Undo of [removeAt] - restores the original position.
  Future<void> insertAt(int index, CatalogItem item) async {
    final List<CatalogItem> next = List<CatalogItem>.from(state);
    next.insert(index.clamp(0, next.length), item);
    state = next;
    await _store.save(next);
  }
}

final NotifierProvider<FavoritesController, List<CatalogItem>> favoritesProvider =
    NotifierProvider<FavoritesController, List<CatalogItem>>(FavoritesController.new);

/// `true` when [item] is favourited - a tiny provider so list tiles rebuild
/// only when their own item changes.
final isFavoriteProvider = Provider.family<bool, CatalogItem>(
  (Ref ref, CatalogItem item) => ref
      .watch(favoritesProvider)
      .any((CatalogItem entry) => itemKey(entry) == itemKey(item)),
);

// ------------------------------------------------------------ page bookmarks
class BookmarksController extends Notifier<Map<String, List<int>>> {
  late BookmarksStore _store;

  @override
  Map<String, List<int>> build() {
    _store = BookmarksStore(ref.watch(localStoreProvider));
    return _store.load();
  }

  List<int> pagesOf(CatalogItem item) =>
      state[itemKey(item)] ?? const <int>[];

  /// "Reset app data" in Settings: forget every bookmarked page.
  Future<void> clearAll() async {
    state = const <String, List<int>>{};
    await _store.save(const <String, List<int>>{});
  }

  /// Returns true when the page ended up bookmarked.
  Future<bool> togglePage(CatalogItem item, int page) async {
    final String key = itemKey(item);
    final Map<String, List<int>> next =
        state.map((String k, List<int> v) => MapEntry<String, List<int>>(k, List<int>.from(v)));
    final List<int> pages = next[key] ?? <int>[];
    final bool added = !pages.remove(page);
    if (added) pages.add(page);
    pages.sort();
    if (pages.isEmpty) {
      next.remove(key);
    } else {
      next[key] = pages;
    }
    state = next;
    await _store.save(next);
    return added;
  }
}

final NotifierProvider<BookmarksController, Map<String, List<int>>> bookmarksProvider =
    NotifierProvider<BookmarksController, Map<String, List<int>>>(BookmarksController.new);

// ----------------------------------------------------------------- downloads
/// The download index, reconciled with what is really on disk.
class DownloadsController extends AsyncNotifier<List<DownloadedFile>> {
  DownloadRepository get _repository => ref.read(downloadRepositoryProvider);

  @override
  Future<List<DownloadedFile>> build() {
    // Rebuild when the underlying preference store is swapped (tests) ...
    ref.watch(localStoreProvider);
    // ... and keep the index in sync with what really exists on disk: files can
    // disappear (storage cleanup, app-data restore) and the UI must not offer
    // to open a file that is gone.
    return _load();
  }

  Future<List<DownloadedFile>> _load() async {
    final List<DownloadedFile> stored = ref.read(downloadsStoreProvider).load();
    return _repository.reconcile(stored);
  }

  /// Re-reads the index after a download was added or a file deleted.
  Future<void> reload() async {
    state = await AsyncValue.guard(_load);
  }

  Future<void> delete(DownloadedFile file) async {
    await _repository.delete(file);
    await reload();
  }

  Future<void> deleteAll() async {
    await _repository.deleteAll(state.valueOrNull ?? const <DownloadedFile>[]);
    await reload();
  }

  /// True when the item is fully downloaded (checks index + file).
  Future<bool> isDownloaded(CatalogItem item) async =>
      await _repository.isDownloaded(item);
}

final AsyncNotifierProvider<DownloadsController, List<DownloadedFile>> downloadsProvider =
    AsyncNotifierProvider<DownloadsController, List<DownloadedFile>>(DownloadsController.new);

/// In-flight downloads, keyed by `itemKey`. `build()` starts empty.
class DownloadManager extends Notifier<Map<String, DownloadProgress>> {
  final Map<String, CancelToken> _tokens = <String, CancelToken>{};

  @override
  Map<String, DownloadProgress> build() {
    ref.onDispose(() {
      // Cancel every pending transfer when the app tears down.
      for (final CancelToken token in _tokens.values) {
        token.cancel('disposed');
      }
      _tokens.clear();
    });
    return const <String, DownloadProgress>{};
  }

  bool isDownloading(CatalogItem item) => state.containsKey(itemKey(item));

  double? progressOf(CatalogItem item) => state[itemKey(item)]?.fraction;

  /// Downloads [item], reporting progress and refreshing the Downloads list.
  ///
  /// Returns null when the user cancelled; throws [AppException] on failure so
  /// the caller can show the right message (offline, no space, bad file...).
  Future<DownloadedFile?> start(CatalogItem item) async {
    final String key = itemKey(item);
    if (isDownloading(item)) return null;

    final CancelToken token = CancelToken();
    _tokens[key] = token;
    _updateProgress(DownloadProgress(itemId: key, received: 0, total: 0));

    try {
      final DownloadedFile file = await ref.read(downloadRepositoryProvider).download(
            item,
            cancelToken: token,
            onProgress: (DownloadProgress progress) => _updateProgress(progress),
          );
      await ref.read(catalogRepositoryProvider).registerDownload(item);
      await ref.read(downloadsProvider.notifier).reload();
      return file;
    } finally {
      _tokens.remove(key);
      _removeProgress(key);
    }
  }

  void cancel(CatalogItem item) {
    _tokens[itemKey(item)]?.cancel('user');
  }

  void _updateProgress(DownloadProgress progress) {
    // Ignore late callbacks from a cancelled transfer.
    if (!_tokens.containsKey(progress.itemId)) return;
    state = <String, DownloadProgress>{...state, progress.itemId: progress};
  }

  void _removeProgress(String key) {
    if (!state.containsKey(key)) return;
    state = <String, DownloadProgress>{...state}..remove(key);
  }
}

final NotifierProvider<DownloadManager, Map<String, DownloadProgress>> downloadManagerProvider =
    NotifierProvider<DownloadManager, Map<String, DownloadProgress>>(DownloadManager.new);

/// Bytes used by all downloaded PDFs (Downloads screen header).
final FutureProvider<int> downloadsUsedBytesProvider = FutureProvider<int>((Ref ref) async {
  final List<DownloadedFile> files = await ref.watch(downloadsProvider.future);
  return ref.read(downloadRepositoryProvider).usedBytes(files);
});

// ------------------------------------------------------------ search history
class SearchHistoryController extends Notifier<List<String>> {
  late SearchHistoryStore _store;

  @override
  List<String> build() {
    _store = SearchHistoryStore(ref.watch(localStoreProvider));
    return _store.load();
  }

  Future<void> add(String query) async {
    state = await _store.add(query);
  }

  Future<void> remove(String query) async {
    state = await _store.remove(query);
  }

  Future<void> clear() async {
    await _store.clear();
    state = const <String>[];
  }
}

final NotifierProvider<SearchHistoryController, List<String>> searchHistoryProvider =
    NotifierProvider<SearchHistoryController, List<String>>(SearchHistoryController.new);
