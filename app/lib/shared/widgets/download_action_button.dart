import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/app_exception.dart';
import '../../core/providers/library_providers.dart';
import '../../core/router/app_router.dart';
import '../../data/models/catalog_item.dart';
import '../../data/models/downloaded_file.dart';
import '../../l10n/app_localizations.dart';
import 'app_snackbar.dart';

/// The item's entry in the download index, or null when not downloaded.
final downloadedFileProvider = Provider.family<DownloadedFile?, CatalogItem>(
  (Ref ref, CatalogItem item) {
    final List<DownloadedFile>? files = ref.watch(downloadsProvider).valueOrNull;
    if (files == null) return null;
    for (final DownloadedFile file in files) {
      if (file.itemId == item.id && file.type == item.type) return file;
    }
    return null;
  },
);

/// One button that covers the whole offline story:
///
///   not downloaded -> download icon  -> downloads (progress ring while running)
///   downloading    -> progress ring  -> cancels
///   downloaded     -> play/downloaded -> opens the local file
///
/// [compact] renders the icon-only variant used inside lists and cards.
class DownloadActionButton extends ConsumerWidget {
  const DownloadActionButton({
    super.key,
    required this.item,
    this.compact = true,
  });

  final CatalogItem item;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final DownloadedFile? file = ref.watch(downloadedFileProvider(item));
    final bool downloading = ref.watch(downloadManagerProvider).containsKey(itemKey(item));
    final double? progress = ref.watch(downloadManagerProvider)[itemKey(item)]?.fraction;

    if (downloading) {
      final Widget indicator = SizedBox(
        width: compact ? 20 : 22,
        height: compact ? 20 : 22,
        child: CircularProgressIndicator(
          value: progress,
          strokeWidth: 2.4,
        ),
      );
      if (compact) {
        return IconButton(
          tooltip: l10n.commonCancel,
          icon: indicator,
          onPressed: () => ref.read(downloadManagerProvider.notifier).cancel(item),
        );
      }
      return OutlinedButton.icon(
        onPressed: () => ref.read(downloadManagerProvider.notifier).cancel(item),
        icon: indicator,
        label: Text(l10n.commonCancel),
      );
    }

    if (file != null) {
      if (compact) {
        return IconButton(
          tooltip: l10n.downloadsPlayOffline,
          icon: Icon(Icons.offline_pin, color: Theme.of(context).colorScheme.primary),
          onPressed: () => AppRouter.openViewer(
            context,
            item: item,
            localPath: file.filePath,
          ),
        );
      }
      return FilledButton.tonalIcon(
        onPressed: () => AppRouter.openViewer(context, item: item, localPath: file.filePath),
        icon: const Icon(Icons.offline_pin),
        label: Text(l10n.downloadsPlayOffline),
      );
    }

    if (compact) {
      return IconButton(
        tooltip: l10n.commonDownload,
        icon: const Icon(Icons.download_for_offline_outlined),
        onPressed: () => startDownload(context, ref),
      );
    }
    return FilledButton.icon(
      onPressed: () => startDownload(context, ref),
      icon: const Icon(Icons.download_for_offline_outlined),
      label: Text(l10n.commonDownload),
    );
  }

  /// Starts the download and reports the outcome with translated messages.
  Future<void> startDownload(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    try {
      final DownloadedFile? file = await ref.read(downloadManagerProvider.notifier).start(item);
      if (file == null) return; // cancelled
      if (!context.mounted) return;
      AppSnackBar.show(
        context,
        message: l10n.viewerSavedOffline,
        actionLabel: l10n.commonOpen,
        onAction: () => AppRouter.openViewer(context, item: item, localPath: file.filePath),
      );
    } on Object catch (error) {
      final AppException exception = AppException.from(error);
      if (exception.kind == AppErrorKind.cancelled) return;
      messenger.showSnackBar(SnackBar(content: Text(AppSnackBar.messageFor(exception, l10n))));
    }
  }
}
