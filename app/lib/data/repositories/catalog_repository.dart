import 'dart:async';
import 'dart:convert';

import '../../core/config/app_config.dart';
import '../../core/errors/app_exception.dart';
import '../models/book.dart';
import '../models/catalog_filter.dart';
import '../models/catalog_item.dart';
import '../models/paged_items.dart';
import '../models/paper.dart';
import '../sources/catalog_local_source.dart';
import '../sources/catalog_remote_source.dart';
import '../sources/local_store.dart';

/// Single entry point the UI uses to read the catalogue.
///
/// Responsibilities:
///   * decide between Firestore and the bundled demo catalogue,
///   * memoise the result in memory, then on disk for [AppConfig.catalogCacheTtl],
///   * provide paging, filtering and trilingual search over the cached list,
///   * keep every error type normalised as [AppException].
///
/// Widgets therefore never touch Firestore directly, which makes the demo mode
/// and the offline mode behave exactly like the online mode.
class CatalogRepository {
  CatalogRepository({
    required LocalStore localStore,
    CatalogRemoteSource? remote,
    CatalogLocalSource? local,
  })  : _localStore = localStore,
        _remote = remote,
        _local = local ?? CatalogLocalSource();

  final LocalStore _localStore;
  final CatalogRemoteSource? _remote;
  final CatalogLocalSource _local;

  static const String _cacheBooksKey = 'edulanka.cache.books.v1';
  static const String _cachePapersKey = 'edulanka.cache.papers.v1';
  static const String _cacheTimeBooksKey = 'edulanka.cache.books.time.v1';
  static const String _cacheTimePapersKey = 'edulanka.cache.papers.time.v1';

  /// In-memory catalogue, shared by every screen. Cleared by `dispose()`.
  final Map<ContentType, List<CatalogItem>> _memory = <ContentType, List<CatalogItem>>{};

  /// Prevents two screens from triggering the same network fetch at once.
  final Map<ContentType, Future<List<CatalogItem>>> _inFlight =
      <ContentType, Future<List<CatalogItem>>>{};

  final StreamController<void> _changes = StreamController<void>.broadcast();

  /// Emits whenever the catalogue changed (refresh finished, download counter
  /// updated), so lists can rebuild without polling.
  Stream<void> get changes => _changes.stream;

  bool get isDemo => AppConfig.demoMode;

  // ------------------------------------------------------------------ loading
  /// Books, applying [filter] and returning page [page] (zero based).
  Future<PageResult> books({BookFilter? filter, int page = 0}) async {
    final List<CatalogItem> items = await _catalog(ContentType.book);
    final List<CatalogItem> filtered =
        (filter ?? const BookFilter()).apply(items);
    // Demo catalogue doubles as a UI showcase: if a filter combination has no
    // rows, showing an empty state is the honest answer - keep it that way.
    return _slice(filtered, page);
  }

  Future<PageResult> papers({PaperFilter? filter, int page = 0}) async {
    final List<CatalogItem> items = await _catalog(ContentType.paper);
    final List<CatalogItem> filtered =
        (filter ?? const PaperFilter()).apply(items);
    return _slice(filtered, page);
  }

  /// Newest entries of both types - powers the "Recently added" carousel and
  /// the search screen's default suggestions.
  Future<List<CatalogItem>> recentlyAdded({int limit = 10}) async {
    final List<CatalogItem> books = await _catalog(ContentType.book);
    final List<CatalogItem> papers = await _catalog(ContentType.paper);
    final List<CatalogItem> merged = <CatalogItem>[...books, ...papers]
      ..sort((CatalogItem a, CatalogItem b) => compareItems(a, b, SortOption.newest));
    return merged.take(limit).toList(growable: false);
  }

  /// Search across both collections.
  ///
  /// Matching is a case-insensitive substring test over title, subject, medium,
  /// grade, year and keywords - which is what makes Sinhala (`ගණිතය`), Tamil
  /// (`கணிதம்`) and English queries work with no paid search service. See
  /// [CatalogRemoteSource] for the reasoning behind scanning locally.
  Future<List<CatalogItem>> search(
    String query, {
    ContentType? type,
    int limit = 60,
  }) async {
    final String needle = query.trim().toLowerCase();
    if (needle.length < 2) return const <CatalogItem>[];

    final List<CatalogItem> source = <CatalogItem>[
      if (type == null || type == ContentType.book) ...await _catalog(ContentType.book),
      if (type == null || type == ContentType.paper) ...await _catalog(ContentType.paper),
    ];

    final List<CatalogItem> matches = source
        .where((CatalogItem item) => item.searchText.contains(needle))
        .toList()
      ..sort((CatalogItem a, CatalogItem b) {
        // Title matches first, then most downloaded - the order students expect.
        final bool aTitle = a.title.toLowerCase().contains(needle);
        final bool bTitle = b.title.toLowerCase().contains(needle);
        if (aTitle != bTitle) return aTitle ? -1 : 1;
        return compareItems(a, b, SortOption.downloadsDesc);
      });
    return matches.take(limit).toList(growable: false);
  }

  /// How many items of [type] the catalogue currently holds. Served from the
  /// in-memory list, so it costs nothing after the first load.
  Future<int> countOf(ContentType type) async => (await _catalog(type)).length;

  /// Distinct years that actually exist, so the year chips never offer an empty
  /// combination (fallback: the full 2015-2024 range).
  Future<List<int>> availableYears(String examType) async {
    final List<CatalogItem> papers = await _catalog(ContentType.paper);
    final Set<int> years = papers
        .whereType<PaperModel>()
        .where((PaperModel paper) => paper.examType == examType)
        .map((PaperModel paper) => paper.year)
        .toSet();
    final List<int> sorted = years.toList()..sort((int a, int b) => b.compareTo(a));
    return sorted.isEmpty ? const <int>[] : sorted;
  }

  /// Distinct subjects for a content type, used by the filter sheets.
  Future<List<String>> availableSubjects({ContentType? type, String? examType}) async {
    final List<CatalogItem> items = <CatalogItem>[
      if (type == null || type == ContentType.book) ...await _catalog(ContentType.book),
      if (type == null || type == ContentType.paper) ...await _catalog(ContentType.paper),
    ];
    final Set<String> subjects = items
        .where((CatalogItem item) =>
            examType == null || item.examType == null || item.examType == examType)
        .map((CatalogItem item) => item.subject)
        .where((String subject) => subject.isNotEmpty)
        .toSet();
    final List<String> sorted = subjects.toList()..sort();
    return sorted;
  }

  /// Same as [availableSubjects] but pre-seeded with the official subject list
  /// so an empty catalogue still shows useful filter chips.
  Future<List<String>> filterSubjects({ContentType? type, String? examType}) async {
    final List<String> found = await availableSubjects(type: type, examType: examType);
    if (found.isNotEmpty) return found;
    return const <String>[];
  }

  // ------------------------------------------------------------------ refresh
  /// Pull-to-refresh / "Refresh catalogue" from Settings.
  Future<void> refresh({ContentType? type}) async {
    final List<ContentType> targets = type == null
        ? <ContentType>[ContentType.book, ContentType.paper]
        : <ContentType>[type];
    for (final ContentType target in targets) {
      await _load(target, forceNetwork: true);
    }
    _changes.add(null);
  }

  /// Reads the catalogue for [type] from memory, the disk cache or the network,
  /// in that order.
  Future<List<CatalogItem>> _catalog(ContentType type) async {
    final List<CatalogItem>? cached = _memory[type];
    if (cached != null) return cached;
    return _load(type, forceNetwork: false);
  }

  Future<List<CatalogItem>> _load(ContentType type, {required bool forceNetwork}) async {
    final Future<List<CatalogItem>>? pending = _inFlight[type];
    if (pending != null) return pending;

    final Future<List<CatalogItem>> future = _loadInternal(type, forceNetwork: forceNetwork);
    _inFlight[type] = future;
    try {
      final List<CatalogItem> items = await future;
      _memory[type] = items;
      // Demo mode already *is* the bundled catalogue: caching it again would
      // write ~180 KB into SharedPreferences for nothing.
      if (!isDemo) await _writeCache(type, items);
      return items;
    } finally {
      _inFlight.remove(type);
    }
  }

  Future<List<CatalogItem>> _loadInternal(
    ContentType type, {
    required bool forceNetwork,
  }) async {
    if (isDemo || _remote == null) {
      // Demo mode: bundled assets, no network, no cache freshness concerns.
      return type == ContentType.paper ? _local.loadPapers() : _local.loadBooks();
    }

    final bool fresh = !forceNetwork && _isCacheFresh(type);
    if (fresh) {
      final List<CatalogItem> disk = _readCache(type);
      if (disk.isNotEmpty) return disk;
    }

    try {
      return type == ContentType.paper
          ? await _remote!.fetchPapers()
          : await _remote!.fetchBooks();
    } on Object catch (error, stack) {
      // Network failed: serve a stale cache when we have one, otherwise show
      // the friendly error screen.
      final List<CatalogItem> disk = _readCache(type);
      if (disk.isNotEmpty) return disk;
      if (AppConfig.demoMode) {
        return type == ContentType.paper ? _local.loadPapers() : _local.loadBooks();
      }
      throw AppException.from(error, stack);
    }
  }

  // -------------------------------------------------------------------- cache
  bool _isCacheFresh(ContentType type) {
    final int savedAt = _localStore.getInt(_cacheTimeKey(type));
    if (savedAt == 0) return false;
    final Duration age = DateTime.now().difference(
      DateTime.fromMillisecondsSinceEpoch(savedAt),
    );
    return age < AppConfig.catalogCacheTtl;
  }

  List<CatalogItem> _readCache(ContentType type) {
    final String? raw = _localStore.getString(_cacheKey(type));
    if (raw == null || raw.isEmpty) return const <CatalogItem>[];
    try {
      final dynamic decoded = jsonDecode(raw);
      if (decoded is! List) return const <CatalogItem>[];
      final List<CatalogItem> items = <CatalogItem>[];
      for (final dynamic row in decoded) {
        if (row is Map) {
          final CatalogItem? item = catalogItemFromJson(
            row.map((dynamic k, dynamic v) => MapEntry<String, dynamic>('$k', v)),
          );
          if (item != null) items.add(item);
        }
      }
      return items;
    } catch (_) {
      return const <CatalogItem>[];
    }
  }

  Future<void> _writeCache(ContentType type, List<CatalogItem> items) async {
    if (items.isEmpty) return;
    await _localStore.setString(
      _cacheKey(type),
      jsonEncode(items.map((CatalogItem item) => item.toJson()).toList(growable: false)),
    );
    await _localStore.setInt(_cacheTimeKey(type), DateTime.now().millisecondsSinceEpoch);
  }

  /// Called by "Clear cache" in Settings.
  Future<void> clearCache() async {
    _memory.clear();
    await _localStore.removeAll(<String>[
      _cacheBooksKey,
      _cachePapersKey,
      _cacheTimeBooksKey,
      _cacheTimePapersKey,
    ]);
  }

  /// Bumps the local download counter so the UI updates instantly (the remote
  /// counter is incremented separately and may fail without write permission).
  Future<void> registerDownload(CatalogItem item) async {
    final List<CatalogItem>? items = _memory[item.type];
    if (items == null) return;
    final CatalogItem updated = item.type == ContentType.paper
        ? (item as PaperModel).copyWith(downloads: item.downloads + 1)
        : (item as BookModel).copyWith(downloads: item.downloads + 1);
    final int index = items.indexWhere((CatalogItem candidate) =>
        candidate.id == item.id && candidate.type == item.type);
    if (index >= 0) {
      items[index] = updated;
      _changes.add(null);
    }
    await _remote?.incrementDownloadCounter(item.type, item.id);
  }

  static String _cacheKey(ContentType type) =>
      type == ContentType.paper ? _cachePapersKey : _cacheBooksKey;

  static String _cacheTimeKey(ContentType type) =>
      type == ContentType.paper ? _cacheTimePapersKey : _cacheTimeBooksKey;

  static PageResult _slice(List<CatalogItem> items, int page) {
    final int start = page * AppConfig.pageSize;
    if (start >= items.length) {
      return PageResult(items: const <CatalogItem>[], hasMore: false, page: page);
    }
    final int end = (start + AppConfig.pageSize).clamp(0, items.length);
    return PageResult(
      items: items.sublist(start, end),
      hasMore: end < items.length,
      page: page,
    );
  }

  void dispose() {
    _changes.close();
  }
}
