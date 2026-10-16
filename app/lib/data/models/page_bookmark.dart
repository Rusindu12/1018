import '../../core/utils/parse_utils.dart';

/// Bookmarked pages of one PDF (the viewer's "bookmark page" button).
///
/// Page numbers are 1-based to match what the reader displays.
/// Persisted as a JSON map `{itemId: {pages: [3, 17], updatedAt: "..."}}`.
class PageBookmark {
  const PageBookmark({
    required this.itemId,
    required this.pages,
    required this.updatedAt,
  });

  final String itemId;

  /// Sorted, de-duplicated, 1-based page numbers.
  final List<int> pages;

  final DateTime updatedAt;

  bool contains(int page) => pages.contains(page);

  PageBookmark toggle(int page) {
    final List<int> next = List<int>.from(pages);
    if (next.remove(page)) {
      // removed
    } else {
      next.add(page);
      next.sort();
    }
    return PageBookmark(itemId: itemId, pages: next, updatedAt: DateTime.now());
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'pages': pages,
        'updatedAt': updatedAt.toIso8601String(),
      };

  static PageBookmark? fromJson(String itemId, dynamic raw) {
    if (raw is! Map) return null;
    final Map<String, dynamic> json =
        raw.map((dynamic k, dynamic v) => MapEntry<String, dynamic>('$k', v));
    final List<int> pages = (ParseUtils.stringList(json['pages']))
        .map((String value) => int.tryParse(value) ?? 0)
        .where((int page) => page > 0)
        .toList()
      ..sort();
    if (pages.isEmpty) return null;
    return PageBookmark(
      itemId: itemId,
      pages: pages,
      updatedAt: ParseUtils.date(json['updatedAt']) ?? DateTime.now(),
    );
  }
}
