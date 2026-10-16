import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/catalog_constants.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/paged_catalog_controller.dart';
import '../../../data/models/catalog_filter.dart';
import '../../../data/models/book.dart';
import '../../../data/models/paged_items.dart';
import '../../../l10n/app_localizations.dart';
import '../../../l10n/catalog_names.dart';

/// Filter state of the Books tab. Changing it rebuilds [booksProvider] from
/// page 0.
class BooksFilterController extends Notifier<BookFilter> {
  @override
  BookFilter build() => const BookFilter();

  void setGrade(int? grade) => state = state.copyWith(grade: grade);

  void setMedium(String? medium) => state = state.copyWith(medium: medium);

  void setSubject(String? subject) => state = state.copyWith(subject: subject);

  void setCategory(String? category) => state = state.copyWith(category: category);

  void setQuery(String query) => state = state.copyWith(query: query);

  void setSort(SortOption sort) => state = state.copyWith(sort: sort);

  /// Resets every chip but keeps the sort order.
  void clear() => state = state.cleared();

  /// Used by the Home screen's grade shortcuts and the search screen's
  /// "browse books" hand-off.
  void applyFrom({int? grade, String? medium}) {
    state = state.copyWith(
      grade: grade,
      medium: medium,
    );
  }
}

final NotifierProvider<BooksFilterController, BookFilter> booksFilterProvider =
    NotifierProvider<BooksFilterController, BookFilter>(BooksFilterController.new);

/// Paged list of books for the active filter.
class BooksListController extends PagedCatalogController {
  @override
  void watchInputs() {
    ref.watch(booksFilterProvider);
  }

  @override
  Future<PageResult> fetchPage(int page) => ref.read(catalogRepositoryProvider).books(
        filter: ref.read(booksFilterProvider),
        page: page,
      );

  /// Type-safe accessor used by the grid (avoids casts in the widget tree).
  List<BookModel> get books {
    final PagedItems? items = state.valueOrNull;
    if (items == null) return const <BookModel>[];
    return items.items.whereType<BookModel>().toList(growable: false);
  }
}

final AsyncNotifierProvider<BooksListController, PagedItems> booksProvider =
    AsyncNotifierProvider.autoDispose<BooksListController, PagedItems>(BooksListController.new);

/// Distinct subjects present in the catalogue, for the subject filter sheet.
final FutureProvider<List<String>> availableSubjectsProvider =
    FutureProvider<List<String>>((Ref ref) async {
  final List<String> subjects = await ref.watch(catalogRepositoryProvider).filterSubjects();
  // A brand new install (or an empty Firestore project) still gets a usable
  // subject list, so the filter sheet is never empty.
  return subjects.isEmpty ? CatalogConstants.subjects : subjects;
});

/// Localisation-aware label helpers used by the filter chips.
extension BookFilterLabels on AppLocalizations {
  /// `Grade 10 · Mathematics · Sinhala`, fully translated.
  String bookSubtitle(BookModel book) =>
      '${gradeLabel(book.grade)} · ${subjectName(book.subject)} · ${mediumName(book.medium)}';
}
