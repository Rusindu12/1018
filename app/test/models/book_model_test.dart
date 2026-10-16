import 'package:edulanka/data/models/book.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('BookModel.fromMap', () {
    test('reads a well formed admin document', () {
      final BookModel book = BookModel.fromMap('g10_maths', <String, dynamic>{
        'title': 'ගණිතය 10 ශ්‍රේණිය',
        'grade': 10,
        'subject': 'Mathematics',
        'medium': 'Sinhala',
        'coverUrl': 'https://firebasestorage.example/cover.png',
        'pdfUrl': 'https://firebasestorage.example/g10.pdf',
        'fileSize': '12.5 MB',
        'fileSizeBytes': 13107200,
        'year': 2024,
        'category': 'textbook',
        'downloads': 1500,
      });

      expect(book.id, 'g10_maths');
      expect(book.grade, 10);
      expect(book.medium, 'Sinhala');
      expect(book.fileSizeBytes, 13107200);
      expect(book.year, 2024);
      expect(book.type, ContentType.book);
      expect(book.keywords, contains('Mathematics'));
      expect(book.keywords, contains('grade 10'));
    });

    test('survives a hand written document with renamed/missing fields', () {
      final BookModel book = BookModel.fromMap('legacy', <String, dynamic>{
        // "name" instead of "title", grade as a string, size only as text
        'name': 'Science Grade 9',
        'gradeLevel': '9',
        'subjectName': 'Science',
        'language': 'English',
        'fileUrl': 'https://example.org/science9.pdf',
        'size': '8 MB',
      });

      expect(book.title, 'Science Grade 9');
      expect(book.grade, 9);
      expect(book.subject, 'Science');
      expect(book.medium, 'English');
      expect(book.pdfUrl, 'https://example.org/science9.pdf');
      // Size text is converted to bytes so download progress still works.
      expect(book.fileSizeBytes, 8 * 1024 * 1024);
      expect(book.year, isNull);
      expect(book.coverUrl, isNull);
    });

    test('applies sensible defaults instead of throwing', () {
      final BookModel book = BookModel.fromMap('empty', <String, dynamic>{});

      expect(book.title, 'Untitled');
      expect(book.grade, 0);
      expect(book.medium, 'Sinhala');
      expect(book.pdfUrl, '');
      expect(book.downloads, 0);
    });
  });

  test('toJson/fromJson round trip keeps the fields favourites need', () {
    const BookModel book = BookModel(
      id: 'g6_science',
      title: 'විද්‍යාව 6 ශ්‍රේණිය',
      grade: 6,
      subject: 'Science',
      medium: 'Sinhala',
      pdfUrl: 'https://example.org/a.pdf',
      fileSize: '9.0 MB',
      fileSizeBytes: 9437184,
      category: 'textbook',
    );

    final CatalogItem? restored = catalogItemFromJson(book.toJson());

    expect(restored, isA<BookModel>());
    final BookModel copy = restored! as BookModel;
    expect(copy.id, book.id);
    expect(copy.title, book.title);
    expect(copy.grade, book.grade);
    expect(copy.fileSizeBytes, book.fileSizeBytes);
    // Equality is by id + type, which is what the local stores rely on.
    expect(copy, book);
  });

  test('itemKey separates books from papers with the same id', () {
    const BookModel book = BookModel(
      id: 'shared',
      title: 'B',
      grade: 1,
      subject: 'S',
      medium: 'Sinhala',
      pdfUrl: 'u',
    );
    expect(itemKey(book), 'book:shared');
  });
}
