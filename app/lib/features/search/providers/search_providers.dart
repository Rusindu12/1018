import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/providers/app_providers.dart';
import '../../../data/models/catalog_item.dart';

/// Text currently in the search field.
class SearchQueryController extends Notifier<String> {
  @override
  String build() => '';

  void set(String query) => state = query;

  void clear() => state = '';
}

final NotifierProvider<SearchQueryController, String> searchQueryProvider =
    NotifierProvider<SearchQueryController, String>(SearchQueryController.new);

/// Scope chip under the search field: all / books / papers.
class SearchScopeController extends Notifier<ContentType?> {
  @override
  ContentType? build() => null;

  void set(ContentType? type) => state = type;
}

final NotifierProvider<SearchScopeController, ContentType?> searchScopeProvider =
    NotifierProvider<SearchScopeController, ContentType?>(SearchScopeController.new);

/// Debounced search results.
///
/// The `await` before querying is the debounce: when the user keeps typing,
/// Riverpod rebuilds this provider and the stale future's result is discarded,
/// so only the last keystroke reaches the repository.
class SearchResultsController extends AutoDisposeAsyncNotifier<List<CatalogItem>> {
  @override
  Future<List<CatalogItem>> build() async {
    final String query = ref.watch(searchQueryProvider).trim();
    final ContentType? scope = ref.watch(searchScopeProvider);

    if (query.length < 2) return const <CatalogItem>[];

    await Future<void>.delayed(AppConfig.searchDebounce);
    return ref.read(catalogRepositoryProvider).search(query, type: scope);
  }
}

final AsyncNotifierProvider<SearchResultsController, List<CatalogItem>> searchResultsProvider =
    AsyncNotifierProvider.autoDispose<SearchResultsController, List<CatalogItem>>(
  SearchResultsController.new,
);

/// Default suggestions shown before the user types: newest catalogue entries.
final FutureProvider<List<CatalogItem>> searchSuggestionsProvider =
    FutureProvider<List<CatalogItem>>((Ref ref) async {
  return ref.watch(catalogRepositoryProvider).recentlyAdded(limit: 8);
});
