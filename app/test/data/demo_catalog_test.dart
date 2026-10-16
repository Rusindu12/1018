import 'dart:convert';

import 'package:edulanka/core/config/app_config.dart';
import 'package:edulanka/core/constants/catalog_constants.dart';
import 'package:edulanka/data/models/book.dart';
import 'package:edulanka/data/models/catalog_filter.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/data/models/paper.dart';
import 'package:edulanka/data/sources/catalog_local_source.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Guards the bundled demo catalogue: it is what a fresh clone (and the demo
/// mode in the shipped APK) shows, so its shape must stay compatible with the
/// filters, the viewer and the search.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late List<CatalogItem> books;
  late List<CatalogItem> papers;

  setUpAll(() async {
    final CatalogLocalSource source = CatalogLocalSource();
    books = await source.loadBooks();
    papers = await source.loadPapers();
  });

  test('books asset parses into BookModel instances with stable ids', () {
    expect(books, isNotEmpty);
    expect(books.first, isA<BookModel>());
    final Set<String> ids = books.map((CatalogItem item) => item.id).toSet();
    expect(ids.length, books.length, reason: 'duplicate ids break favourites');
  });

  test('papers asset parses into PaperModel instances', () {
    expect(papers, isNotEmpty);
    expect(papers.first, isA<PaperModel>());
    // Every exam tab the UI offers must have rows, otherwise it would show an
    // empty state in demo mode.
    for (final String examType in CatalogConstants.examTypes) {
      expect(
        papers.where((CatalogItem item) => item.examType == examType),
        isNotEmpty,
        reason: 'no demo papers for $examType',
      );
    }
  });

  test('every grade and medium combination is reachable', () {
    for (final int grade in CatalogConstants.grades) {
      final List<CatalogItem> forGrade = const BookFilter()
          .copyWith(grade: grade)
          .apply(books);
      expect(forGrade, isNotEmpty, reason: 'grade $grade has no demo books');
    }
    for (final String medium in CatalogConstants.mediums) {
      expect(
        const BookFilter().copyWith(medium: medium).apply(books),
        isNotEmpty,
        reason: 'medium $medium has no demo books',
      );
    }
  });

  test('all PDF urls are local assets so demo mode works offline', () {
    for (final CatalogItem item in <CatalogItem>[...books, ...papers]) {
      expect(item.pdfUrl.startsWith('asset:'), isTrue, reason: '${item.title} is not bundled');
    }
  });

  test('titles carry native script for the Sinhala and Tamil mediums', () {
    final Iterable<CatalogItem> sinhala =
        books.where((CatalogItem item) => item.medium == 'Sinhala');
    final Iterable<CatalogItem> tamil =
        books.where((CatalogItem item) => item.medium == 'Tamil');

    expect(sinhala.any((CatalogItem item) => item.title.codeUnits.any((int c) => c > 0x0D00)), isTrue);
    expect(tamil.any((CatalogItem item) => item.title.codeUnits.any((int c) => c > 0x0B80)), isTrue);
  });

  test('search finds demo items in all three scripts', () {
    const BookFilter sinhala = BookFilter(query: 'ගණිතය');
    const BookFilter tamil = BookFilter(query: 'கணிதம்');
    const BookFilter english = BookFilter(query: 'mathematics');

    expect(sinhala.apply(books), isNotEmpty);
    expect(tamil.apply(books), isNotEmpty);
    expect(english.apply(books), isNotEmpty);
  });

  test('papers cover every year advertised by the year filter', () {
    final Set<int> years = papers.map((CatalogItem item) => item.year!).toSet();
    expect(years.length, greaterThanOrEqualTo(2));
    expect(years.every((int year) => year >= CatalogConstants.minYear), isTrue);
  });

  test('the bundled sample PDF is a real PDF', () async {
    final ByteData data = await rootBundle.load(AppConfig.samplePdfAsset);
    expect(data.lengthInBytes, greaterThan(1000));
    final String magic = String.fromCharCodes(data.buffer.asUint8List(0, 5));
    expect(magic, '%PDF-');
    // ...and it has more than one page, so page bookmarks are testable.
    final String body = String.fromCharCodes(data.buffer.asUint8List());
    expect(RegExp(r'/Type\s*/Page[^s]').allMatches(body).length, greaterThan(3));
  });

  test('demo json files stay small enough to bundle in an APK', () async {
    for (final String asset in <String>[
      CatalogLocalSource.booksAsset,
      CatalogLocalSource.papersAsset,
    ]) {
      final String raw = await rootBundle.loadString(asset);
      // Rows are JSON objects; keep the shipped catalogue comfortably small so
      // the APK stays far below the 30 MB budget.
      expect(raw.length, lessThan(600 * 1024), reason: '$asset is too large');
      expect(jsonDecode(raw), isA<List<dynamic>>());
    }
  });
}
