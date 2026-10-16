import '../models/downloaded_file.dart';
import 'local_store.dart';

/// Index of the PDFs stored on the device.
///
/// The PDF bytes live in the app documents directory; this store only keeps the
/// metadata so the Downloads screen can render instantly (and offline).
class DownloadsStore {
  DownloadsStore(this._local);

  final LocalStore _local;

  /// Newest download first.
  List<DownloadedFile> load() {
    final List<DownloadedFile> files = <DownloadedFile>[];
    for (final Map<String, dynamic> json in _local.getMapList(LocalKeys.downloads)) {
      final DownloadedFile? file = DownloadedFile.fromJson(json);
      if (file != null) files.add(file);
    }
    files.sort((DownloadedFile a, DownloadedFile b) =>
        b.downloadedAt.compareTo(a.downloadedAt));
    return files;
  }

  Future<void> save(List<DownloadedFile> files) => _local.setMapList(
        LocalKeys.downloads,
        files.map((DownloadedFile file) => file.toJson()).toList(growable: false),
      );

  int totalBytes(List<DownloadedFile> files) =>
      files.fold<int>(0, (int sum, DownloadedFile file) => sum + file.sizeBytes);
}
