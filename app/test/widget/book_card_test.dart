import 'package:edulanka/core/providers/library_providers.dart';
import 'package:edulanka/features/books/widgets/book_card.dart';
import 'package:edulanka/l10n/app_localizations.dart';
import 'package:edulanka/shared/widgets/catalog_cover.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_harness.dart';

void main() {
  testWidgets('BookCard shows title, metadata, size and both actions',
      (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(
        Scaffold(
          body: SizedBox(
            width: 220,
            height: 380,
            child: BookCard(book: TestHarness.book),
          ),
        ),
        localStore: localStore,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Test Mathematics'), findsOneWidget);
    // Grade/subject/medium are localised through the catalog extension.
    expect(find.textContaining('Grade 10'), findsWidgets);
    expect(find.text('1.0 MB'), findsOneWidget);
    // Favourite heart + download action.
    expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    expect(find.byIcon(Icons.download_for_offline_outlined), findsOneWidget);
    // No cover URL -> the generated subject cover is used.
    expect(find.byType(CatalogCover), findsOneWidget);
  });

  testWidgets('tapping the heart marks the book as favorite', (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(
        Scaffold(
          body: SizedBox(
            width: 220,
            height: 380,
            child: BookCard(book: TestHarness.book),
          ),
        ),
        localStore: localStore,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.favorite_border), findsOneWidget);

    await tester.tap(find.byIcon(Icons.favorite_border));
    await tester.pumpAndSettle();

    // The filled heart proves the favorites controller ran and notified the UI.
    expect(find.byIcon(Icons.favorite), findsOneWidget);
  });

  testWidgets('BookCard renders translated Sinhala metadata', (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(
        Scaffold(
          body: SizedBox(
            width: 220,
            height: 380,
            child: BookCard(book: TestHarness.book),
          ),
        ),
        localStore: localStore,
        locale: const Locale('si'),
      ),
    );
    await tester.pumpAndSettle();

    // "10 ශ්රේණිය · ගණිතය · සිංහල"
    expect(find.textContaining('10 ශ්‍රේණිය'), findsWidgets);
    expect(find.textContaining('ගණිතය'), findsWidgets);
  });
}
