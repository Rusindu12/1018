import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/config/app_config.dart';
import '../models/catalog_item.dart';
import '../models/book.dart';
import '../models/paper.dart';

/// Reads the catalogue bundled inside the APK.
///
/// This is what makes the app runnable **before** any Firebase project exists
/// (see `AppConfig.demoMode`): `assets/data/demo_books.json` and
/// `assets/data/demo_papers.json` ship with a realistic starter catalogue, and
/// every PDF URL points at `assets/sample/sample_paper.pdf`, so downloading,
/// offline reading, favourites and the PDF viewer can all be tested end to end
/// with no network at all.
class CatalogLocalSource {
  CatalogLocalSource({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;

  static const String booksAsset = 'assets/data/demo_books.json';
  static const String papersAsset = 'assets/data/demo_papers.json';

  /// Reads one collection from the assets and skips malformed rows.
  Future<List<CatalogItem>> loadBooks() async {
    final dynamic decoded = await _decodeAsset(booksAsset);
    if (decoded is! List) return <CatalogItem>[];
    final List<CatalogItem> items = <CatalogItem>[];
    for (final dynamic row in decoded) {
      if (row is Map) {
        final Map<String, dynamic> map =
            row.map((dynamic k, dynamic v) => MapEntry<String, dynamic>('$k', v));
        final String id = _idOf(map, '_${map['grade'] ?? ''}', 'book');
        items.add(BookModel.fromMap(id, map));
      }
    }
    return items;
  }

  Future<List<CatalogItem>> loadPapers() async {
    final dynamic decoded = await _decodeAsset(papersAsset);
    if (decoded is! List) return <CatalogItem>[];
    final List<CatalogItem> items = <CatalogItem>[];
    for (final dynamic row in decoded) {
      if (row is Map) {
        final Map<String, dynamic> map =
            row.map((dynamic k, dynamic v) => MapEntry<String, dynamic>('$k', v));
        final String id = _idOf(map, '_${map['year'] ?? ''}', 'paper');
        items.add(PaperModel.fromMap(id, map));
      }
    }
    return items;
  }

  Future<dynamic> _decodeAsset(String path) async {
    final String raw = await _bundle.loadString(path);
    return jsonDecode(raw);
  }

  /// Copies the bundled sample PDF into the app documents directory so that
  /// `flutter_pdfview` (which needs a real file path) can open it.
  Future<File> ensureSamplePdf() async {
    final Directory directory = await getApplicationDocumentsDirectory();
    final File file = File('${directory.path}/sample_paper.pdf');
    if (await file.exists() && await file.length() > 0) return file;
    final ByteData data = await _bundle.load(AppConfig.samplePdfAsset);
    await file.writeAsBytes(
      data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
      flush: true,
    );
    return file;
  }

  /// Turns any text into a filesystem/url safe id fragment. Non-latin titles
  /// (Sinhala/Tamil) collapse to an empty string, so the demo JSON carries an
  /// explicit `id` for every row and this is only a last-resort fallback.
  static String _slug(dynamic value) {
    final String cleaned = '${value ?? ''}'
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9]+'), '_')
        .replaceAll(RegExp(r'^_+|_+$'), '');
    if (cleaned.isEmpty) return 'item';
    return cleaned.length > 40 ? cleaned.substring(0, 40) : cleaned;
  }

  /// Uses the `id` from the bundled JSON when present (stable across launches),
  /// otherwise derives one from the title.
  static String _idOf(Map<String, dynamic> map, String fallbackSuffix, String prefix) {
    final String explicit = '${map['id'] ?? ''}'.trim();
    if (explicit.isNotEmpty) return explicit;
    return '${prefix}_${_slug(map['title'])}$fallbackSuffix';
  }
}
