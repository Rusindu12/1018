import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/ui_providers.dart';
import '../../l10n/app_localizations.dart';
import '../books/books_page.dart';
import '../papers/papers_page.dart';
import '../settings/settings_page.dart';
import 'home_page.dart';

/// Bottom-navigation shell hosting the four main tabs.
///
/// Uses an [IndexedStack] so scroll position, filters and loaded pages survive
/// tab switches (a student going back and forth between a book and its paper
/// should not lose their place).
class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int index = ref.watch(selectedTabProvider);
    final AppLocalizations l10n = context.l10n;

    return PopScope(
      // Back button on the Home tab minimises the app (the OS default); on any
      // other tab it returns to Home first, which is what users expect.
      canPop: index == AppTab.home,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        ref.read(selectedTabProvider.notifier).select(AppTab.home);
      },
      child: Scaffold(
        body: IndexedStack(
          index: index,
          children: const <Widget>[
            HomePage(),
            BooksPage(),
            PapersPage(),
            SettingsPage(),
          ],
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (int value) =>
              ref.read(selectedTabProvider.notifier).select(value),
          destinations: <NavigationDestination>[
            NavigationDestination(
              icon: const Icon(Icons.home_outlined),
              selectedIcon: const Icon(Icons.home_rounded),
              label: l10n.navHome,
            ),
            NavigationDestination(
              icon: const Icon(Icons.menu_book_outlined),
              selectedIcon: const Icon(Icons.menu_book_rounded),
              label: l10n.navBooks,
            ),
            NavigationDestination(
              icon: const Icon(Icons.description_outlined),
              selectedIcon: const Icon(Icons.description_rounded),
              label: l10n.navPapers,
            ),
            NavigationDestination(
              icon: const Icon(Icons.settings_outlined),
              selectedIcon: const Icon(Icons.settings_rounded),
              label: l10n.navSettings,
            ),
          ],
        ),
      ),
    );
  }
}
