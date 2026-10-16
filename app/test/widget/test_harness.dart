import 'package:edulanka/core/providers/app_providers.dart';
import 'package:edulanka/data/models/book.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/data/models/paper.dart';
import 'package:edulanka/data/repositories/catalog_repository.dart';
import 'package:edulanka/data/sources/catalog_local_source.dart';
import 'package:edulanka/data/sources/local_store.dart';
import 'package:edulanka/features/favorites/favorites_page.dart';
import 'package:edulanka/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Shared helpers for widget tests: a temp file for downloads and an in-memory
/// catalogue, so tests never touch the network or the real Firestore.
class TestHarness {
  TestHarness._();

  static const BookModel book = BookModel(
    id: 'test_book',
    title: 'Test Mathematics',
    grade: 10,
    subject: 'Mathematics',
    medium: 'Sinhala',
    pdfUrl: 'https://example.org/test.pdf',
    fileSize: '1.0 MB',
    fileSizeBytes: 1048576,
  );

  static const PaperModel paper = PaperModel(
    id: 'test_paper',
    title: '2023 O/L Mathematics Paper 1',
    examType: 'OL',
    year: 2023,
    subject: 'Mathematics',
    medium: 'Sinhala',
    pdfUrl: 'https://example.org/paper.pdf',
    fileSize: '1.0 MB',
    fileSizeBytes: 1048576,
  );
}

/// In-memory catalogue source that replaces both Firestore and the assets.
class FakeCatalogSource {
  FakeCatalogSource({List<CatalogItem>? books, List<CatalogItem>? papers})
      : books = books ?? <CatalogItem>[TestHarness.book],
        papers = papers ?? <CatalogItem>[TestHarness.paper];

  final List<CatalogItem> books;
  final List<CatalogItem> papers;
}

/// Opens a [LocalStore] backed by an empty in-memory preference map.
Future<LocalStore> emptyLocalStore() async {
  SharedPreferences.setMockInitialValues(<String, Object>{});
  return LocalStore.open();
}

/// Builds a widget wrapped in everything a screen needs: Riverpod, localisation
/// delegates and a Material theme.
Widget wrapForTest(
  Widget child, {
  required LocalStore localStore,
  List<Override> extraOverrides = const <Override>[],
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    overrides: <Override>[
      localStoreProvider.overrideWithValue(localStore),
      ...extraOverrides,
    ],
    child: MaterialApp(
      locale: locale,
      supportedLocales: AppLanguage.supportedLocales,
      localizationsDelegates: const <LocalizationsDelegate<Object>>[
        AppLocalizationsDelegate(),
      ],
      home: child,
    ),
  );
}

/// Providers used by the fake catalogue tests.
final Provider<CatalogLocalSource> testLocalSourceProvider =
    Provider<CatalogLocalSource>((Ref ref) => CatalogLocalSource());

/// A repository wired to the bundled assets but no Firestore - the demo mode
/// behaviour, which is what CI runs against.
CatalogRepository demoRepository(LocalStore store) =>
    CatalogRepository(localStore: store, remote: null);

/// Alias so widget tests can mount the Favorites screen by a stable name.
typedef FavoritesHost = FavoritesPage;
