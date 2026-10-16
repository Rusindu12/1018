import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/router/app_router.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/book.dart';
import '../../data/models/catalog_item.dart';
import '../../data/models/downloaded_file.dart';
import '../../data/models/paper.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/catalog_names.dart';
import '../widgets/app_card.dart';
import '../widgets/catalog_cover.dart';
import '../widgets/download_action_button.dart';
import '../widgets/favorite_button.dart';

/// Mixed-content row: used by Search results, Favorites (books + papers in one
/// list) and the Home "recently added" carousel.
///
/// It renders books and papers with the same visual language while keeping
/// their specific metadata (grade vs. exam type) intact.
class CatalogListTile extends ConsumerWidget {
  const CatalogListTile({
    super.key,
    required this.item,
    this.showFavorite = true,
    this.showDownload = true,
    this.trailing,
    this.onTap,
  });

  final CatalogItem item;
  final bool showFavorite;
  final bool showDownload;

  /// Extra widget placed after the action buttons (e.g. a delete icon).
  final Widget? trailing;

  /// Overrides the default "open the PDF" behaviour (Favorites uses this to
  /// avoid opening a document while the user is rearranging the list).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TextTheme text = Theme.of(context).textTheme;

    return AppCard(
      padding: const EdgeInsets.all(10),
      onTap: onTap ?? () => _open(context, ref),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 52,
            height: 64,
            child: CatalogCover(item: item, showTypeBadge: true, borderRadius: 8),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, height: 1.25),
                ),
                const SizedBox(height: 4),
                Text(
                  _subtitle(l10n),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  FormatUtils.safeSizeString(item.fileSize, fallbackBytes: item.fileSizeBytes),
                  style: text.labelSmall?.copyWith(color: Theme.of(context).colorScheme.outline),
                ),
              ],
            ),
          ),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              if (showFavorite) FavoriteButton(item: item, showSnackBar: false),
              if (showDownload) DownloadActionButton(item: item),
              if (trailing != null) trailing!,
            ],
          ),
        ],
      ),
    );
  }

  /// Fully localised second line of the tile.
  String _subtitle(AppLocalizations l10n) {
    if (item is BookModel) {
      final BookModel book = item as BookModel;
      return '${l10n.gradeLabel(book.grade)} · ${l10n.subjectName(book.subject)} · '
          '${l10n.mediumName(book.medium)}';
    }
    if (item is PaperModel) {
      final PaperModel paper = item as PaperModel;
      return '${l10n.examTypeShort(paper.examType)} ${paper.year} · '
          '${l10n.subjectName(paper.subject)} · ${l10n.mediumName(paper.medium)} · '
          '${l10n.paperTypeName(paper.paperType)}';
    }
    return '${l10n.subjectName(item.subject)} · ${l10n.mediumName(item.medium)}';
  }

  Future<void> _open(BuildContext context, WidgetRef ref) async {
    final DownloadedFile? file = ref.read(downloadedFileProvider(item));
    await AppRouter.openViewer(context, item: item, localPath: file?.filePath);
  }
}
