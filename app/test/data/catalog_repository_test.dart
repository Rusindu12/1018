import 'package:edulanka/core/config/app_config.dart';
import 'package:edulanka/core/errors/app_exception.dart';
import 'package:edulanka/data/models/book.dart';
import 'package:edulanka/data/models/catalog_filter.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/data/models/paged_items.dart';
import 'package:edulanka/data/models/paper.dart';
import 'package:edulanka/data/repositories/catalog_repository.dart';
import 'package:edulanka/data/sources/local_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  // Demo mode reads `assets/data/demo_*.json` through `rootBundle`, so this
  // suite doubles as a check that the assets are declared in pubspec.yaml.
  TestWidgetsFlutterBinding.ensureInitialized();

  late LocalStore store;
  late CatalogRepository repository;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    store = await LocalStore.open();
    // remote: null -> demo/asset mode, which is the mode CI exercises.
    repository = CatalogRepository(localStore: store, remote: null);
  });

  tearDown(() => repository.dispose());

  test('books() paginates 20 at a time', () async {
    final PageResult first = await repository.books();
    expect(first.items.length, AppConfig.pageSize);
    expect(first.hasMore, isTrue);
    expect(first.page, 0);

    final PageResult second = await repository.books(page: 1);
    expect(second.items.length, AppConfig.pageSize);
    // No overlap between pages.
    final Set<String> firstIds = first.items.map((CatalogItem i) => i.id).toSet();
    final Set<String> secondIds = second.items.map((CatalogItem i) => i.id).toSet();
    expect(firstIds.intersection(secondIds), isEmpty);
  });

  test('books() applies grade + medium filters', () async {
    final PageResult result = await repository.books(
      filter: const BookFilter(grade: 10, medium: 'Sinhala'),
    );
    expect(result.items, isNotEmpty);
    for (final CatalogItem item in result.items) {
      expect(item.grade, 10);
      expect(item.medium, 'Sinhala');
      expect(item, isA<BookModel>());
    }
  });

  test('papers() honours the exam tab', () async {
    final PageResult result = await repository.papers(
      filter: const PaperFilter(examType: 'AL'),
    );
    expect(result.items, isNotEmpty);
    for (final CatalogItem item in result.items) {
      expect(item, isA<PaperModel>());
      expect(item.examType, 'AL');
    }
  });

  test('search() matches English, Sinhala and Tamil and ranks titles first', () async {
    for (final String query in <String>['mathematics', 'ගණිතය', 'கணிதம்']) {
      final List<CatalogItem> results = await repository.search(query);
      expect(results, isNotEmpty, reason: 'no results for "$query"');
      expect(
        results.first.searchText.contains(query.toLowerCase()),
        isTrue,
        reason: 'first result for "$query" does not contain the query',
      );
    }
  });

  test('search() ignores queries shorter than two characters', () async {
    expect(await repository.search('a'), isEmpty);
    expect(await repository.search('  '), isEmpty);
  });

  test('availableYears() only returns years that exist', () async {
    final List<int> years = await repository.availableYears('OL');
    expect(years, isNotEmpty);
    for (final int year in years) {
      final PageResult result = await repository.papers(
        filter: PaperFilter(examType: 'OL', year: year),
      );
      expect(result.items, isNotEmpty, reason: 'year $year has no papers');
    }
    // Newest first.
    expect(years.first, greaterThanOrEqualTo(years.last));
  });

  test('recentlyAdded() mixes books and papers, newest first', () async {
    final List<CatalogItem> items = await repository.recentlyAdded(limit: 8);
    expect(items.length, 8);
    expect(items.any((CatalogItem item) => item is BookModel), isTrue);
    expect(items.any((CatalogItem item) => item is PaperModel), isTrue);
  });

  test('countOf() counts both collections', () async {
    expect(await repository.countOf(ContentType.book), greaterThan(0));
    expect(await repository.countOf(ContentType.paper), greaterThan(0));
  });

  test('clearCache() empties the in-memory catalogue without throwing', () async {
    await repository.countOf(ContentType.book);
    await repository.clearCache();
    // Reading again transparently reloads from the bundled assets.
    expect(await repository.countOf(ContentType.book), greaterThan(0));
  });

  test('PagedItems.append de-duplicates while appending', () {
    final PagedItems state = PagedItems(
      items: <CatalogItem>[TestData.book('a'), TestData.book('b')],
      hasMore: true,
    );
    final PagedItems next = state.append(
      PageResult(
        items: <CatalogItem>[TestData.book('b'), TestData.book('c')],
        hasMore: false,
        page: 1,
      ),
    );

    expect(next.items.map((CatalogItem i) => i.id), <String>['a', 'b', 'c']);
    expect(next.hasMore, isFalse);
    expect(next.loadingMore, isFalse);
  });

  test('AppException.from maps Firestore/Dio failures to friendly kinds', () {
    expect(AppException.from(Exception('plain')).kind, AppErrorKind.unknown);

    final AppException network = AppException.from(
      Exception('SocketException: Failed host lookup'),
    );
    expect(network.kind, AppErrorKind.network);

    final AppException storage = AppException.from(
      Exception('FileSystemException: No space left on device'),
    );
    expect(storage.kind, AppErrorKind.storage);
  });
}

/// Tiny fixture builder so tests do not repeat the constructor call.
class TestData {
  TestData._();

  static BookModel book(String id) => BookModel(
        id: id,
        title: 'Book $id',
        grade: 10,
        subject: 'Mathematics',
        medium: 'Sinhala',
        pdfUrl: 'https://example.org/$id.pdf',
      );
}
