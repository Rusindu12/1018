import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';

/// Horizontally scrolling, single-select chip row.
///
/// Used for grades, years and mediums. It is intentionally generic so the Books
/// page, the Past Papers page and the filter sheets all behave the same way.
class FilterChipRow<T> extends StatelessWidget {
  const FilterChipRow({
    super.key,
    required this.values,
    required this.selected,
    required this.labelOf,
    required this.onSelected,
    this.leadingLabel,
    this.allLabel,
    this.includeAll = true,
    this.padding = const EdgeInsets.symmetric(horizontal: 16),
  });

  final List<T> values;

  /// Currently selected value; null means "All".
  final T? selected;

  final String Function(T value) labelOf;
  final ValueChanged<T?> onSelected;

  /// Optional small caption before the chips (e.g. "Grade").
  final String? leadingLabel;

  /// Label of the "All" chip.
  final String? allLabel;

  /// When false the "All" chip is hidden (e.g. exam-type tabs).
  final bool includeAll;

  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: padding,
      child: Row(
        children: <Widget>[
          if (leadingLabel != null) ...<Widget>[
            Text(
              leadingLabel!,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(width: 10),
          ],
          if (includeAll) ...<Widget>[
            ChoiceChip(
              label: Text(allLabel ?? l10n.commonAll),
              selected: selected == null,
              onSelected: (_) => onSelected(null),
            ),
            const SizedBox(width: 8),
          ],
          for (final T value in values) ...<Widget>[
            ChoiceChip(
              label: Text(labelOf(value)),
              selected: selected == value,
              onSelected: (_) => onSelected(selected == value ? null : value),
            ),
            const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

/// "Filters" button with a badge showing how many filters are active.
class FilterButton extends StatelessWidget {
  const FilterButton({
    super.key,
    required this.activeCount,
    required this.onPressed,
  });

  final int activeCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return Stack(
      clipBehavior: Clip.none,
      children: <Widget>[
        OutlinedButton.icon(
          onPressed: onPressed,
          icon: const Icon(Icons.tune, size: 18),
          label: Text(l10n.commonFilters),
        ),
        if (activeCount > 0)
          Positioned(
            top: -6,
            right: -6,
            child: Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                shape: BoxShape.circle,
              ),
              child: Text(
                '$activeCount',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onPrimary,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
