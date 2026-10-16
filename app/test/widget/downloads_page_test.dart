import 'package:edulanka/core/providers/app_providers.dart';
import 'package:edulanka/core/providers/library_providers.dart';
import 'package:edulanka/data/models/catalog_item.dart';
import 'package:edulanka/features/downloads/downloads_page.dart';
import 'package:edulanka/features/favorites/favorites_page.dart';
import 'package:edulanka/shared/widgets/empty_state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_harness.dart';

void main() {
  testWidgets('Downloads shows the empty state with guidance',
      (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(const DownloadsPage(), localStore: localStore),
    );
    await tester.pumpAndSettle();

    expect(find.byType(EmptyState), findsOneWidget);
    expect(find.text('No downloads yet'), findsOneWidget);
    expect(
      find.textContaining('open without internet'),
      findsOneWidget,
    );
  });

  testWidgets('Favorites empty state explains how to add items',
      (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(const FavoritesPage(), localStore: localStore),
    );
    await tester.pumpAndSettle();

    expect(find.text('No favorites yet'), findsOneWidget);
    expect(find.textContaining('heart icon'), findsOneWidget);
  });

  testWidgets('a favorited book appears in the list and survives a rebuild',
      (WidgetTester tester) async {
    final localStore = await emptyLocalStore();
    final ProviderContainer container = ProviderContainer(
      overrides: <Override>[localStoreProvider.overrideWithValue(localStore)],
    );
    addTearDown(container.dispose);

    await container.read(favoritesProvider.notifier).toggle(TestHarness.book);

    await tester.pumpWidget(
      wrapForTest(const FavoritesPage(), localStore: localStore),
    );
    await tester.pumpAndSettle();

    expect(find.text('Test Mathematics'), findsOneWidget);
    expect(find.byType(EmptyState), findsNothing);
    // The favourite is persisted, so a fresh controller reads it back.
    expect(itemKey(TestHarness.book), 'book:test_book');
  });
}
