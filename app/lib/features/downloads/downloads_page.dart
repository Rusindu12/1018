import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/library_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/catalog_item.dart';
import '../../data/models/downloaded_file.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/catalog_names.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/catalog_cover.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state_view.dart';
import '../../shared/widgets/loading_skeleton.dart';

/// Downloads screen: the offline library.
///
/// Everything listed here opens with no network at all, which is the main reason
/// students install the app in the first place.
class DownloadsPage extends ConsumerWidget {
  const DownloadsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<List<DownloadedFile>> async = ref.watch(downloadsProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.downloadsTitle),
        actions: <Widget>[
          async.maybeWhen(
            data: (List<DownloadedFile> files) => files.isEmpty
                ? const SizedBox.shrink()
                : IconButton(
                    tooltip: l10n.downloadsClearAll,
                    icon: const Icon(Icons.delete_sweep_outlined),
                    onPressed: () => _confirmDeleteAll(context, ref, files.length),
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: async.when(
        loading: () => const ListSkeleton(),
        error: (Object error, StackTrace stack) => ErrorStateView(
          error: error,
          onRetry: () => ref.invalidate(downloadsProvider),
        ),
        data: (List<DownloadedFile> files) {
          if (files.isEmpty) {
            return EmptyState(
              icon: Icons.download_for_offline_outlined,
              title: l10n.downloadsEmpty,
              message: l10n.downloadsEmptyHint,
            );
          }
          return RefreshIndicator(
            onRefresh: () => ref.read(downloadsProvider.notifier).reload(),
            child: ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: files.length + 1,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (BuildContext context, int index) {
                if (index == 0) return _StorageHeader();
                final DownloadedFile file = files[index - 1];
                return _DownloadTile(file: file);
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmDeleteAll(BuildContext context, WidgetRef ref, int count) async {
    final AppLocalizations l10n = context.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(l10n.downloadsClearAll),
        content: Text(l10n.itemsCount(count)),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.commonDelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(downloadsProvider.notifier).deleteAll();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.downloadsDeleted)),
    );
  }
}

/// "Storage used: 42.3 MB" plus how many files.
class _StorageHeader extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final int? used = ref.watch(downloadsUsedBytesProvider).valueOrNull;
    final int count = ref.watch(downloadsProvider).valueOrNull?.length ?? 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: <Widget>[
          Icon(Icons.sd_storage_outlined, size: 16, color: Theme.of(context).colorScheme.outline),
          const SizedBox(width: 6),
          Text(
            '${l10n.downloadsStorageUsed}: ${used == null ? '…' : FormatUtils.fileSize(used)}',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const Spacer(),
          Text(
            l10n.itemsCount(count),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

/// One downloaded PDF: cover, title, size, page count, delete + open actions.
class _DownloadTile extends ConsumerWidget {
  const _DownloadTile({required this.file});

  final DownloadedFile file;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final CatalogItem item = file.item;
    final TextTheme text = Theme.of(context).textTheme;

    return AppCard(
      padding: const EdgeInsets.all(10),
      onTap: () => AppRouter.openViewer(context, item: item, localPath: file.filePath),
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
                  '${l10n.subjectName(item.subject)} · ${l10n.mediumName(item.medium)}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: <Widget>[
                    Icon(
                      Icons.offline_pin,
                      size: 13,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      l10n.downloadsPlayOffline,
                      style: text.labelSmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      FormatUtils.fileSize(file.sizeBytes),
                      style: text.labelSmall?.copyWith(
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ),
                    if (file.pageCount > 0) ...<Widget>[
                      const SizedBox(width: 10),
                      Text(
                        '${file.pageCount} p',
                        style: text.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: l10n.commonDelete,
            icon: const Icon(Icons.delete_outline),
            onPressed: () => _confirmDelete(context, ref),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(l10n.downloadsDeleteTitle),
        content: Text(l10n.downloadsDeleteBody(file.item.title)),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.commonDelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(downloadsProvider.notifier).delete(file);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.downloadsDeleted)),
    );
  }
}
