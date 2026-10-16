import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/catalog_constants.dart';
import '../../../data/models/catalog_filter.dart';
import '../../../l10n/app_localizations.dart';
import '../../../l10n/catalog_names.dart';
import '../providers/books_providers.dart';

/// Bottom sheet with the "long tail" of book filters: subject, category and
/// sort order. Grade and medium stay on the main screen because they are used
/// most often.
Future<void> showBookFiltersSheet(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (BuildContext context) => const _BookFiltersSheet(),
  );
}

class _BookFiltersSheet extends ConsumerWidget {
  const _BookFiltersSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final BookFilter filter = ref.watch(booksFilterProvider);
    final List<String> subjects =
        ref.watch(availableSubjectsProvider).valueOrNull ?? CatalogConstants.subjects;

    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 4,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    l10n.commonFilters,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                TextButton(
                  onPressed: () => ref.read(booksFilterProvider.notifier).clear(),
                  child: Text(l10n.commonReset),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _Label(l10n.booksFilterSubject),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: <Widget>[
                for (final String subject in subjects)
                  ChoiceChip(
                    label: Text(l10n.subjectName(subject)),
                    selected: filter.subject == subject,
                    onSelected: (bool selected) => ref
                        .read(booksFilterProvider.notifier)
                        .setSubject(selected ? subject : null),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            _Label(l10n.booksFilterCategory),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: <Widget>[
                for (final String category in CatalogConstants.bookCategories)
                  ChoiceChip(
                    label: Text(l10n.categoryName(category)),
                    selected: filter.category == category,
                    onSelected: (bool selected) => ref
                        .read(booksFilterProvider.notifier)
                        .setCategory(selected ? category : null),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            _Label(l10n.sortBy),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: <Widget>[
                for (final SortOption option in SortOption.values)
                  ChoiceChip(
                    label: Text(_sortLabel(l10n, option)),
                    selected: filter.sort == option,
                    onSelected: (_) =>
                        ref.read(booksFilterProvider.notifier).setSort(option),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(l10n.commonApply),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _sortLabel(AppLocalizations l10n, SortOption option) {
    switch (option) {
      case SortOption.newest:
        return l10n.sortNewest;
      case SortOption.oldest:
        return l10n.sortOldest;
      case SortOption.titleAsc:
        return l10n.sortTitle;
      case SortOption.downloadsDesc:
        return l10n.sortDownloads;
    }
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
    );
  }
}
