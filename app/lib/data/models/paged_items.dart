import 'catalog_item.dart';

/// One page returned by a catalogue query.
class PageResult {
  const PageResult({
    required this.items,
    required this.hasMore,
    this.page = 0,
  });

  final List<CatalogItem> items;

  /// True when another page is available (list length == pageSize).
  final bool hasMore;

  /// Zero-based page index.
  final int page;

  static const PageResult empty = PageResult(items: <CatalogItem>[], hasMore: false);
}

/// UI state of an infinite-scrolling list: the loaded items plus the flags the
/// footer widget needs ("loading more…", "retry", "no more items").
class PagedItems {
  const PagedItems({
    this.items = const <CatalogItem>[],
    this.hasMore = false,
    this.loadingMore = false,
    this.loadMoreError,
    this.page = 0,
  });

  final List<CatalogItem> items;
  final bool hasMore;
  final bool loadingMore;

  /// Non-null when appending the next page failed; the footer shows "Retry".
  final String? loadMoreError;

  final int page;

  bool get isEmpty => items.isEmpty;

  PagedItems copyWith({
    List<CatalogItem>? items,
    bool? hasMore,
    bool? loadingMore,
    String? loadMoreError,
    bool clearLoadMoreError = false,
    int? page,
  }) {
    return PagedItems(
      items: items ?? this.items,
      hasMore: hasMore ?? this.hasMore,
      loadingMore: loadingMore ?? this.loadingMore,
      loadMoreError: clearLoadMoreError ? null : (loadMoreError ?? this.loadMoreError),
      page: page ?? this.page,
    );
  }

  /// Appends a page while dropping duplicates (Firestore can repeat a document
  /// when new items are inserted between two page fetches).
  PagedItems append(PageResult result) {
    final Set<String> seen = items
        .map((CatalogItem item) => '${item.type.key}:${item.id}')
        .toSet();
    final List<CatalogItem> merged = List<CatalogItem>.from(items);
    for (final CatalogItem item in result.items) {
      if (seen.add('${item.type.key}:${item.id}')) merged.add(item);
    }
    return PagedItems(
      items: merged,
      hasMore: result.hasMore,
      loadingMore: false,
      page: result.page,
    );
  }
}
