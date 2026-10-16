import 'catalog_item.dart';
import 'paper.dart';

/// Sentinel that lets `copyWith` tell "keep the current value" apart from
/// "clear this filter" (`copyWith(grade: null)`).
const Object _unset = Object();

/// Sorting options offered in the filter sheets.
enum SortOption { newest, oldest, titleAsc, downloadsDesc }

/// Comparator shared by books, papers and mixed search results.
int compareItems(CatalogItem a, CatalogItem b, SortOption sort) {
  switch (sort) {
    case SortOption.newest:
      final int byDate = (b.updatedAt?.millisecondsSinceEpoch ?? 0)
          .compareTo(a.updatedAt?.millisecondsSinceEpoch ?? 0);
      return byDate != 0 ? byDate : a.title.compareTo(b.title);
    case SortOption.oldest:
      final int byDate = (a.updatedAt?.millisecondsSinceEpoch ?? 0)
          .compareTo(b.updatedAt?.millisecondsSinceEpoch ?? 0);
      return byDate != 0 ? byDate : a.title.compareTo(b.title);
    case SortOption.titleAsc:
      return a.title.toLowerCase().compareTo(b.title.toLowerCase());
    case SortOption.downloadsDesc:
      return b.downloads.compareTo(a.downloads);
  }
}

/// Filter + sort state of the Books page.
///
/// Immutable: the UI pushes a new instance through the provider, which keeps
/// Riverpod dependency tracking predictable and makes the state easy to test.
class BookFilter {
  const BookFilter({
    this.grade,
    this.medium,
    this.subject,
    this.category,
    this.query = '',
    this.sort = SortOption.newest,
  });

  /// `null` = every grade.
  final int? grade;
  final String? medium;
  final String? subject;
  final String? category;
  final String query;
  final SortOption sort;

  bool get isEmpty =>
      grade == null &&
      medium == null &&
      subject == null &&
      category == null &&
      query.trim().isEmpty;

  /// Number of active chips - shown as a badge on the "Filters" button.
  int get activeCount =>
      <Object?>[grade, medium, subject, category].where((Object? v) => v != null).length;

  BookFilter copyWith({
    Object? grade = _unset,
    Object? medium = _unset,
    Object? subject = _unset,
    Object? category = _unset,
    String? query,
    SortOption? sort,
  }) {
    return BookFilter(
      grade: identical(grade, _unset) ? this.grade : grade as int?,
      medium: identical(medium, _unset) ? this.medium : medium as String?,
      subject: identical(subject, _unset) ? this.subject : subject as String?,
      category: identical(category, _unset) ? this.category : category as String?,
      query: query ?? this.query,
      sort: sort ?? this.sort,
    );
  }

  /// Resets every filter but keeps the chosen sort order.
  BookFilter cleared() => BookFilter(sort: sort);

  bool matches(CatalogItem item) {
    if (grade != null && item.grade != grade) return false;
    if (medium != null && item.medium.toLowerCase() != medium!.toLowerCase()) return false;
    if (subject != null && item.subject.toLowerCase() != subject!.toLowerCase()) return false;
    if (category != null && item.category != category) return false;
    final String needle = query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return item.searchText.contains(needle);
  }

  /// Filters + sorts an in-memory list (offline cache, demo catalogue, search).
  List<CatalogItem> apply(List<CatalogItem> items) {
    final List<CatalogItem> result =
        items.where((CatalogItem item) => item.type == ContentType.book && matches(item)).toList();
    result.sort((CatalogItem a, CatalogItem b) => compareItems(a, b, sort));
    return result;
  }
}

/// Filter + sort state of the Past Papers page (one instance per exam tab).
class PaperFilter {
  const PaperFilter({
    this.examType = 'OL',
    this.year,
    this.subject,
    this.medium,
    this.paperType,
    this.query = '',
    this.sort = SortOption.newest,
  });

  /// One of `OL`, `AL`, `Scholarship`, `TermTest`.
  final String examType;
  final int? year;
  final String? subject;
  final String? medium;
  final String? paperType;
  final String query;
  final SortOption sort;

  int get activeCount =>
      <Object?>[year, subject, medium, paperType].where((Object? v) => v != null).length;

  PaperFilter copyWith({
    String? examType,
    Object? year = _unset,
    Object? subject = _unset,
    Object? medium = _unset,
    Object? paperType = _unset,
    String? query,
    SortOption? sort,
  }) {
    return PaperFilter(
      examType: examType ?? this.examType,
      year: identical(year, _unset) ? this.year : year as int?,
      subject: identical(subject, _unset) ? this.subject : subject as String?,
      medium: identical(medium, _unset) ? this.medium : medium as String?,
      paperType: identical(paperType, _unset) ? this.paperType : paperType as String?,
      query: query ?? this.query,
      sort: sort ?? this.sort,
    );
  }

  /// Resets filters but keeps the exam tab and sort order.
  PaperFilter cleared() => PaperFilter(examType: examType, sort: sort);

  bool matches(CatalogItem item) {
    if (item is! PaperModel) return false;
    if (item.examType != examType) return false;
    if (year != null && item.year != year) return false;
    if (medium != null && item.medium.toLowerCase() != medium!.toLowerCase()) return false;
    if (subject != null && item.subject.toLowerCase() != subject!.toLowerCase()) return false;
    if (paperType != null && item.paperType != paperType) return false;
    final String needle = query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return item.searchText.contains(needle);
  }

  List<CatalogItem> apply(List<CatalogItem> items) {
    final List<CatalogItem> result = items.where(matches).toList();
    result.sort((CatalogItem a, CatalogItem b) => compareItems(a, b, sort));
    return result;
  }
}
