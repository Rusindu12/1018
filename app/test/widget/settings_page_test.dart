import 'package:edulanka/core/providers/app_providers.dart';
import 'package:edulanka/features/settings/settings_page.dart';
import 'package:flutter_test/flutter_test.dart';

import 'test_harness.dart';

void main() {
  testWidgets('Settings exposes theme, language and data sections',
      (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(const SettingsPage(), localStore: localStore),
    );
    await tester.pumpAndSettle();

    expect(find.text('Appearance'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('Data & storage'), findsOneWidget);
    expect(find.text('About'), findsWidgets);
    expect(find.text('Privacy policy'), findsOneWidget);
  });

  testWidgets('picking Sinhala persists the language and re-renders',
      (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(const SettingsPage(), localStore: localStore),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('සිංහල'));
    await tester.pumpAndSettle();

    // Persisted for the next launch...
    expect(localStore.getString('edulanka.language.v1'), 'si');
    // ...and applied immediately to the visible title.
    expect(find.text('සැකසුම්'), findsWidgets);
  });

  testWidgets('dark mode toggle is stored', (WidgetTester tester) async {
    final localStore = await emptyLocalStore();

    await tester.pumpWidget(
      wrapForTest(const SettingsPage(), localStore: localStore),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();

    expect(localStore.getString('edulanka.theme_mode.v1'), 'dark');
  });
}
