import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/catalog_constants.dart';
import '../../core/router/app_router.dart';
import '../../data/models/book.dart';
import '../../data/models/catalog_filter.dart';
import '../../data/models/paged_items.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/catalog_names.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state_view.dart';
import '../../shared/widgets/filter_chips.dart';
import '../../shared/widgets/loading_skeleton.dart';
import '../../shared/widgets/offline_banner.dart';
import 'providers/books_providers.dart';
import 'widgets/book_card.dart';
import 'widgets/book_filters_sheet.dart';

/// Books tab: grade + medium + subject filters over a paginated grid of
/// textbooks, each with download and favourite actions.
class BooksPage extends ConsumerStatefulWidget {
  const BooksPage({super.key});

  @override
  ConsumerState<BooksPage> createState() => _BooksPageState();
}

class _BooksPageState extends ConsumerState<BooksPage> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  /// Loads the next page shortly before the user reaches the bottom.
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final double remaining =
        _scrollController.position.maxScrollExtent - _scrollController.position.pixels;
    if (remaining < 600) {
      ref.read(booksProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final BookFilter filter = ref.watch(booksFilterProvider);
    final AsyncValue<PagedItems> async = ref.watch(booksProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.booksTitle),
        actions: <Widget>[
          IconButton(
            tooltip: l10n.searchTitle,
            icon: const Icon(Icons.search),
            onPressed: () => AppRouter.openSearch(context),
          ),
          FilterButton(
            activeCount: filter.activeCount,
            onPressed: () => showBookFiltersSheet(context, ref),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: <Widget>[
          const OfflineBanner(),
          _GradeChips(active: filter),
          const SizedBox(height: 8),
          _MediumChips(active: filter),
          const SizedBox(height: 8),
          if (filter.subject != null || filter.category != null)
            _ActiveFilterStrip(filter: filter),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(booksProvider.notifier).refreshFromNetwork(),
              child: async.when(
                loading: () => const BookGridSkeleton(),
                error: (Object error, StackTrace stack) => ListView(
                  // Must be scrollable, otherwise pull-to-refresh cannot fire.
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: <Widget>[
                    SizedBox(
                      height: MediaQuery.sizeOf(context).height * 0.55,
                      child: ErrorStateView(
                        error: error,
                        onRetry: () => ref.invalidate(booksProvider),
                      ),
                    ),
                  ],
                ),
                data: (PagedItems page) => _Grid(
                  page: page,
                  controller: _scrollController,
                  onLoadMore: () => ref.read(booksProvider.notifier).loadMore(),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Grade 1-13 filter chips.
class _GradeChips extends ConsumerWidget {
  const _GradeChips({required this.active});

  final BookFilter active;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return FilterChipRow<int>(
      values: CatalogConstants.grades,
      selected: active.grade,
      leadingLabel: l10n.booksFilterGrade,
      labelOf: l10n.gradeLabel,
      onSelected: (int? grade) => ref.read(booksFilterProvider.notifier).setGrade(grade),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
    );
  }
}

/// Medium chips (සිංහල / English / தமிழ்).
class _MediumChips extends ConsumerWidget {
  const _MediumChips({required this.active});

  final BookFilter active;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return FilterChipRow<String>(
      values: CatalogConstants.mediums,
      selected: active.medium,
      leadingLabel: l10n.booksFilterMedium,
      labelOf: l10n.mediumName,
      onSelected: (String? medium) => ref.read(booksFilterProvider.notifier).setMedium(medium),
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
    );
  }
}

/// Shows the filters picked in the sheet (subject / type) with a clear button.
class _ActiveFilterStrip extends ConsumerWidget {
  const _ActiveFilterStrip({required this.filter});

  final BookFilter filter;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Wrap(
              spacing: 6,
              children: <Widget>[
                if (filter.subject != null)
                  InputChip(
                    label: Text(l10n.subjectName(filter.subject!)),
                    onDeleted: () => ref.read(booksFilterProvider.notifier).setSubject(null),
                  ),
                if (filter.category != null)
                  InputChip(
                    label: Text(l10n.categoryName(filter.category!)),
                    onDeleted: () => ref.read(booksFilterProvider.notifier).setCategory(null),
                  ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => ref.read(booksFilterProvider.notifier).clear(),
            child: Text(l10n.commonClear),
          ),
        ],
      ),
    );
  }
}

/// The paginated grid itself.
class _Grid extends StatelessWidget {
  const _Grid({
    required this.page,
    required this.controller,
    required this.onLoadMore,
  });

  final PagedItems page;
  final ScrollController controller;

  /// Appends the next chunk of 20 books (also called by the scroll listener).
  final Future<void> Function() onLoadMore;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;

    if (page.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: <Widget>[
          SizedBox(
            height: MediaQuery.sizeOf(context).height * 0.55,
            child: EmptyState(
              icon: Icons.menu_book_outlined,
              title: l10n.booksEmpty,
              message: l10n.booksEmptyHint,
            ),
          ),
        ],
      );
    }

    final int footerCount = page.hasMore || page.loadingMore || page.loadMoreError != null ? 1 : 0;

    return CustomScrollView(
      controller: controller,
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: <Widget>[
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 220,
              mainAxisSpacing: 14,
              crossAxisSpacing: 14,
              childAspectRatio: 0.60,
            ),
            delegate: SliverChildBuilderDelegate(
              (BuildContext context, int index) {
                final BookModel book = page.items[index] as BookModel;
                return BookCard(key: ValueKey<String>(book.id), book: book);
              },
              childCount: page.items.length,
            ),
          ),
        ),
        if (footerCount == 1)
          SliverToBoxAdapter(
            child: _BooksFooter(
              page: page,
              onLoadMore: onLoadMore,
            ),
          ),
        SliverToBoxAdapter(
          child: SizedBox(height: MediaQuery.paddingOf(context).bottom + 16),
        ),
      ],
    );
  }
}

class _BooksFooter extends StatelessWidget {
  const _BooksFooter({required this.page, required this.onLoadMore});

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
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: ErrorStateView(
          error: page.loadMoreError!,
          compact: true,
          onRetry: () => onLoadMore(),
        ),
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
