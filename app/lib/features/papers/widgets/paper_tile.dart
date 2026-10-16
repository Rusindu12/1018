import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/catalog_constants.dart';
import '../../../core/router/app_router.dart';
import '../../../core/utils/format_utils.dart';
import '../../../data/models/downloaded_file.dart';
import '../../../data/models/paper.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/download_action_button.dart';
import '../../../shared/widgets/favorite_button.dart';
import '../../../shared/widgets/subject_icon.dart';
import '../providers/papers_providers.dart';

/// Colour of an exam family, used by tiles, badges and the Home shortcuts.
class ExamColors {
  ExamColors._();

  static Color of(String examType, BuildContext context) {
    final bool dark = Theme.of(context).brightness == Brightness.dark;
    Color base;
    switch (examType) {
      case CatalogConstants.examAL:
        base = const Color(0xFF6A1B9A);
        break;
      case CatalogConstants.examScholarship:
        base = const Color(0xFFEF6C00);
        break;
      case CatalogConstants.examTermTest:
        base = const Color(0xFF00838F);
        break;
      case CatalogConstants.examOL:
      default:
        base = const Color(0xFF1565C0);
    }
    return dark ? Color.alphaBlend(base.withValues(alpha: 0.35), const Color(0xFF101413)) : base;
  }
}

/// One past paper / marking scheme row.
class PaperTile extends ConsumerWidget {
  const PaperTile({super.key, required this.paper});

  final PaperModel paper;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final TextTheme text = Theme.of(context).textTheme;
    final Color accent = ExamColors.of(paper.examType, context);

    return AppCard(
      padding: const EdgeInsets.all(10),
      onTap: () => _open(context, ref),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 52,
            height: 62,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: accent.withValues(alpha: 0.35)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Icon(SubjectIcon.iconFor(paper.subject), size: 20, color: accent),
                const SizedBox(height: 2),
                Text(
                  '${paper.year}',
                  style: text.labelSmall?.copyWith(color: accent, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  paper.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, height: 1.25),
                ),
                const SizedBox(height: 4),
                Text(
                  l10n.paperSubtitle(paper),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: <Widget>[
                    _Badge(
                      icon: paper.hasMarkingScheme ? Icons.check_circle : Icons.help_outline,
                      label: l10n.markingBadge(paper),
                      color: paper.hasMarkingScheme
                          ? const Color(0xFF2E7D32)
                          : Theme.of(context).colorScheme.outline,
                    ),
                    _Badge(
                      icon: Icons.picture_as_pdf_outlined,
                      label: FormatUtils.safeSizeString(
                        paper.fileSize,
                        fallbackBytes: paper.fileSizeBytes,
                      ),
                      color: Theme.of(context).colorScheme.outline,
                    ),
                    if (paper.downloads > 0)
                      _Badge(
                        icon: Icons.download_done_outlined,
                        label: FormatUtils.compactNumber(paper.downloads),
                        color: Theme.of(context).colorScheme.outline,
                      ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            children: <Widget>[
              FavoriteButton(item: paper, showSnackBar: false),
              DownloadActionButton(item: paper),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _open(BuildContext context, WidgetRef ref) async {
    final DownloadedFile? file = ref.read(downloadedFileProvider(paper));
    await AppRouter.openViewer(context, item: paper, localPath: file?.filePath);
  }
}

/// Tiny icon + label pill used for the marking-scheme / size / download info.
class _Badge extends StatelessWidget {
  const _Badge({required this.icon, required this.label, required this.color});

  final IconData icon;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 3),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color),
        ),
      ],
    );
  }
}
