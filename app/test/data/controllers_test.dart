import 'package:edulanka/core/providers/app_providers.dart';
import 'package:edulanka/core/providers/library_providers.dart';
import 'package:edulanka/data/models/book.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/data/models/paper.dart';
import 'package:edulanka/data/sources/local_store.dart';
import 'package:edulanka/features/books/providers/books_providers.dart';
import 'package:edulanka/features/papers/providers/papers_providers.dart';
import 'package:edulanka/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const BookModel _book = BookModel(
  id: 'book_1',
  title: 'ගණිතය 10',
  grade: 10,
  subject: 'Mathematics',
  medium: 'Sinhala',
  pdfUrl: 'https://example.org/a.pdf',
);

const PaperModel _paper = PaperModel(
  id: 'paper_1',
  title: '2023 O/L Mathematics Paper 1',
  examType: 'OL',
  year: 2023,
  subject: 'Mathematics',
  medium: 'Sinhala',
  pdfUrl: 'https://example.org/b.pdf',
);

/// Exercises the Riverpod controllers directly (no widgets), which is where the
/// local-library logic actually lives.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final LocalStore store = await LocalStore.open();
    container = ProviderContainer(
      overrides: <Override>[localStoreProvider.overrideWithValue(store)],
    );
    addTearDown(container.dispose);
  });

  group('FavoritesController', () {
    test('toggles an item on and off and persists both ways', () async {
      expect(container.read(favoritesProvider), isEmpty);

      final bool added =
          await container.read(favoritesProvider.notifier).toggle(_book);
      expect(added, isTrue);
      expect(container.read(isFavoriteProvider(_book)), isTrue);

      final bool removed =
          await container.read(favoritesProvider.notifier).toggle(_book);
      expect(removed, isFalse);
      expect(container.read(isFavoriteProvider(_book)), isFalse);
    });

    test('keeps a book and a paper with the same document id apart', () async {
      const PaperModel clash = PaperModel(
        id: 'book_1', // same id as _book, different collection
        title: 'Clashing paper',
        examType: 'OL',
        year: 2023,
        subject: 'Science',
        medium: 'English',
        pdfUrl: 'https://example.org/c.pdf',
      );

      await container.read(favoritesProvider.notifier).toggle(_book);
      await container.read(favoritesProvider.notifier).toggle(clash);

      final List<CatalogItem> favorites = container.read(favoritesProvider);
      expect(favorites, hasLength(2));
      expect(favorites.map(itemKey).toSet(), <String>{'book:book_1', 'paper:book_1'});
    });

    test('removeAt + insertAt (the undo path) restores the order', () async {
      await container.read(favoritesProvider.notifier).toggle(_book);
      await container.read(favoritesProvider.notifier).toggle(_paper);

      await container.read(favoritesProvider.notifier).removeAt(0);
      expect(container.read(favoritesProvider).first.id, 'paper_1');

      await container.read(favoritesProvider.notifier).insertAt(0, _book);
      expect(container.read(favoritesProvider).first.id, 'book_1');
    });

    test('clearAll empties the list', () async {
      await container.read(favoritesProvider.notifier).toggle(_book);
      await container.read(favoritesProvider.notifier).clearAll();
      expect(container.read(favoritesProvider), isEmpty);
    });
  });

  group('BookmarksController', () {
    test('bookmarks pages, sorts them and drops the item when empty', () async {
      final BookmarksController controller = container.read(bookmarksProvider.notifier);

      expect(await controller.togglePage(_book, 5), isTrue);
      expect(await controller.togglePage(_book, 2), isTrue);
      expect(controller.pagesOf(_book), <int>[2, 5]);

      expect(await controller.togglePage(_book, 2), isFalse);
      expect(controller.pagesOf(_book), <int>[5]);

      await controller.togglePage(_book, 5);
      expect(controller.pagesOf(_book), isEmpty);
      expect(container.read(bookmarksProvider).containsKey('book:book_1'), isFalse);
    });
  });

  group('SearchHistoryController', () {
    test('stores recent queries newest first and clears them', () async {
      final SearchHistoryController controller =
          container.read(searchHistoryProvider.notifier);

      await controller.add('ගණිතය');
      await controller.add('2023 O/L');
      expect(container.read(searchHistoryProvider).first, '2023 O/L');

      await controller.remove('2023 O/L');
      expect(container.read(searchHistoryProvider), <String>['ගණිතය']);

      await controller.clear();
      expect(container.read(searchHistoryProvider), isEmpty);
    });
  });

  group('filters', () {
    test('BooksFilterController mutates and clears the filter', () {
      final BooksFilterController controller = container.read(booksFilterProvider.notifier);

      controller.setGrade(10);
      controller.setMedium('Sinhala');
      expect(container.read(booksFilterProvider).grade, 10);
      expect(container.read(booksFilterProvider).activeCount, 2);

      controller.clear();
      expect(container.read(booksFilterProvider).activeCount, 0);
    });

    test('PapersFilterController resets year/paper type when the tab changes', () {
      final PapersFilterController controller = container.read(papersFilterProvider.notifier);

      controller.setYear(2023);
      controller.setPaperType('Paper 2');
      controller.setExamType('AL');

      expect(container.read(papersFilterProvider).examType, 'AL');
      expect(container.read(papersFilterProvider).year, isNull);
      expect(container.read(papersFilterProvider).paperType, isNull);
      // Medium is intentionally kept across tabs.
      controller.setMedium('Tamil');
      controller.setExamType('OL');
      expect(container.read(papersFilterProvider).medium, 'Tamil');
    });
  });

  group('settings', () {
    test('theme and language changes are persisted', () async {
      final SettingsController controller = container.read(settingsProvider.notifier);

      await controller.setThemeMode(ThemeMode.dark);
      expect(container.read(settingsProvider).themeMode, ThemeMode.dark);

      await controller.toggleDarkMode();
      expect(container.read(settingsProvider).themeMode, ThemeMode.light);

      await controller.setLanguage(AppLanguage.tamil);
      expect(container.read(settingsProvider).language, AppLanguage.tamil);

      // "System default" clears the stored preference.
      await controller.setLanguage(null);
      expect(container.read(settingsProvider).isSystemLanguage, isTrue);
    });
  });
}
