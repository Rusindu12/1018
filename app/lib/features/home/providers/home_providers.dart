import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/app_providers.dart';
import '../../../data/models/catalog_item.dart';

/// "Recently added" carousel on the Home screen: newest books and papers mixed.
final FutureProvider<List<CatalogItem>> recentlyAddedProvider =
    FutureProvider<List<CatalogItem>>((Ref ref) async {
  return ref.watch(catalogRepositoryProvider).recentlyAdded(limit: 12);
});

/// Counters for the Home header - how many books and papers the catalogue has.
/// Served from the already loaded in-memory catalogue (no extra Firestore read).
final FutureProvider<CatalogCounts> catalogCountsProvider =
    FutureProvider<CatalogCounts>((Ref ref) async {
  final repository = ref.watch(catalogRepositoryProvider);
  final int books = await repository.countOf(ContentType.book);
  final int papers = await repository.countOf(ContentType.paper);
  return CatalogCounts(books: books, papers: papers);
});

/// Immutable result of [catalogCountsProvider].
class CatalogCounts {
  const CatalogCounts({required this.books, required this.papers});

  final int books;
  final int papers;

  static const CatalogCounts zero = CatalogCounts(books: 0, papers: 0);

  int get total => books + papers;
}
