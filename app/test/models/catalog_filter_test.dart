import 'package:edulanka/data/models/book.dart';
import 'package:edulanka/data/models/catalog_filter.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/data/models/paper.dart';
import 'package:flutter_test/flutter_test.dart';

BookModel _book({
  required String id,
  int grade = 10,
  String subject = 'Mathematics',
  String medium = 'Sinhala',
  String title = 'Book',
  int downloads = 0,
  DateTime? updatedAt,
}) =>
    BookModel(
      id: id,
      title: title,
      grade: grade,
      subject: subject,
      medium: medium,
      pdfUrl: 'https://example.org/$id.pdf',
      downloads: downloads,
      updatedAt: updatedAt,
    );

PaperModel _paper({
  required String id,
  String examType = 'OL',
  int year = 2023,
  String subject = 'Mathematics',
  String medium = 'Sinhala',
  String paperType = 'Paper 1',
  int downloads = 0,
}) =>
    PaperModel(
      id: id,
      title: '$year $examType $subject',
      examType: examType,
      year: year,
      subject: subject,
      medium: medium,
      pdfUrl: 'https://example.org/$id.pdf',
      paperType: paperType,
      downloads: downloads,
    );

void main() {
  group('BookFilter', () {
    test('matches on grade, medium and subject together', () {
      const BookFilter filter =
          BookFilter(grade: 10, medium: 'Sinhala', subject: 'Mathematics');

      expect(filter.matches(_book(id: 'a')), isTrue);
      expect(filter.matches(_book(id: 'b', grade: 9)), isFalse);
      expect(filter.matches(_book(id: 'c', medium: 'Tamil')), isFalse);
      expect(filter.matches(_book(id: 'd', subject: 'Science')), isFalse);
    });

    test('search matches Sinhala and Tamil script queries', () {
      final BookModel sinhala = _book(
        id: 'si',
        title: 'ගණිතය 10 ශ්‍රේණිය',
        medium: 'Sinhala',
      );
      final BookModel tamil = _book(
        id: 'ta',
        title: 'கணிதம் 10 ஆம் தரம்',
        medium: 'Tamil',
      );

      expect(const BookFilter(query: 'ගණිතය').matches(sinhala), isTrue);
      expect(const BookFilter(query: 'கணிதம்').matches(tamil), isTrue);
      // A latin query still finds the subject of a Sinhala book.
      expect(const BookFilter(query: 'mathematics').matches(sinhala), isTrue);
      expect(const BookFilter(query: 'science').matches(sinhala), isFalse);
    });

    test('copyWith can clear a filter while keeping the rest', () {
      const BookFilter filter = BookFilter(grade: 10, medium: 'Sinhala');

      final BookFilter cleared = filter.copyWith(grade: null);
      expect(cleared.grade, isNull);
      expect(cleared.medium, 'Sinhala');
      expect(cleared.activeCount, 1);
    });

    test('apply() filters books only and sorts them', () {
      final List<CatalogItem> items = <CatalogItem>[
        _book(id: 'old', downloads: 5, updatedAt: DateTime(2024, 1, 1)),
        _book(id: 'new', downloads: 1, updatedAt: DateTime(2024, 6, 1)),
        _paper(id: 'paper'),
      ];

      final List<CatalogItem> newest = const BookFilter().apply(items);
      // Papers are excluded, newest first.
      expect(newest.map((CatalogItem item) => item.id), <String>['new', 'old']);

      const BookFilter byDownloads = BookFilter(sort: SortOption.downloadsDesc);
      expect(byDownloads.apply(items).first.id, 'old');
    });
  });

  group('PaperFilter', () {
    test('filters by exam tab, year and paper type', () {
      const PaperFilter filter =
          PaperFilter(examType: 'AL', year: 2022, paperType: 'Paper 2');

      expect(
        filter.matches(_paper(id: 'ok', examType: 'AL', year: 2022, paperType: 'Paper 2')),
        isTrue,
      );
      expect(filter.matches(_paper(id: 'wrongYear', examType: 'AL', year: 2021, paperType: 'Paper 2')), isFalse);
      expect(filter.matches(_paper(id: 'otherExam')), isFalse);
      // Books are never included in a papers list.
      expect(filter.matches(_book(id: 'book')), isFalse);
    });

    test('cleared() keeps the exam tab', () {
      const PaperFilter filter = PaperFilter(examType: 'Scholarship', year: 2020, medium: 'Tamil');
      final PaperFilter cleared = filter.cleared();
      expect(cleared.examType, 'Scholarship');
      expect(cleared.year, isNull);
      expect(cleared.medium, isNull);
      expect(cleared.activeCount, 0);
    });
  });

  test('compareItems honours every sort option', () {
    final BookModel a = _book(id: 'a', title: 'Zeta', downloads: 10, updatedAt: DateTime(2024, 5, 1));
    final BookModel b = _book(id: 'b', title: 'Alpha', downloads: 90, updatedAt: DateTime(2024, 1, 1));

    expect(compareItems(a, b, SortOption.newest) < 0, isTrue);
    expect(compareItems(a, b, SortOption.oldest) > 0, isTrue);
    expect(compareItems(a, b, SortOption.titleAsc) > 0, isTrue);
    expect(compareItems(a, b, SortOption.downloadsDesc) > 0, isTrue);
  });
}
