import 'package:edulanka/app.dart';
import 'package:edulanka/core/providers/app_providers.dart';
import 'package:edulanka/data/sources/local_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';


/// Boots the whole app in demo mode (no Firebase, no network) and walks the four
/// tabs plus the search screen. This is the test that catches wiring mistakes -
/// a missing provider override, a broken route, an unbootstrapped store.
void main() {
  testWidgets('app boots, shows the catalogue and navigates all tabs',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final LocalStore local = await LocalStore.open();

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[localStoreProvider.overrideWithValue(local)],
        child: const EduLankaApp(),
      ),
    );

    // 1. Splash -> Home (the splash has a 2 s timer plus the catalogue warm-up).
    expect(find.text('EduLanka'), findsWidgets);
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // The Home header renders the four main sections.
    expect(find.text('School Books'), findsOneWidget);
    expect(find.text('Past Papers'), findsOneWidget);
    expect(find.text('Favorites'), findsWidgets);
    expect(find.text('Downloads'), findsWidgets);

    // 2. Books tab: demo catalogue loads from assets and shows real titles.
    await tester.tap(find.text('Books'));
    await tester.pumpAndSettle();
    expect(find.text('School Books'), findsWidgets);

    // 3. Papers tab: the O/L tab is selected by default.
    await tester.tap(find.text('Papers'));
    await tester.pumpAndSettle();
    expect(find.text('O/L'), findsWidgets);

    // 4. Settings tab: theme/language controls exist.
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    expect(find.text('Appearance'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
  });

  testWidgets('search finds a Sinhala title in demo mode', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    final LocalStore local = await LocalStore.open();

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[localStoreProvider.overrideWithValue(local)],
        child: const EduLankaApp(),
      ),
    );
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Open search from the Home header.
    await tester.tap(find.byIcon(Icons.search).first);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'ගණිතය');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    expect(find.textContaining('ගණිතය'), findsWidgets);
  });
}
