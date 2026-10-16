import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/catalog_constants.dart';
import '../../../core/providers/app_providers.dart';
import '../../../core/providers/paged_catalog_controller.dart';
import '../../../data/models/catalog_filter.dart';
import '../../../data/models/catalog_item.dart';
import '../../../data/models/paged_items.dart';
import '../../../data/models/paper.dart';
import '../../../l10n/app_localizations.dart';
import '../../../l10n/catalog_names.dart';

/// The four exam families shown as tabs (O/L, A/L, Grade 5 Scholarship, Term
/// Tests). Order matters - it is the tab order on screen.
const List<String> examTabs = CatalogConstants.examTypes;

/// Filter state for a paper tab.
class PapersFilterController extends Notifier<PaperFilter> {
  @override
  PaperFilter build() => const PaperFilter();

  /// Switching tab keeps the medium/subject/year choices (a student usually
  /// studies one medium and wants to compare papers of the same subject).
  void setExamType(String examType) =>
      state = state.copyWith(examType: examType, year: null, paperType: null);

  void setYear(int? year) => state = state.copyWith(year: year);

  void setMedium(String? medium) => state = state.copyWith(medium: medium);

  void setSubject(String? subject) => state = state.copyWith(subject: subject);

  void setPaperType(String? paperType) => state = state.copyWith(paperType: paperType);

  void setSort(SortOption sort) => state = state.copyWith(sort: sort);

  void clear() => state = state.cleared();

  /// Deep link from the Home screen exam shortcuts.
  void applyFrom({String? examType, int? year}) {
    state = state.copyWith(
      examType: examType ?? state.examType,
      year: year,
    );
  }
}

final NotifierProvider<PapersFilterController, PaperFilter> papersFilterProvider =
    NotifierProvider<PapersFilterController, PaperFilter>(PapersFilterController.new);

/// Paged list of papers for the active tab + filters.
class PapersListController extends PagedCatalogController {
  @override
  void watchInputs() {
    ref.watch(papersFilterProvider);
  }

  @override
  Future<PageResult> fetchPage(int page) => ref.read(catalogRepositoryProvider).papers(
        filter: ref.read(papersFilterProvider),
        page: page,
      );

  List<PaperModel> get papers {
    final PagedItems? items = state.valueOrNull;
    if (items == null) return const <PaperModel>[];
    return items.items.whereType<PaperModel>().toList(growable: false);
  }
}

final AsyncNotifierProvider<PapersListController, PagedItems> papersProvider =
    AsyncNotifierProvider.autoDispose<PapersListController, PagedItems>(PapersListController.new);

/// Years that actually contain papers for the active exam type, so a chip never
/// leads to an empty list. Sorted newest first.
final FutureProvider<List<int>> availableYearsProvider = FutureProvider<List<int>>((Ref ref) async {
  final String examType = ref.watch(papersFilterProvider.select((PaperFilter f) => f.examType));
  final List<int> years =
      await ref.watch(catalogRepositoryProvider).availableYears(examType);
  if (years.isNotEmpty) return years;
  return <int>[
    for (int year = CatalogConstants.maxYear; year >= CatalogConstants.minYear; year--) year,
  ];
});

/// Distinct subjects inside the active exam type.
final FutureProvider<List<String>> paperSubjectsProvider = FutureProvider<List<String>>(
  (Ref ref) async {
    final String examType =
        ref.watch(papersFilterProvider.select((PaperFilter f) => f.examType));
    final List<String> subjects = await ref
        .watch(catalogRepositoryProvider)
        .filterSubjects(type: ContentType.paper, examType: examType);
    return subjects.isEmpty ? CatalogConstants.subjects : subjects;
  },
);

/// Localisation-aware helpers for paper tiles.
extension PaperLabels on AppLocalizations {
  /// `2023 · Mathematics · Sinhala · Paper 1`, fully translated.
  String paperSubtitle(PaperModel paper) {
    final StringBuffer buffer = StringBuffer()
      ..write(paper.year)
      ..write(' · ')
      ..write(subjectName(paper.subject))
      ..write(' · ')
      ..write(mediumName(paper.medium))
      ..write(' · ')
      ..write(paperTypeName(paper.paperType));
    if (paper.grade != null && paper.examType == CatalogConstants.examTermTest) {
      buffer
        ..write(' · ')
        ..write(gradeLabel(paper.grade!));
    }
    return buffer.toString();
  }

  /// Short badge: "Marking scheme" when the answer key exists.
  String markingBadge(PaperModel paper) =>
      paper.hasMarkingScheme ? papersMarkingAvailable : papersMarkingMissing;
}
