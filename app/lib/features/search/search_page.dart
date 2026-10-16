import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/library_providers.dart';
import '../../data/models/catalog_item.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/catalog_list_tile.dart';
import '../../shared/widgets/empty_state.dart';
import '../../shared/widgets/error_state_view.dart';
import '../../shared/widgets/loading_skeleton.dart';
import 'providers/search_providers.dart';

/// Full-screen search over books **and** papers.
///
/// Works for Sinhala, Tamil and English because matching happens over the
/// in-memory catalogue (see [CatalogRepository.search]); newly typed text is
/// debounced in [SearchResultsController].
class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  late final TextEditingController _controller =
      TextEditingController(text: ref.read(searchQueryProvider));
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    // Open with the keyboard ready - the user tapped a search bar after all.
    WidgetsBinding.instance.addPostFrameCallback((_) => _focusNode.requestFocus());
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final String query = ref.watch(searchQueryProvider);
    final ContentType? scope = ref.watch(searchScopeProvider);
    final AsyncValue<List<CatalogItem>> results = ref.watch(searchResultsProvider);

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _controller,
          focusNode: _focusNode,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: l10n.searchHint,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            suffixIcon: query.isEmpty
                ? null
                : IconButton(
                    tooltip: l10n.commonClear,
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      _controller.clear();
                      ref.read(searchQueryProvider.notifier).clear();
                    },
                  ),
          ),
          onChanged: ref.read(searchQueryProvider.notifier).set,
          onSubmitted: (String value) {
            ref.read(searchHistoryProvider.notifier).add(value);
          },
        ),
      ),
      body: Column(
        children: <Widget>[
          _ScopeChips(active: scope),
          const SizedBox(height: 6),
          Expanded(
            child: query.trim().length < 2
                ? _IdleView(
                    controller: _controller,
                    onPick: (String value) {
                      _controller.text = value;
                      ref.read(searchQueryProvider.notifier).set(value);
                    },
                  )
                : results.when(
                    loading: () => const ListSkeleton(hasLeading: true, itemCount: 5),
                    error: (Object error, StackTrace stack) => ErrorStateView(
                      error: error,
                      onRetry: () => ref.invalidate(searchResultsProvider),
                    ),
                    data: (List<CatalogItem> items) {
                      if (items.isEmpty) {
                        return EmptyState(
                          icon: Icons.search_off,
                          title: l10n.searchNoResults(query),
                          message: l10n.searchNoResultsHint,
                        );
                      }
                      return ListView.separated(
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                        itemCount: items.length + 1,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (BuildContext context, int index) {
                          if (index == 0) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 2),
                              child: Text(
                                l10n.itemsCount(items.length),
                                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                                    ),
                              ),
                            );
                          }
                          final CatalogItem item = items[index - 1];
                          return CatalogListTile(
                            key: ValueKey<String>('${item.type.key}_${item.id}'),
                            item: item,
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

/// All / Books / Papers scope chips.
class _ScopeChips extends ConsumerWidget {
  const _ScopeChips({required this.active});

  final ContentType? active;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: <Widget>[
          ChoiceChip(
            label: Text(l10n.searchFilterAll),
            selected: active == null,
            onSelected: (_) => ref.read(searchScopeProvider.notifier).set(null),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: Text(l10n.searchFilterBooks),
            selected: active == ContentType.book,
            onSelected: (_) => ref.read(searchScopeProvider.notifier).set(ContentType.book),
          ),
          const SizedBox(width: 8),
          ChoiceChip(
            label: Text(l10n.searchFilterPapers),
            selected: active == ContentType.paper,
            onSelected: (_) => ref.read(searchScopeProvider.notifier).set(ContentType.paper),
          ),
        ],
      ),
    );
  }
}

/// Shown before the user has typed two characters: recent searches + popular
/// suggestions, both tappable.
class _IdleView extends ConsumerWidget {
  const _IdleView({required this.onPick, required this.controller});

  final ValueChanged<String> onPick;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final List<String> history = ref.watch(searchHistoryProvider);
    final List<CatalogItem> suggestions =
        ref.watch(searchSuggestionsProvider).valueOrNull ?? const <CatalogItem>[];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: <Widget>[
        if (history.isNotEmpty) ...<Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.searchRecent,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
              TextButton(
                onPressed: () => ref.read(searchHistoryProvider.notifier).clear(),
                child: Text(l10n.searchClearRecent),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: <Widget>[
              for (final String entry in history)
                InputChip(
                  avatar: const Icon(Icons.history, size: 16),
                  label: Text(entry),
                  onPressed: () => onPick(entry),
                  onDeleted: () => ref.read(searchHistoryProvider.notifier).remove(entry),
                ),
            ],
          ),
          const SizedBox(height: 20),
        ],
        Text(
          l10n.searchSuggestions,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        if (suggestions.isEmpty)
          EmptyState(
            icon: Icons.search,
            title: l10n.searchStartTyping,
            message: l10n.booksEmptyHint,
          )
        else
          for (final CatalogItem item in suggestions)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: CatalogListTile(
                key: ValueKey<String>('suggest_${item.type.key}_${item.id}'),
                item: item,
              ),
            ),
        const SizedBox(height: 8),
        Text(
          AppConfig.appName,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.outline,
              ),
        ),
      ],
    );
  }
}
