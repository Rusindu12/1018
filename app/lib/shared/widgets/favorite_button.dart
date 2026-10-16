import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/library_providers.dart';
import '../../data/models/catalog_item.dart';
import '../../l10n/app_localizations.dart';

/// Heart toggle used on every book card, paper tile and the PDF viewer.
///
/// Favourites are local-only ([FavoritesController]) so the button works
/// offline and never spends a Firestore write.
class FavoriteButton extends ConsumerWidget {
  const FavoriteButton({
    super.key,
    required this.item,
    this.size = 20,
    this.showSnackBar = true,
  });

  final CatalogItem item;
  final double size;

  /// Set false inside dense lists to avoid snackbar spam.
  final bool showSnackBar;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bool isFavorite = ref.watch(isFavoriteProvider(item));
    final AppLocalizations l10n = context.l10n;

    return IconButton(
      tooltip: isFavorite ? l10n.favoritesTitle : l10n.homeSectionFavorites,
      visualDensity: VisualDensity.compact,
      iconSize: size,
      icon: Icon(
        isFavorite ? Icons.favorite : Icons.favorite_border,
        color: isFavorite ? const Color(0xFFE53935) : Theme.of(context).colorScheme.outline,
      ),
      onPressed: () async {
        final bool added = await ref.read(favoritesProvider.notifier).toggle(item);
        if (!context.mounted || !showSnackBar) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(added ? l10n.favoritesAdded : l10n.favoritesRemoved),
            duration: const Duration(milliseconds: 1200),
          ),
        );
      },
    );
  }
}
