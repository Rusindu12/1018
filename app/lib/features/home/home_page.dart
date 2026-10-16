import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/constants/catalog_constants.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/library_providers.dart';
import '../../core/providers/ui_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/catalog_item.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/catalog_names.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/catalog_cover.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/offline_banner.dart';
import '../books/providers/books_providers.dart';
import '../papers/providers/papers_providers.dart';
import 'providers/home_providers.dart';

/// The Home tab: search entry point, the four main sections, quick grade and
/// exam shortcuts, and a "recently added" carousel.
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final int favoriteCount = ref.watch(favoritesProvider).length;
    final int downloadCount = ref.watch(downloadsProvider).valueOrNull?.length ?? 0;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          // Pull-to-refresh re-reads the catalogue (bypassing the cache) and
          // rebuilds every list that depends on it.
          await ref.read(catalogRepositoryProvider).refresh();
          ref.invalidate(recentlyAddedProvider);
          ref.invalidate(catalogCountsProvider);
          ref.invalidate(booksProvider);
          ref.invalidate(papersProvider);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: <Widget>[
            SliverToBoxAdapter(child: _HomeHeader()),
            const SliverToBoxAdapter(child: OfflineBanner()),
            const SliverToBoxAdapter(child: _SectionGrid()),
            SliverToBoxAdapter(
              child: _SectionHeader(
                icon: Icons.auto_awesome,
                title: l10n.homeRecentlyAdded,
                actionLabel: l10n.commonSeeAll,
                onAction: () => Navigator.of(context).pushNamed(AppRoutes.search),
              ),
            ),
            const SliverToBoxAdapter(child: _RecentlyAddedRail()),
            SliverToBoxAdapter(
              child: _SectionHeader(
                icon: Icons.school_outlined,
                title: l10n.homeBrowseByGrade,
              ),
            ),
            const SliverToBoxAdapter(child: _GradeShortcuts()),
            SliverToBoxAdapter(
              child: _SectionHeader(
                icon: Icons.emoji_events_outlined,
                title: l10n.homeBrowseByExam,
              ),
            ),
            const SliverToBoxAdapter(child: _ExamShortcuts()),
            SliverToBoxAdapter(
              child: _StatsRow(
                favoriteCount: favoriteCount,
                downloadCount: downloadCount,
              ),
            ),
            SliverToBoxAdapter(child: _OfflineTip()),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}

/// Greeting, brand, search field and catalogue counters.
class _HomeHeader extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final ColorScheme colors = Theme.of(context).colorScheme;
    final CatalogCounts counts =
        ref.watch(catalogCountsProvider).valueOrNull ?? CatalogCounts.zero;
    final int hour = DateTime.now().hour;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 18, 20, 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[
            colors.primary.withValues(alpha: 0.16),
            colors.primary.withValues(alpha: 0.02),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      l10n.greetingForHour(hour),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: colors.onSurfaceVariant,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      AppConfig.appName,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: colors.primary,
                          ),
                    ),
                  ],
                ),
              ),
              _HeaderIconButton(
                icon: Icons.search,
                tooltip: l10n.searchTitle,
                onPressed: () => AppRouter.openSearch(context),
              ),
              const SizedBox(width: 6),
              _HeaderIconButton(
                icon: Icons.favorite_border,
                tooltip: l10n.favoritesTitle,
                onPressed: () => AppRouter.openFavorites(context),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Tapping the fake search bar opens the real search screen: keeping
          // text input off the home screen avoids a keyboard that covers the
          // shortcuts before the user has read them.
          Material(
            color: Theme.of(context).brightness == Brightness.dark
                ? const Color(0xFF1A201F)
                : Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => AppRouter.openSearch(context),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                child: Row(
                  children: <Widget>[
                    Icon(Icons.search, color: colors.onSurfaceVariant),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        l10n.homeSearchHint,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: colors.onSurfaceVariant,
                            ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              _StatChip(
                icon: Icons.menu_book_outlined,
                label: l10n.homeStatBooks,
                value: FormatUtils.compactNumber(counts.books),
              ),
              const SizedBox(width: 8),
              _StatChip(
                icon: Icons.description_outlined,
                label: l10n.homeStatPapers,
                value: FormatUtils.compactNumber(counts.papers),
              ),
              const SizedBox(width: 8),
              _StatChip(
                icon: Icons.offline_pin_outlined,
                label: l10n.homeStatOffline,
                value: FormatUtils.compactNumber(
                  ref.watch(downloadsProvider).valueOrNull?.length ?? 0,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, required this.tooltip, required this.onPressed});

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton.filledTonal(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: Icon(icon, size: 20),
      style: IconButton.styleFrom(minimumSize: const Size(42, 42)),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
        ),
        child: Row(
          children: <Widget>[
            Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 6),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    value,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The four main sections: School Books, Past Papers, Favorites, Downloads.
class _SectionGrid extends ConsumerWidget {
  const _SectionGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    // Live counters on the two main cards - they come from the already cached
    // catalogue, so showing them costs nothing.
    final CatalogCounts counts =
        ref.watch(catalogCountsProvider).valueOrNull ?? CatalogCounts.zero;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Row(
        children: <Widget>[
          Expanded(
            child: _SectionCard(
              icon: Icons.menu_book_rounded,
              color: const Color(0xFF00695C),
              title: l10n.homeSectionSchoolBooks,
              subtitle: l10n.homeCardBooksSub,
              badge: counts.books,
              onTap: () => ref.read(selectedTabProvider.notifier).select(AppTab.books),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _SectionCard(
              icon: Icons.description_rounded,
              color: const Color(0xFF1565C0),
              title: l10n.homeSectionPastPapers,
              subtitle: l10n.homeCardPapersSub,
              badge: counts.papers,
              onTap: () => ref.read(selectedTabProvider.notifier).select(AppTab.papers),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const Spacer(),
              if (badge != null && badge! > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$badge',
                    style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 3),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

/// Horizontal rail of the newest books and papers.
class _RecentlyAddedRail extends ConsumerWidget {
  const _RecentlyAddedRail();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final AsyncValue<List<CatalogItem>> async = ref.watch(recentlyAddedProvider);

    return async.when(
      loading: () => const SizedBox(
        height: 210,
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (Object error, StackTrace stack) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: AppCard(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: <Widget>[
              const Icon(Icons.cloud_off_outlined),
              const SizedBox(width: 10),
              Expanded(child: Text(l10n.errorNetwork)),
              TextButton(
                onPressed: () => ref.invalidate(recentlyAddedProvider),
                child: Text(l10n.commonRetry),
              ),
            ],
          ),
        ),
      ),
      data: (List<CatalogItem> items) {
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: AppCard(
              padding: const EdgeInsets.all(20),
              child: EmptyState(
                icon: Icons.inbox_outlined,
                title: l10n.booksEmpty,
                message: l10n.booksEmptyHint,
              ),
            ),
          );
        }
        return SizedBox(
          height: 224,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (BuildContext context, int index) =>
                _RecentCard(item: items[index]),
          ),
        );
      },
    );
  }
}

class _RecentCard extends StatelessWidget {
  const _RecentCard({required this.item});

  final CatalogItem item;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return SizedBox(
      width: 148,
      child: AppCard(
        padding: const EdgeInsets.all(9),
        onTap: () => AppRouter.openViewer(context, item: item),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            AspectRatio(
              aspectRatio: 3 / 4,
              child: CatalogCover(item: item, borderRadius: 9, showTypeBadge: true),
            ),
            const SizedBox(height: 8),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              l10n.subjectName(item.subject),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Grade chips 1..13 that jump straight into a filtered Books tab.
class _GradeShortcuts extends ConsumerWidget {
  const _GradeShortcuts();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final int selected = ref.watch(booksFilterProvider).grade ?? -1;
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: CatalogConstants.grades.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (BuildContext context, int index) {
          final int grade = CatalogConstants.grades[index];
          return ChoiceChip(
            label: Text(context.l10n.gradeLabel(grade)),
            selected: selected == grade,
            onSelected: (_) {
              ref.read(booksFilterProvider.notifier).applyFrom(grade: grade);
              ref.read(selectedTabProvider.notifier).select(AppTab.books);
            },
          );
        },
      ),
    );
  }
}

/// Exam shortcuts that pre-select the matching Past Papers tab.
class _ExamShortcuts extends ConsumerWidget {
  const _ExamShortcuts();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    const List<(IconData, String)> exams = <(IconData, String)>[
      (Icons.school_outlined, CatalogConstants.examOL),
      (Icons.workspace_premium_outlined, CatalogConstants.examAL),
      (Icons.child_care_outlined, CatalogConstants.examScholarship),
      (Icons.event_note_outlined, CatalogConstants.examTermTest),
    ];
    return SizedBox(
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: exams.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (BuildContext context, int index) {
          final (IconData icon, String examType) = exams[index];
          return SizedBox(
            width: 150,
            child: AppCard(
              padding: const EdgeInsets.all(12),
              onTap: () {
                ref.read(papersFilterProvider.notifier).applyFrom(examType: examType);
                ref.read(selectedTabProvider.notifier).select(AppTab.papers);
              },
              child: Row(
                children: <Widget>[
                  Icon(icon, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      l10n.examTypeName(examType),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Favorites / Downloads shortcuts with live counters.
class _StatsRow extends ConsumerWidget {
  const _StatsRow({required this.favoriteCount, required this.downloadCount});

  final int favoriteCount;
  final int downloadCount;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Row(
        children: <Widget>[
          Expanded(
            child: _SectionCard(
              icon: Icons.favorite_rounded,
              color: const Color(0xFFE53935),
              title: l10n.homeSectionFavorites,
              subtitle: l10n.homeCardFavoritesSub,
              badge: favoriteCount,
              onTap: () => AppRouter.openFavorites(context),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _SectionCard(
              icon: Icons.download_rounded,
              color: const Color(0xFF00838F),
              title: l10n.homeSectionDownloads,
              subtitle: l10n.homeCardDownloadsSub,
              badge: downloadCount,
              onTap: () => AppRouter.openDownloads(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfflineTip extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: colors.primaryContainer.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: <Widget>[
            Icon(Icons.lightbulb_outline, color: colors.primary, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                context.l10n.homeOfflineTip,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small section heading with an optional trailing action.
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    this.icon,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 22, 8, 10),
      child: Row(
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          if (actionLabel != null && onAction != null)
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ),
    );
  }
}
