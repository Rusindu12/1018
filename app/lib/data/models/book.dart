import 'package:cloud_firestore/cloud_firestore.dart';

import '../../core/constants/catalog_constants.dart';
import '../../core/utils/parse_utils.dart';
import 'catalog_item.dart';

/// A school textbook / workbook / syllabus document.
///
/// Firestore: `books/{bookId}`
/// ```json
/// {
///   "title": "ගණිතය 10 ශ්‍රේණිය",
///   "grade": 10,
///   "subject": "Mathematics",
///   "medium": "Sinhala",
///   "coverUrl": "https://firebasestorage...",
///   "pdfUrl": "https://firebasestorage...",
///   "fileSize": "12.5 MB",
///   "fileSizeBytes": 13107200,
///   "year": 2024,
///   "category": "textbook",
///   "pages": 220,
///   "downloads": 1500,
///   "keywords": ["ගණිතය", "mathematics", "grade 10"],
///   "timestamp": <serverTimestamp>
/// }
/// ```
class BookModel implements CatalogItem {
  const BookModel({
    required this.id,
    required this.title,
    required this.grade,
    required this.subject,
    required this.medium,
    required this.pdfUrl,
    this.coverUrl,
    this.fileSize = '',
    this.fileSizeBytes = 0,
    this.year,
    this.category = CatalogConstants.categoryTextbook,
    this.pages = 0,
    this.downloads = 0,
    this.updatedAt,
  });

  @override
  final String id;

  @override
  final String title;

  @override
  final int grade;

  @override
  final String subject;

  @override
  final String medium;

  @override
  final String pdfUrl;

  @override
  final String? coverUrl;

  @override
  final String fileSize;

  @override
  final int fileSizeBytes;

  /// Publication/edition year (null for old uploads without one).
  @override
  final int? year;

  @override
  final String category;

  /// Total page count when the admin filled it in (0 = unknown).
  final int pages;

  @override
  final int downloads;

  @override
  final DateTime? updatedAt;

  @override
  ContentType get type => ContentType.book;

  /// `Grade 10 · Mathematics · Sinhala` - the caller localises each part.
  @override
  String get subtitle => 'Grade $grade · $subject · $medium';

  /// Text matched by the client-side search fallback (and stored in Firestore so
  /// a future server-side search can use it).
  @override
  List<String> get keywords => <String>[
        title,
        subject,
        'grade $grade',
        '$grade',
        medium,
        category,
        if (year != null) '$year',
      ];

  BookModel copyWith({
    String? title,
    int? grade,
    String? subject,
    String? medium,
    String? pdfUrl,
    String? coverUrl,
    String? fileSize,
    int? fileSizeBytes,
    int? year,
    String? category,
    int? pages,
    int? downloads,
    DateTime? updatedAt,
  }) {
    return BookModel(
      id: id,
      title: title ?? this.title,
      grade: grade ?? this.grade,
      subject: subject ?? this.subject,
      medium: medium ?? this.medium,
      pdfUrl: pdfUrl ?? this.pdfUrl,
      coverUrl: coverUrl ?? this.coverUrl,
      fileSize: fileSize ?? this.fileSize,
      fileSizeBytes: fileSizeBytes ?? this.fileSizeBytes,
      year: year ?? this.year,
      category: category ?? this.category,
      pages: pages ?? this.pages,
      downloads: downloads ?? this.downloads,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  /// Tolerant of missing/renamed fields - see [ParseUtils].
  factory BookModel.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final Map<String, dynamic> data = doc.data() ?? <String, dynamic>{};
    return BookModel.fromMap(doc.id, data);
  }

  factory BookModel.fromMap(String id, Map<String, dynamic> data) {
    final String fileSize = ParseUtils.str(
      ParseUtils.pick(data, <String>['fileSize', 'file_size', 'size']),
    );
    return BookModel(
      id: id,
      title: ParseUtils.str(
        ParseUtils.pick(data, <String>['title', 'name', 'bookName']),
        fallback: 'Untitled',
      ),
      grade: ParseUtils.integer(ParseUtils.pick(data, <String>['grade', 'gradeLevel'])),
      subject: ParseUtils.str(ParseUtils.pick(data, <String>['subject', 'subjectName'])),
      medium: ParseUtils.str(
        ParseUtils.pick(data, <String>['medium', 'language']),
        fallback: CatalogConstants.mediumSinhala,
      ),
      pdfUrl: ParseUtils.str(ParseUtils.pick(data, <String>['pdfUrl', 'pdf_url', 'fileUrl', 'url'])),
      coverUrl: ParseUtils.str(
        ParseUtils.pick(data, <String>['coverUrl', 'cover_url', 'thumbnail', 'imageUrl']),
      ).isEmpty
          ? null
          : ParseUtils.str(ParseUtils.pick(data, <String>['coverUrl', 'cover_url', 'thumbnail', 'imageUrl'])),
      fileSize: fileSize,
      fileSizeBytes: ParseUtils.integer(
        ParseUtils.pick(data, <String>['fileSizeBytes', 'fileSizeInBytes', 'bytes']),
        fallback: ParseUtils.bytesFromSizeString(fileSize),
      ),
      year: ParseUtils.integer(ParseUtils.pick(data, <String>['year', 'edition'])) == 0
          ? null
          : ParseUtils.integer(ParseUtils.pick(data, <String>['year', 'edition'])),
      category: ParseUtils.str(
        ParseUtils.pick(data, <String>['category', 'type']),
        fallback: CatalogConstants.categoryTextbook,
      ),
      pages: ParseUtils.integer(ParseUtils.pick(data, <String>['pages', 'pageCount'])),
      downloads: ParseUtils.integer(ParseUtils.pick(data, <String>['downloads', 'downloadCount'])),
      updatedAt: ParseUtils.date(
        ParseUtils.pick(data, <String>['timestamp', 'updatedAt', 'uploadedAt']),
      ),
    );
  }

  /// Full document payload written by the admin panel / seed script.
  Map<String, dynamic> toMap({bool includeTimestamp = true}) {
    return <String, dynamic>{
      'title': title,
      'grade': grade,
      'subject': subject,
      'medium': medium,
      'coverUrl': coverUrl ?? '',
      'pdfUrl': pdfUrl,
      'fileSize': fileSize,
      'fileSizeBytes': fileSizeBytes,
      'year': year,
      'category': category,
      'pages': pages,
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
        'grade': grade,
        'subject': subject,
        'medium': medium,
        'pdfUrl': pdfUrl,
        'coverUrl': coverUrl,
        'fileSize': fileSize,
        'fileSizeBytes': fileSizeBytes,
        'year': year,
        'category': category,
        'pages': pages,
        'downloads': downloads,
        'updatedAt': updatedAt?.toIso8601String(),
      };

  factory BookModel.fromJson(Map<String, dynamic> json) => BookModel.fromMap(
        ParseUtils.str(json['id']),
        <String, dynamic>{
          'title': json['title'],
          'grade': json['grade'],
          'subject': json['subject'],
          'medium': json['medium'],
          'pdfUrl': json['pdfUrl'],
          'coverUrl': json['coverUrl'],
          'fileSize': json['fileSize'],
          'fileSizeBytes': json['fileSizeBytes'],
          'year': json['year'],
          'category': json['category'],
          'pages': json['pages'],
          'downloads': json['downloads'],
          'timestamp': json['updatedAt'],
        },
      );

  @override
  bool operator ==(Object other) => other is BookModel && other.id == id;

  @override
  int get hashCode => Object.hash(type, id);

  @override
  String toString() => 'BookModel($id, $title, grade $grade)';
}
