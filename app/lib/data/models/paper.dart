import 'package:cloud_firestore/cloud_firestore.dart';

import '../../core/constants/catalog_constants.dart';
import '../../core/utils/parse_utils.dart';
import 'catalog_item.dart';

/// A past paper / marking scheme.
///
/// Firestore: `papers/{paperId}`
/// ```json
/// {
///   "title": "2023 O/L Mathematics Paper 1",
///   "examType": "OL",              // OL | AL | Scholarship | TermTest
///   "year": 2023,
///   "subject": "Mathematics",
///   "medium": "Sinhala",
///   "paperType": "Paper 1",         // Paper 1 | Paper 2 | MCQ | Essay | Marking Scheme
///   "hasMarkingScheme": true,
///   "grade": 11,                    // optional, term tests use it
///   "term": 2,                      // optional, term tests use it
///   "pdfUrl": "https://firebasestorage...",
///   "fileSize": "3.2 MB",
///   "downloads": 800,
///   "timestamp": <serverTimestamp>
/// }
/// ```
class PaperModel implements CatalogItem {
  const PaperModel({
    required this.id,
    required this.title,
    required this.examType,
    required this.year,
    required this.subject,
    required this.medium,
    required this.pdfUrl,
    this.paperType = CatalogConstants.paperTypeOne,
    this.hasMarkingScheme = false,
    this.grade,
    this.term,
    this.fileSize = '',
    this.fileSizeBytes = 0,
    this.downloads = 0,
    this.updatedAt,
  });

  @override
  final String id;

  @override
  final String title;

  /// `OL` | `AL` | `Scholarship` | `TermTest` - see [CatalogConstants.examTypes].
  @override
  final String examType;

  @override
  final int year;

  @override
  final String subject;

  @override
  final String medium;

  @override
  final String pdfUrl;

  @override
  final String paperType;

  /// True when the answer key for this paper is available in the catalogue.
  final bool hasMarkingScheme;

  /// Only meaningful for term tests (e.g. grade 8, 2nd term).
  final int? grade;
  final int? term;

  @override
  final String fileSize;

  @override
  final int fileSizeBytes;

  @override
  final int downloads;

  @override
  final DateTime? updatedAt;

  /// Papers have no cover image - the UI renders an exam-type coloured tile.
  @override
  String? get coverUrl => null;

  @override
  ContentType get type => ContentType.paper;

  /// True when this document *is* a marking scheme (vs. a paper that has one).
  bool get isMarkingScheme => paperType == CatalogConstants.paperTypeMarkingScheme;

  @override
  String get subtitle {
    final StringBuffer buffer = StringBuffer('$year · $subject · $medium');
    if (grade != null && examType == CatalogConstants.examTermTest) {
      buffer.write(' · Grade $grade');
    }
    if (term != null && term! > 0) {
      buffer.write(' · Term $term');
    }
    return buffer.toString();
  }

  @override
  List<String> get keywords => <String>[
        title,
        subject,
        examType,
        paperType,
        medium,
        '$year',
        if (grade != null) 'grade $grade',
        if (term != null) 'term $term',
        if (hasMarkingScheme) 'marking scheme answers පිළිතුරු விடைகள்',
      ];

  PaperModel copyWith({
    String? title,
    String? examType,
    int? year,
    String? subject,
    String? medium,
    String? pdfUrl,
    String? paperType,
    bool? hasMarkingScheme,
    int? grade,
    int? term,
    String? fileSize,
    int? fileSizeBytes,
    int? downloads,
    DateTime? updatedAt,
  }) {
    return PaperModel(
      id: id,
      title: title ?? this.title,
      examType: examType ?? this.examType,
      year: year ?? this.year,
      subject: subject ?? this.subject,
      medium: medium ?? this.medium,
      pdfUrl: pdfUrl ?? this.pdfUrl,
      paperType: paperType ?? this.paperType,
      hasMarkingScheme: hasMarkingScheme ?? this.hasMarkingScheme,
      grade: grade ?? this.grade,
      term: term ?? this.term,
      fileSize: fileSize ?? this.fileSize,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      downloads: downloads ?? this.downloads,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  factory PaperModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final Map<String, dynamic> data = doc.data() ?? <String, dynamic>{};
    return PaperModel.fromMap(doc.id, data);
  }

  factory PaperModel.fromMap(String id, Map<String, dynamic> data) {
    final String fileSize = ParseUtils.str(
      ParseUtils.pick(data, <String>['fileSize', 'file_size', 'size']),
    );
    final int year = ParseUtils.integer(ParseUtils.pick(data, <String>['year']));
    final int grade = ParseUtils.integer(ParseUtils.pick(data, <String>['grade']));
    final int term = ParseUtils.integer(ParseUtils.pick(data, <String>['term']));
    final String paperType = ParseUtils.str(
      ParseUtils.pick(data, <String>['paperType', 'paper_type', 'part']),
      fallback: CatalogConstants.paperTypeOne,
    );
    return PaperModel(
      id: id,
      title: ParseUtils.str(
        ParseUtils.pick(data, <String>['title', 'name', 'paperName']),
        fallback: 'Untitled paper',
      ),
      examType: ParseUtils.str(
        ParseUtils.pick(data, <String>['examType', 'exam_type', 'exam']),
        fallback: CatalogConstants.examOL,
      ),
      year: year == 0 ? DateTime.now().year : year,
      subject: ParseUtils.str(ParseUtils.pick(data, <String>['subject', 'subjectName'])),
      medium: ParseUtils.str(
        ParseUtils.pick(data, <String>['medium', 'language']),
        fallback: CatalogConstants.mediumSinhala,
      ),
      pdfUrl: ParseUtils.str(ParseUtils.pick(data, <String>['pdfUrl', 'pdf_url', 'fileUrl', 'url'])),
      paperType: paperType,
      hasMarkingScheme: ParseUtils.boolean(
        ParseUtils.pick(data, <String>['hasMarkingScheme', 'markingScheme', 'answersAvailable']),
        fallback: paperType == CatalogConstants.paperTypeMarkingScheme,
      ),
      grade: grade == 0 ? null : grade,
      term: term == 0 ? null : term,
      fileSize: fileSize,
      fileSizeBytes: ParseUtils.integer(
        ParseUtils.pick(data, <String>['fileSizeBytes', 'fileSizeInBytes', 'bytes']),
        fallback: ParseUtils.bytesFromSizeString(fileSize),
      ),
      downloads: ParseUtils.integer(ParseUtils.pick(data, <String>['downloads', 'downloadCount'])),
      updatedAt: ParseUtils.date(
        ParseUtils.pick(data, <String>['timestamp', 'updatedAt', 'uploadedAt']),
      ),
    );
  }

  Map<String, dynamic> toMap({bool includeTimestamp = true}) {
    return <String, dynamic>{
      'title': title,
      'examType': examType,
      'year': year,
      'subject': subject,
      'medium': medium,
      'paperType': paperType,
      'hasMarkingScheme': hasMarkingScheme,
      'grade': grade,
      'term': term,
      'pdfUrl': pdfUrl,
      'fileSize': fileSize,
      'fileSizeBytes': fileSizeBytes,
      'downloads': downloads,
      'keywords': keywords,
      if (includeTimestamp) 'timestamp': FieldValue.serverTimestamp(),
    };
  }

  @override
  Map<String, dynamic> toJson() => <String, dynamic>{
        'type': type.key,
        'id': id,
        'title': title,
        'examType': examType,
        'year': year,
        'subject': subject,
        'medium': medium,
        'paperType': paperType,
        'hasMarkingScheme': hasMarkingScheme,
        'grade': grade,
        'term': term,
        'pdfUrl': pdfUrl,
        'fileSize': fileSize,
        'fileSizeBytes': fileSizeBytes,
        'downloads': downloads,
        'updatedAt': updatedAt?.toIso8601String(),
      };

  factory PaperModel.fromJson(Map<String, dynamic> json) => PaperModel.fromMap(
        ParseUtils.str(json['id']),
        <String, dynamic>{
          'title': json['title'],
          'examType': json['examType'],
          'year': json['year'],
          'subject': json['subject'],
          'medium': json['medium'],
          'paperType': json['paperType'],
          'hasMarkingScheme': json['hasMarkingScheme'],
          'grade': json['grade'],
          'term': json['term'],
          'pdfUrl': json['pdfUrl'],
          'fileSize': json['fileSize'],
          'fileSizeBytes': json['fileSizeBytes'],
          'downloads': json['downloads'],
          'timestamp': json['updatedAt'],
        },
      );

  @override
  bool operator ==(Object other) => other is PaperModel && other.id == id;

  @override
  int get hashCode => Object.hash(type, id);

  @override
  String toString() => 'PaperModel($id, $title, $year $examType)';
}
