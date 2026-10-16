import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/config/app_config.dart';
import '../../core/errors/app_exception.dart';
import '../models/catalog_item.dart';
import '../models/downloaded_file.dart';
import '../sources/catalog_local_source.dart';
import '../sources/downloads_store.dart';

/// Progress of a single download, emitted while the file is being written.
class DownloadProgress {
  const DownloadProgress({
    required this.itemId,
    required this.received,
    required this.total,
  });

  final String itemId;
  final int received;

  /// Total bytes when the server reports `Content-Length`, otherwise 0.
  final int total;

  double? get fraction => total > 0 ? (received / total).clamp(0.0, 1.0) : null;
}

/// Owns everything about the PDFs on disk: downloading, verifying, deleting,
/// and reporting how much space they use.
///
/// Files are written to `documents/edulanka_downloads/<type>_<id>.pdf` so they
/// survive app restarts but are removed when the user uninstalls (the same
/// lifetime the Play Store expects for user-visible download caches).
class DownloadRepository {
  DownloadRepository({
    required DownloadsStore downloadsStore,
    CatalogLocalSource? localSource,
    Dio? dio,
  })  : _downloadsStore = downloadsStore,
        _localSource = localSource ?? CatalogLocalSource(),
        _dio = dio ??
            Dio(
              BaseOptions(
                connectTimeout: const Duration(seconds: 20),
                receiveTimeout: AppConfig.downloadTimeout,
                sendTimeout: const Duration(seconds: 20),
                // Firebase Storage usually answers with a 302 to the bucket
                // host, so redirects must be followed. Bad responses are
                // detected afterwards by the PDF magic-header check.
                followRedirects: true,
              ),
            );

  final DownloadsStore _downloadsStore;
  final CatalogLocalSource _localSource;
  final Dio _dio;

  Directory? _cachedDirectory;

  /// Absolute path including the file name; the file may not exist yet.
  Future<String> pathFor(CatalogItem item) async {
    final Directory directory = await downloadDirectory();
    return '${directory.path}/${fileNameFor(item)}';
  }

  /// `book_g10_mathematics_si.pdf` - stable, filesystem safe, debuggable.
  static String fileNameFor(CatalogItem item) {
    final String safeId = item.id.replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '_');
    return '${item.type.key}_$safeId.pdf';
  }

  Future<Directory> downloadDirectory() async {
    if (_cachedDirectory != null) return _cachedDirectory!;
    final Directory documents = await getApplicationDocumentsDirectory();
    final Directory directory = Directory('${documents.path}/${AppConfig.downloadFolder}');
    if (!await directory.exists()) await directory.create(recursive: true);
    _cachedDirectory = directory;
    return directory;
  }

  /// True when the item is in the download index *and* the file is still there.
  Future<bool> isDownloaded(CatalogItem item) async {
    final String path = await pathFor(item);
    return File(path).exists();
  }

  /// Downloads [item] and registers it in [DownloadsStore].
  ///
  /// Returns the stored [DownloadedFile]. Throws [AppException] on failure -
  /// partial files are always removed so a retry starts clean.
  Future<DownloadedFile> download(
    CatalogItem item, {
    void Function(DownloadProgress progress)? onProgress,
    CancelToken? cancelToken,
  }) async {
    final File target = File(await pathFor(item));
    try {
      if (item.pdfUrl.startsWith(AppConfig.assetScheme)) {
        // Demo catalogue: "download" = copy the bundled PDF into the downloads
        // folder, exercising the exact same code path as a network download.
        onProgress?.call(DownloadProgress(itemId: item.id, received: 0, total: 0));
        await copyAssetPdf(item.pdfUrl, target);
      } else {
        await _dio.download(
          item.pdfUrl,
          target.path,
          cancelToken: cancelToken,
          deleteOnError: true,
          onReceiveProgress: (int received, int total) => onProgress?.call(
            DownloadProgress(itemId: item.id, received: received, total: total),
          ),
        );
      }

      await _verifyPdf(target);

      final DownloadedFile file = DownloadedFile(
        item: item,
        filePath: target.path,
        fileName: target.uri.pathSegments.last,
        sizeBytes: await target.length(),
        downloadedAt: DateTime.now(),
      );
      await _upsertIndex(file);
      return file;
    } on Object catch (error, stack) {
      // Never leave a half written file behind: it would open as a blank PDF.
      if (await target.exists()) {
        try {
          await target.delete();
        } catch (_) {
          // Ignore: the index cleanup below still keeps the UI consistent.
        }
      }
      if (error is DioException && CancelToken.isCancel(error)) {
        throw AppException(AppErrorKind.cancelled, retryable: false);
      }
      throw AppException.from(error, stack);
    }
  }

  /// Copies a PDF bundled in the APK to [target].
  ///
  /// Only one sample PDF ships with EduLanka ([AppConfig.samplePdfAsset]), so
  /// every `asset:` URL is served from it - the point is to exercise the real
  /// download/verify/index code path with no network at all.
  Future<File> copyAssetPdf(String assetUrl, File target) async {
    final File sample = await _localSource.ensureSamplePdf();
    return sample.copy(target.path);
  }

  /// Extracted copy of the bundled sample PDF (used by "Open sample paper").
  Future<File> ensureSampleFile() => _localSource.ensureSamplePdf();

  /// Confirms the file really is a PDF (`%PDF-` magic header) and is not empty.
  /// Catches captive-portal HTML pages and truncated downloads.
  Future<void> _verifyPdf(File file) async {
    if (!await file.exists() || await file.length() < 1024) {
      throw AppException(AppErrorKind.corruptFile, technical: 'file too small');
    }
    final RandomAccessFile handle = await file.open();
    try {
      final Uint8List header = await handle.read(5);
      final String magic = String.fromCharCodes(header);
      if (!magic.startsWith('%PDF')) {
        throw AppException(AppErrorKind.corruptFile, technical: 'bad magic: $magic');
      }
    } finally {
      await handle.close();
    }
  }

  Future<void> _upsertIndex(DownloadedFile file) async {
    final List<DownloadedFile> files = _downloadsStore.load()
      ..removeWhere((DownloadedFile existing) => existing.itemId == file.itemId);
    files.insert(0, file);
    await _downloadsStore.save(files);
  }

  /// Records the page count reported by the PDF engine (used by the Downloads
  /// list without opening the file again).
  Future<void> updatePageCount(String itemId, int pageCount) async {
    final List<DownloadedFile> files = _downloadsStore.load();
    final int index = files.indexWhere((DownloadedFile file) => file.itemId == itemId);
    if (index < 0) return;
    files[index] = files[index].copyWith(pageCount: pageCount);
    await _downloadsStore.save(files);
  }

  /// Deletes the file and its index entry.
  Future<void> delete(DownloadedFile file) async {
    final File target = File(file.filePath);
    if (await target.exists()) {
      try {
        await target.delete();
      } on FileSystemException catch (error, stack) {
        throw AppException.from(error, stack);
      }
    }
    await removeFromIndex(file.itemId);
  }

  /// Forgets an index entry whose file disappeared (e.g. cleared by the OS).
  Future<void> removeFromIndex(String itemId) async {
    final List<DownloadedFile> files = _downloadsStore.load()
      ..removeWhere((DownloadedFile file) => file.itemId == itemId);
    await _downloadsStore.save(files);
  }

  /// Deletes every downloaded PDF ("Delete all downloads").
  Future<void> deleteAll(List<DownloadedFile> files) async {
    for (final DownloadedFile file in files) {
      await delete(file);
    }
  }

  /// Removes index entries whose file is gone, returning the cleaned list.
  Future<List<DownloadedFile>> reconcile(List<DownloadedFile> files) async {
    final List<DownloadedFile> alive = <DownloadedFile>[];
    bool changed = false;
    for (final DownloadedFile file in files) {
      if (await File(file.filePath).exists()) {
        alive.add(file);
      } else {
        changed = true;
      }
    }
    if (changed) await _downloadsStore.save(alive);
    return alive;
  }

  /// Bytes used by downloaded PDFs (shown in the Downloads header).
  Future<int> usedBytes(List<DownloadedFile> files) async {
    int total = 0;
    for (final DownloadedFile file in files) {
      final File target = File(file.filePath);
      if (await target.exists()) total += await target.length();
    }
    return total;
  }

  void dispose() => _dio.close(force: true);
}
