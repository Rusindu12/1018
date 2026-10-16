import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/router/app_router.dart';
import '../../../core/utils/format_utils.dart';
import '../../../data/models/book.dart';
import '../../../data/models/downloaded_file.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/catalog_cover.dart';
import '../../../shared/widgets/download_action_button.dart';
import '../../../shared/widgets/favorite_button.dart';
import '../providers/books_providers.dart';

/// One textbook in the Books grid.
///
/// Layout: cover on top (fixed 3:4 ratio so the grid never jumps), title,
/// translated metadata, then a footer row with file size + favourite +
/// download/offline action.
class BookCard extends ConsumerWidget {
  const BookCard({super.key, required this.book});

  final BookModel book;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TextTheme text = Theme.of(context).textTheme;

    return AppCard(
      padding: const EdgeInsets.all(10),
      onTap: () => _open(context, ref),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          AspectRatio(
            aspectRatio: 3 / 4,
            child: CatalogCover(item: book, borderRadius: 10),
          ),
          const SizedBox(height: 10),
          Text(
            book.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, height: 1.25),
          ),
          const SizedBox(height: 4),
          Text(
            l10n.bookSubtitle(book),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const Spacer(),
          Row(
            children: <Widget>[
              Icon(
                Icons.picture_as_pdf_outlined,
                size: 14,
                color: Theme.of(context).colorScheme.outline,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  FormatUtils.safeSizeString(book.fileSize, fallbackBytes: book.fileSizeBytes),
                  style: text.labelSmall?.copyWith(color: Theme.of(context).colorScheme.outline),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              FavoriteButton(item: book, showSnackBar: false),
              DownloadActionButton(item: book),
            ],
          ),
        ],
      ),
    );
  }

  /// Opens the PDF - from the downloaded file when there is one, otherwise by
  /// streaming the remote URL (the viewer handles the download prompt).
  Future<void> _open(BuildContext context, WidgetRef ref) async {
    final DownloadedFile? file = ref.read(downloadedFileProvider(book));
    await AppRouter.openViewer(context, item: book, localPath: file?.filePath);
  }
}
