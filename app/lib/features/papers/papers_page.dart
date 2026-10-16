import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/catalog_constants.dart';
import '../../core/router/app_router.dart';
import '../../data/models/catalog_filter.dart';
import '../../data/models/paged_items.dart';
import '../../data/models/paper.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/catalog_names.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state_view.dart';
import '../../shared/widgets/filter_chips.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/offline_banner.dart';
import 'providers/papers_providers.dart';
import 'widgets/paper_filters_sheet.dart';
import 'widgets/paper_tile.dart';

/// Past Papers tab.
///
/// Tabs: O/L | A/L | Grade 5 Scholarship | Term Tests.
/// Filters: year, subject, medium, paper type - with a marking-scheme badge on
/// every tile so students can see at a glance whether the answers exist.
class PapersPage extends ConsumerStatefulWidget {
  const PapersPage({super.key});

  @override
  ConsumerState<PapersPage> createState() => _PapersPageState();
}

class _PapersPageState extends ConsumerState<PapersPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(
    length: examTabs.length,
    vsync: this,
    initialIndex: examTabs.indexOf(ref.read(papersFilterProvider).examType).clamp(0, examTabs.length - 1),
  );
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _tabController.addListener(_onTabChanged);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  /// Keeps the filter provider in sync when the tab chip is swiped/changed.
  void _onTabChanged() {
    if (_tabController.indexIsChanging) return;
    final String examType = examTabs[_tabController.index];
    if (ref.read(papersFilterProvider).examType != examType) {
      ref.read(papersFilterProvider.notifier).setExamType(examType);
      if (_scrollController.hasClients) _scrollController.jumpTo(0);
    }
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final double remaining =
        _scrollController.position.maxScrollExtent - _scrollController.position.pixels;
    if (remaining < 600) ref.read(papersProvider.notifier).loadMore();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final PaperFilter filter = ref.watch(papersFilterProvider);
    final AsyncValue<PagedItems> async = ref.watch(papersProvider);

    // A tab change from the Home screen's exam shortcuts must move the TabBar
    // too (the provider is the single source of truth).
    final int wantedIndex =
        examTabs.indexOf(filter.examType).clamp(0, examTabs.length - 1);
    if (_tabController.index != wantedIndex && !_tabController.indexIsChanging) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _tabController.index != wantedIndex) {
          _tabController.animateTo(wantedIndex);
        }
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.papersTitle),
        actions: <Widget>[
          IconButton(
            tooltip: l10n.searchTitle,
            icon: const Icon(Icons.search),
            onPressed: () => AppRouter.openSearch(context),
          ),
          FilterButton(
            activeCount: filter.activeCount,
            onPressed: () => showPaperFiltersSheet(context, ref),
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: <Widget>[
            for (final String examType in examTabs)
              Tab(text: l10n.examTypeName(examType)),
          ],
        ),
      ),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          const SizedBox(height: 8),
          _YearChips(filter: filter),
          const SizedBox(height: 8),
          _MediumChips(filter: filter),
          if (filter.subject != null || filter.paperType != null)
            _ActiveFilterStrip(filter: filter),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(papersProvider.notifier).refreshFromNetwork(),
              child: async.when(
                loading: () => const ListSkeleton(),
                error: (Object error, StackTrace stack) => ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: <Widget>[
                    SizedBox(
                      height: MediaQuery.sizeOf(context).height * 0.5,
                      child: ErrorStateView(
                        error: error,
                        onRetry: () => ref.invalidate(papersProvider),
                      ),
                    ),
                  ],
                ),
                data: (PagedItems page) => _PaperList(
                  page: page,
                  controller: _scrollController,
                  onLoadMore: () => ref.read(papersProvider.notifier).loadMore(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Years present in the active exam type (newest first).
class _YearChips extends ConsumerWidget {
  const _YearChips({required this.filter});

  final PaperFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final List<int> years = ref.watch(availableYearsProvider).valueOrNull ?? const <int>[];
    if (years.isEmpty) return const SizedBox.shrink();
    return FilterChipRow<int>(
      values: years,
      selected: filter.year,
      leadingLabel: l10n.papersFilterYear,
      labelOf: (int year) => '$year',
      onSelected: (int? year) => ref.read(papersFilterProvider.notifier).setYear(year),
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
    );
  }
}

class _MediumChips extends ConsumerWidget {
  const _MediumChips({required this.filter});

  final PaperFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return FilterChipRow<String>(
      values: CatalogConstants.mediums,
      selected: filter.medium,
      leadingLabel: l10n.booksFilterMedium,
      labelOf: (String medium) => l10n.mediumName(medium),
      onSelected: (String? medium) =>
          ref.read(papersFilterProvider.notifier).setMedium(medium),
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
    );
  }
}

class _ActiveFilterStrip extends ConsumerWidget {
  const _ActiveFilterStrip({required this.filter});

  final PaperFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Wrap(
              spacing: 6,
              children: <Widget>[
                if (filter.subject != null)
                  InputChip(
                    label: Text(l10n.subjectName(filter.subject!)),
                    onDeleted: () => ref.read(papersFilterProvider.notifier).setSubject(null),
                  ),
                if (filter.paperType != null)
                  InputChip(
                    label: Text(l10n.paperTypeName(filter.paperType!)),
                    onDeleted: () =>
                        ref.read(papersFilterProvider.notifier).setPaperType(null),
                  ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => ref.read(papersFilterProvider.notifier).clear(),
            child: Text(l10n.commonClear),
          ),
        ],
      ),
    );
  }
}

class _PaperList extends StatelessWidget {
  const _PaperList({
    required this.page,
    required this.controller,
    required this.onLoadMore,
  });

  final PagedItems page;
  final ScrollController controller;
  final Future<void> Function() onLoadMore;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;

    if (page.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: <Widget>[
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.5,
            child: EmptyState(
              icon: Icons.description_outlined,
              title: l10n.papersEmpty,
              message: l10n.papersEmptyHint,
            ),
          ),
        ],
      );
    }

    final bool showFooter =
        page.hasMore || page.loadingMore || page.loadMoreError != null;

    return ListView.separated(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      itemCount: page.items.length + (showFooter ? 1 : 0),
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (BuildContext context, int index) {
        if (index >= page.items.length) {
          return _Footer(page: page, onLoadMore: onLoadMore);
        }
        final PaperModel paper = page.items[index] as PaperModel;
        return PaperTile(key: ValueKey<String>(paper.id), paper: paper);
      },
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.page, required this.onLoadMore});

  final PagedItems page;
  final Future<void> Function() onLoadMore;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    if (page.loadingMore) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (page.loadMoreError != null) {
      return ErrorStateView(
        error: page.loadMoreError!,
        compact: true,
        onRetry: () => onLoadMore(),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: FilledButton.tonal(
          onPressed: () => onLoadMore(),
          child: Text(l10n.commonLoadMore),
        ),
      ),
    );
  }
}
