import 'package:edulanka/core/utils/format_utils.dart';
import 'package:edulanka/core/utils/parse_utils.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FormatUtils.fileSize', () {
    test('formats every unit', () {
      expect(FormatUtils.fileSize(0), '0 B');
      expect(FormatUtils.fileSize(512), '512 B');
      expect(FormatUtils.fileSize(1024), '1.0 KB');
      expect(FormatUtils.fileSize(1536000), '1.5 MB');
      expect(FormatUtils.fileSize(12 * 1024 * 1024), '12 MB');
      expect(FormatUtils.fileSize(3 * 1024 * 1024 * 1024), '3.0 GB');
    });

    test('safeSizeString prefers the admin text and falls back to bytes', () {
      expect(FormatUtils.safeSizeString('12.5 MB'), '12.5 MB');
      expect(FormatUtils.safeSizeString('', fallbackBytes: 1048576), '1.0 MB');
      expect(FormatUtils.safeSizeString(null), '--');
    });
  });

  test('progressLabel shows percentage and transferred size', () {
    expect(FormatUtils.progressLabel(512, 1024), '50%  ·  512 B / 1.0 KB');
    expect(FormatUtils.progressLabel(2048, 0), '2.0 KB');
  });

  test('compactNumber shortens download counters', () {
    expect(FormatUtils.compactNumber(999), '999');
    expect(FormatUtils.compactNumber(1500), '1.5K');
    expect(FormatUtils.compactNumber(2000), '2K');
    expect(FormatUtils.compactNumber(1200000), '1.2M');
  });

  test('normalize and keywordsFrom build searchable tokens', () {
    expect(FormatUtils.normalize('  Grade  10  '), 'grade 10');
    final List<String> keywords =
        FormatUtils.keywordsFrom('ගණිතය 10', <String>['Mathematics', 'grade 10']);
    expect(keywords, contains('ගණිතය 10'));
    expect(keywords, contains('ගණිතය'));
    expect(keywords, contains('mathematics'));
  });

  group('ParseUtils', () {
    test('integer tolerates strings, doubles and nulls', () {
      expect(ParseUtils.integer(10), 10);
      expect(ParseUtils.integer('10'), 10);
      expect(ParseUtils.integer('Grade 11'), 11);
      expect(ParseUtils.integer(9.6), 10);
      expect(ParseUtils.integer(null, fallback: 1), 1);
    });

    test('bytesFromSizeString converts human sizes', () {
      expect(ParseUtils.bytesFromSizeString('12.5 MB'), 13107200);
      expect(ParseUtils.bytesFromSizeString('500 KB'), 512000);
      expect(ParseUtils.bytesFromSizeString('garbage'), 0);
    });

    test('stringList accepts lists and comma separated strings', () {
      expect(ParseUtils.stringList(<dynamic>['a', 'b']), <String>['a', 'b']);
      expect(ParseUtils.stringList('a, b ,c'), <String>['a', 'b', 'c']);
      expect(ParseUtils.stringList(null), isEmpty);
    });

    test('date understands ISO strings and millis', () {
      expect(ParseUtils.date('2024-06-15T09:00:00Z'), DateTime.utc(2024, 6, 15, 9));
      expect(ParseUtils.date(1720000000000)!.year, greaterThan(2023));
      expect(ParseUtils.date(null), isNull);
    });
  });

  test('ellipsis shortens without breaking words', () {
    expect(FormatUtils.ellipsis('Short', 10), 'Short');
    expect(FormatUtils.ellipsis('A very long book title indeed', 12), 'A very long…');
  });
}
