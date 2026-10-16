import '../../core/utils/parse_utils.dart';
import 'catalog_item.dart';

/// A PDF that lives on the device and can be opened without internet.
///
/// Persisted inside the `edulanka.downloads` shared-preferences key as a JSON
/// list (see `DownloadsStore`), so the whole index survives app restarts and
/// works offline - no Firestore round trip is needed to list downloads.
class DownloadedFile {
  const DownloadedFile({
    required this.item,
    required this.filePath,
    required this.fileName,
    required this.sizeBytes,
    required this.downloadedAt,
    this.pageCount = 0,
  });

  /// Snapshot of the catalogue entry (title, grade, subject, medium, ...).
  final CatalogItem item;

  /// Absolute path inside the app documents directory.
  final String filePath;

  final String fileName;

  /// Real size on disk, filled in after the download completes.
  final int sizeBytes;

  final DateTime downloadedAt;

  /// Pages reported by the PDF engine once the file was opened (0 = unknown).
  final int pageCount;

  String get itemId => item.id;

  ContentType get type => item.type;

  DownloadedFile copyWith({int? pageCount, String? filePath, int? sizeBytes}) {
    return DownloadedFile(
      item: item,
      filePath: filePath ?? this.filePath,
      fileName: fileName,
      sizeBytes: sizeBytes ?? this.sizeBytes,
      downloadedAt: downloadedAt,
      pageCount: pageCount ?? this.pageCount,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'item': item.toJson(),
        'filePath': filePath,
        'fileName': fileName,
        'sizeBytes': sizeBytes,
        'downloadedAt': downloadedAt.toIso8601String(),
        'pageCount': pageCount,
      };

  static DownloadedFile? fromJson(Map<String, dynamic> json) {
    final dynamic rawItem = json['item'];
    if (rawItem is! Map) return null;
    final CatalogItem? item = catalogItemFromJson(
      rawItem.map((dynamic k, dynamic v) => MapEntry<String, dynamic>('$k', v)),
    );
    if (item == null) return null;
    final String path = ParseUtils.str(json['filePath']);
    if (path.isEmpty) return null;
    return DownloadedFile(
      item: item,
      filePath: path,
      fileName: ParseUtils.str(json['fileName'], fallback: path.split('/').last),
      sizeBytes: ParseUtils.integer(json['sizeBytes']),
      downloadedAt: ParseUtils.date(json['downloadedAt']) ?? DateTime.now(),
      pageCount: ParseUtils.integer(json['pageCount']),
    );
  }
}
