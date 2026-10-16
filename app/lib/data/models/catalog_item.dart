import 'dart:convert';

import 'book.dart';
import 'paper.dart';

/// What kind of catalogue entry an item is.
enum ContentType {
  book('book', 'books'),
  paper('paper', 'papers');

  const ContentType(this.key, this.collection);

  /// Stored in JSON (favorites/downloads) and in the `contentType` field.
  final String key;

  /// Firestore collection backing this type.
  final String collection;

  static ContentType fromKey(String? key) =>
      key == ContentType.paper.key ? ContentType.paper : ContentType.book;
}

/// Shared shape of [BookModel] and [PaperModel].
///
/// Favorites, downloads, search results and the "recently added" carousel all
/// mix books and papers, so every one of them works against this interface.
abstract class CatalogItem {
  /// Firestore document id (also the identity used by favorites/downloads).
  String get id;

  /// Displayed name, already in the medium the book/paper is written in.
  String get title;

  /// English subject key, localised with `l10n.subjectName(...)`.
  String get subject;

  /// `Sinhala` | `English` | `Tamil`.
  String get medium;

  /// Remote location of the PDF (Firebase Storage / any https URL).
  String get pdfUrl;

  /// Human readable size shown on the card (e.g. `12.5 MB`).
  String get fileSize;

  /// Size in bytes when known, used for download progress and storage totals.
  int get fileSizeBytes;

  /// Optional cover image (textbooks only).
  String? get coverUrl;

  int get downloads;

  DateTime? get updatedAt;

  ContentType get type;

  /// The item demoted to the fields we persist locally.
  Map<String, dynamic> toJson();

  /// One-line subtitle, e.g. `Grade 10 · Mathematics · Sinhala`.
  String get subtitle;

  // ------------------------------------------------------- optional metadata
  // Books and papers overlap on most filters, so the shared interface carries
  // the few extra fields either side may have. Concrete models narrow the
  // return type (e.g. `int grade` instead of `int? grade`) where the value is
  // always present.

  /// School grade. Always set for books, set for term-test papers.
  int? get grade => null;

  /// Edition year (books) / exam year (papers).
  int? get year => null;

  /// Book category (`textbook`, `workbook`, ...). Null for papers.
  String? get category => null;

  /// `OL` | `AL` | `Scholarship` | `TermTest`. Null for books.
  String? get examType => null;

  /// `Paper 1` | `Paper 2` | `Marking Scheme` ... Null for books.
  String? get paperType => null;

  /// Extra search tokens, also stored in Firestore for future server search.
  List<String> get keywords => const <String>[];

  /// Full text used by the client-side search fallback.
  String get searchText => <String>[
        title,
        subject,
        medium,
        subtitle,
        ...keywords,
      ].join(' ').toLowerCase();
}

/// Stable identity of an item across the local stores: `book:g10_maths_si`.
/// Prevents a book and a paper that happen to share a document id from
/// colliding inside the favourites/downloads indexes.
String itemKey(CatalogItem item) => '\${item.type.key}:\${item.id}';

/// Rebuilds a [CatalogItem] stored by [CatalogItem.toJson] (favorites cache,
/// downloads index, offline demo catalogue).
CatalogItem? catalogItemFromJson(Map<String, dynamic> json) {
  final ContentType type = ContentType.fromKey(json['type'] as String?);
  return type == ContentType.paper ? PaperModel.fromJson(json) : BookModel.fromJson(json);
}

/// Decodes a JSON list of catalogue items, skipping malformed entries.
List<CatalogItem> catalogItemsFromJsonList(dynamic raw) {
  if (raw == null) return const <CatalogItem>[];
  final dynamic decoded = raw is String ? jsonDecode(raw) : raw;
  if (decoded is! List) return const <CatalogItem>[];
  final List<CatalogItem> items = <CatalogItem>[];
  for (final dynamic entry in decoded) {
    if (entry is Map) {
      final CatalogItem? item = catalogItemFromJson(
        entry.map((dynamic key, dynamic value) => MapEntry<String, dynamic>('$key', value)),
      );
      if (item != null) items.add(item);
    }
  }
  return items;
}
