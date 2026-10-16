import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/catalog_constants.dart';
import '../../../data/models/catalog_filter.dart';
import '../../../l10n/app_localizations.dart';
import '../../../l10n/catalog_names.dart';
import '../providers/papers_providers.dart';

/// Bottom sheet with the past-paper filters that do not fit on the main screen:
/// subject, paper type and sort order. Year and medium stay inline because they
/// are used constantly.
Future<void> showPaperFiltersSheet(BuildContext context, WidgetRef ref) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (BuildContext context) => const _PaperFiltersSheet(),
  );
}

class _PaperFiltersSheet extends ConsumerWidget {
  const _PaperFiltersSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final PaperFilter filter = ref.watch(papersFilterProvider);
    final List<String> subjects =
        ref.watch(paperSubjectsProvider).valueOrNull ?? CatalogConstants.subjects;

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
                    '${l10n.commonFilters} · ${l10n.examTypeName(filter.examType)}',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                TextButton(
                  onPressed: () => ref.read(papersFilterProvider.notifier).clear(),
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
                        .read(papersFilterProvider.notifier)
                        .setSubject(selected ? subject : null),
                  ),
              ],
            ),
            const SizedBox(height: 20),
            _Label(l10n.papersFilterPaperType),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 4,
              children: <Widget>[
                for (final String paperType in CatalogConstants.paperTypes)
                  ChoiceChip(
                    label: Text(l10n.paperTypeName(paperType)),
                    selected: filter.paperType == paperType,
                    onSelected: (bool selected) => ref
                        .read(papersFilterProvider.notifier)
                        .setPaperType(selected ? paperType : null),
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
                        ref.read(papersFilterProvider.notifier).setSort(option),
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
