import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/data/models/paper.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses an O/L paper document', () {
    final PaperModel paper = PaperModel.fromMap('ol2023_maths_p1', <String, dynamic>{
      'title': '2023 O/L Mathematics Paper 1',
      'examType': 'OL',
      'year': 2023,
      'subject': 'Mathematics',
      'medium': 'Sinhala',
      'paperType': 'Paper 1',
      'hasMarkingScheme': true,
      'pdfUrl': 'https://example.org/ol2023.pdf',
      'fileSize': '3.2 MB',
      'downloads': 800,
    });

    expect(paper.examType, 'OL');
    expect(paper.year, 2023);
    expect(paper.paperType, 'Paper 1');
    expect(paper.hasMarkingScheme, isTrue);
    expect(paper.type, ContentType.paper);
    expect(paper.subtitle, contains('2023'));
    expect(paper.searchText, contains('mathematics'));
  });

  test('marking scheme documents are detected from the paper type', () {
    final PaperModel scheme = PaperModel.fromMap('s1', <String, dynamic>{
      'title': '2023 O/L Mathematics Marking Scheme',
      'examType': 'OL',
      'year': 2023,
      'subject': 'Mathematics',
      'medium': 'Sinhala',
      'paperType': 'Marking Scheme',
      'pdfUrl': 'https://example.org/scheme.pdf',
    });

    expect(scheme.isMarkingScheme, isTrue);
    // Any document whose type is a marking scheme implies the key exists.
    expect(scheme.hasMarkingScheme, isTrue);
  });

  test('a year is always present even when the admin left it out', () {
    final PaperModel paper = PaperModel.fromMap('x', <String, dynamic>{
      'title': 'Term test',
      'examType': 'TermTest',
      'grade': 8,
      'term': 2,
      'pdfUrl': 'https://example.org/t.pdf',
    });

    expect(paper.year, DateTime.now().year);
    expect(paper.grade, 8);
    expect(paper.term, 2);
  });

  test('json round trip', () {
    const PaperModel paper = PaperModel(
      id: 'p1',
      title: '2022 A/L Physics Paper 2',
      examType: 'AL',
      year: 2022,
      subject: 'Physics',
      medium: 'English',
      pdfUrl: 'https://example.org/p.pdf',
      paperType: 'Paper 2',
      hasMarkingScheme: false,
      fileSize: '2.0 MB',
      fileSizeBytes: 2097152,
    );

    final CatalogItem? restored = catalogItemFromJson(paper.toJson());
    expect(restored, isA<PaperModel>());
    expect((restored! as PaperModel).year, 2022);
    expect(restored.examType, 'AL');
    expect(restored, paper);
  });
}
