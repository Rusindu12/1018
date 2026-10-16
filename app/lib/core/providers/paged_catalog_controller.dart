import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/paged_items.dart';
import '../errors/app_exception.dart';
import 'app_providers.dart';

/// Shared infinite-scroll logic for the Books and Past Papers lists.
///
/// Subclasses only say *what* to watch ([watchInputs]) and *how* to fetch a page
/// ([fetchPage]); paging, error handling and refresh behaviour live here once.
///
/// State is `AsyncValue<PagedItems>`:
///   * `AsyncLoading`  -> first page in flight (screens show skeletons)
///   * `AsyncData`     -> items + `hasMore` + `loadingMore` for the footer
///   * `AsyncError`    -> friendly error screen with a retry button
abstract class PagedCatalogController extends AutoDisposeAsyncNotifier<PagedItems> {
  /// Called inside `build()`: watch every provider whose change must reset the
  /// list back to page 0 (filters, sort order, search text...).
  void watchInputs();

  /// Loads one page (zero based) of the current, filtered result set.
  Future<PageResult> fetchPage(int page);

  @override
  Future<PagedItems> build() async {
    watchInputs();
    final PageResult first = await fetchPage(0);
    return PagedItems(items: first.items, hasMore: first.hasMore, page: first.page);
  }

  /// Appends the next page. Safe to call from a scroll listener: repeated calls
  /// while a page is in flight are ignored.
  Future<void> loadMore() async {
    final PagedItems? current = state.valueOrNull;
    if (current == null || current.loadingMore || !current.hasMore) return;

    state = AsyncData(current.copyWith(loadingMore: true, clearLoadMoreError: true));
    try {
      final PageResult next = await fetchPage(current.page + 1);
      state = AsyncData(current.append(next));
    } on Object catch (error, stack) {
      // Keep the items that are already on screen; the footer shows "Retry".
      state = AsyncData(
        current.copyWith(
          loadingMore: false,
          loadMoreError: AppException.from(error, stack).debugLabel,
        ),
      );
    }
  }

  /// Pull-to-refresh: reloads page 0 and keeps the current items visible while
  /// the request is running. Falls back to an error state when nothing is
  /// loaded yet (so the error screen can take over).
  Future<void> refresh() async {
    try {
      final PageResult first = await fetchPage(0);
      state = AsyncData(PagedItems(items: first.items, hasMore: first.hasMore, page: first.page));
    } on Object catch (error, stack) {
      if (state.valueOrNull == null) {
        state = AsyncError<PagedItems>(AppException.from(error, stack), stack);
      } else {
        state = AsyncData(
          state.valueOrNull!.copyWith(
            loadingMore: false,
            loadMoreError: AppException.from(error, stack).debugLabel,
          ),
        );
      }
    }
  }

  /// Forces a network refetch through the repository and then reloads page 0.
  Future<void> refreshFromNetwork() async {
    await ref.read(catalogRepositoryProvider).refresh();
    await refresh();
  }
}
