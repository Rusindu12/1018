import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/library_providers.dart';
import '../../data/models/catalog_item.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/catalog_list_tile.dart';
import '../../shared/widgets/empty_state.dart';

/// Favorites screen: every bookmarked book and paper, swipe to remove with an
/// undo action (a mis-swipe while scrolling is easy to make).
class FavoritesPage extends ConsumerWidget {
  const FavoritesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final List<CatalogItem> favorites = ref.watch(favoritesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.favoritesTitle),
        actions: <Widget>[
          if (favorites.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(child: Text(l10n.itemsCount(favorites.length))),
            ),
        ],
      ),
      body: favorites.isEmpty
          ? EmptyState(
              icon: Icons.favorite_border,
              title: l10n.favoritesEmpty,
              message: l10n.favoritesEmptyHint,
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
              itemCount: favorites.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (BuildContext context, int index) {
                final CatalogItem item = favorites[index];
                return Dismissible(
                  key: ValueKey<String>('fav_${item.type.key}_${item.id}'),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Icon(
                      Icons.delete_outline,
                      color: Theme.of(context).colorScheme.onErrorContainer,
                    ),
                  ),
                  onDismissed: (_) => _remove(context, ref, index, item),
                  child: CatalogListTile(item: item),
                );
              },
            ),
    );
  }

  /// Removes the entry and offers an undo that restores its position.
  Future<void> _remove(
    BuildContext context,
    WidgetRef ref,
    int index,
    CatalogItem item,
  ) async {
    final AppLocalizations l10n = context.l10n;
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    await ref.read(favoritesProvider.notifier).removeAt(index);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(l10n.favoritesRemoved),
          duration: const Duration(seconds: 4),
          action: SnackBarAction(
            label: l10n.favoritesUndo,
            onPressed: () => ref.read(favoritesProvider.notifier).insertAt(index, item),
          ),
        ),
      );
  }
}
