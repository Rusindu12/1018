import 'package:edulanka/data/models/book.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/data/models/downloaded_file.dart';
import 'package:edulanka/data/models/paper.dart';
import 'package:edulanka/data/sources/bookmarks_store.dart';
import 'package:edulanka/data/sources/downloads_store.dart';
import 'package:edulanka/data/sources/favorites_store.dart';
import 'package:edulanka/data/sources/local_store.dart';
import 'package:edulanka/data/sources/search_history_store.dart';
import 'package:edulanka/data/sources/settings_store.dart';
import 'package:edulanka/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const BookModel _book = BookModel(
  id: 'g10_maths',
  title: 'ගණිතය 10 ශ්‍රේණිය',
  grade: 10,
  subject: 'Mathematics',
  medium: 'Sinhala',
  pdfUrl: 'https://example.org/g10.pdf',
  fileSize: '12.5 MB',
  fileSizeBytes: 13107200,
);

const PaperModel _paper = PaperModel(
  id: 'ol2023_p1',
  title: '2023 O/L Mathematics Paper 1',
  examType: 'OL',
  year: 2023,
  subject: 'Mathematics',
  medium: 'Sinhala',
  pdfUrl: 'https://example.org/ol2023.pdf',
  fileSize: '3.2 MB',
);

void main() {
  late LocalStore local;

  setUp(() async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    local = await LocalStore.open();
  });

  group('FavoritesStore', () {
    test('saves and reloads books and papers together', () async {
      final FavoritesStore store = FavoritesStore(local);
      await store.save(<CatalogItem>[_book, _paper]);

      final List<CatalogItem> loaded = store.load();
      expect(loaded.length, 2);
      expect(loaded.first, isA<BookModel>());
      expect(loaded.first.title, 'ගණිතය 10 ශ්‍රේණිය');
      expect(loaded.last, isA<PaperModel>());
      expect(loaded.last.id, 'ol2023_p1');
    });

    test('a corrupted preference value does not crash the app', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        LocalKeys.favorites: 'this is not json',
      });
      final LocalStore corrupted = await LocalStore.open();
      expect(FavoritesStore(corrupted).load(), isEmpty);
    });

    test('item keys include the content type', () {
      expect(FavoritesStore.keyOf(_book), 'book:g10_maths');
      expect(FavoritesStore.keyOf(_paper), 'paper:ol2023_p1');
    });
  });

  group('DownloadsStore', () {
    test('stores metadata newest first and totals the size', () async {
      final DownloadsStore store = DownloadsStore(local);
      await store.save(<DownloadedFile>[
        DownloadedFile(
          item: _book,
          filePath: '/data/edulanka_downloads/book_g10.pdf',
          fileName: 'book_g10.pdf',
          sizeBytes: 1000,
          downloadedAt: DateTime(2024, 1, 1),
        ),
        DownloadedFile(
          item: _paper,
          filePath: '/data/edulanka_downloads/paper_ol2023.pdf',
          fileName: 'paper_ol2023.pdf',
          sizeBytes: 2000,
          downloadedAt: DateTime(2024, 6, 1),
        ),
      ]);

      final List<DownloadedFile> loaded = store.load();
      expect(loaded.first.itemId, 'ol2023_p1'); // newest first
      expect(store.totalBytes(loaded), 3000);
      expect(loaded.first.item, isA<PaperModel>());
    });

    test('entries without a file path are dropped', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        LocalKeys.downloads: '[{"item":{"type":"book","id":"x","title":"t"},'
            '"filePath":"","fileName":"","sizeBytes":1}]',
      });
      final LocalStore second = await LocalStore.open();
      expect(DownloadsStore(second).load(), isEmpty);
    });
  });

  group('BookmarksStore', () {
    test('round trips page numbers per item', () async {
      final BookmarksStore store = BookmarksStore(local);
      await store.save(<String, List<int>>{
        'book:g10_maths': <int>[3, 17],
        'paper:ol2023_p1': <int>[2],
      });

      final Map<String, List<int>> loaded = store.load();
      expect(loaded['book:g10_maths'], <int>[3, 17]);
      expect(loaded['paper:ol2023_p1'], <int>[2]);
    });

    test('empty bookmark lists are not persisted', () async {
      final BookmarksStore store = BookmarksStore(local);
      await store.save(<String, List<int>>{'book:x': <int>[]});
      expect(store.load(), isEmpty);
    });
  });

  group('SearchHistoryStore', () {
    test('keeps the newest first, removes duplicates, caps the list', () async {
      final SearchHistoryStore store = SearchHistoryStore(local);
      await store.add('ගණිතය');
      await store.add('science');
      await store.add('ගණිතය');

      final List<String> history = store.load();
      expect(history.first, 'ගණිතය');
      expect(history.length, 2);

      for (int i = 0; i < 15; i++) {
        await store.add('query $i');
      }
      expect(store.load().length, 10);
    });

    test('ignores one character queries', () async {
      final SearchHistoryStore store = SearchHistoryStore(local);
      await store.add('a');
      expect(store.load(), isEmpty);
    });
  });

  group('SettingsStore', () {
    test('defaults to system theme and device language', () {
      final SettingsStore store = SettingsStore(local);
      expect(store.loadThemeMode(), ThemeMode.system);
      expect(store.loadLanguage(), isNull);
    });

    test('persists theme and language', () async {
      final SettingsStore store = SettingsStore(local);
      await store.saveThemeMode(ThemeMode.dark);
      await store.saveLanguage(AppLanguage.sinhala);

      final SettingsStore reloaded = SettingsStore(await LocalStore.open());
      expect(reloaded.loadThemeMode(), ThemeMode.dark);
      expect(reloaded.loadLanguage(), AppLanguage.sinhala);
    });

    test('an unknown language code falls back to the device language', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        LocalKeys.language: 'fr',
      });
      final SettingsStore store = SettingsStore(await LocalStore.open());
      expect(store.loadLanguage(), isNull);
    });
  });

  test('resetAppData clears user data but keeps downloads', () async {
    final DownloadsStore downloads = DownloadsStore(local);
    await FavoritesStore(local).save(<CatalogItem>[_book]);
    await SearchHistoryStore(local).add('mathematics');
    await downloads.save(<DownloadedFile>[
      DownloadedFile(
        item: _book,
        filePath: '/tmp/a.pdf',
        fileName: 'a.pdf',
        sizeBytes: 10,
        downloadedAt: DateTime(2024, 1, 1),
      ),
    ]);

    await local.resetAppData();

    expect(FavoritesStore(local).load(), isEmpty);
    expect(SearchHistoryStore(local).load(), isEmpty);
    expect(downloads.load(), hasLength(1));
  });
}
