import 'package:flutter/material.dart';

import '../../data/models/paged_items.dart';
import '../../l10n/app_localizations.dart';

/// Footer of every infinite list: spinner while appending, "Retry" after a
/// failure, and a friendly end marker when everything is loaded.
class PagedFooter extends StatelessWidget {
  const PagedFooter({
    super.key,
    required this.state,
    required this.onRetry,
    required this.itemCount,
  });

  final PagedItems state;
  final VoidCallback onRetry;
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final ColorScheme colors = Theme.of(context).colorScheme;

    if (state.loadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 2.6),
          ),
        ),
      );
    }

    if (state.loadMoreError != null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Icon(Icons.error_outline, size: 18, color: colors.error),
            const SizedBox(width: 8),
            Text(l10n.errorUnknown, style: TextStyle(color: colors.error)),
            const SizedBox(width: 8),
            TextButton(onPressed: onRetry, child: Text(l10n.commonRetry)),
          ],
        ),
      );
    }

    if (state.hasMore) {
      // The scroll listener normally triggers this automatically; the button is
      // a fallback for short screens/tablets where no scroll event fires.
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Center(
          child: TextButton(onPressed: onRetry, child: Text(l10n.commonLoadMore)),
        ),
      );
    }

    if (itemCount == 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
      child: Center(
        child: Text(
          l10n.itemsCount(itemCount),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.onSurfaceVariant),
        ),
      ),
    );
  }
}
