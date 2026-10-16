import 'package:cloud_firestore/cloud_firestore.dart';

import '../../core/config/app_config.dart';
import '../../core/utils/parse_utils.dart';
import '../models/catalog_item.dart';
import '../models/book.dart';
import '../models/paper.dart';

/// Everything that talks to Firestore lives here.
///
/// ## Why the catalogue is fetched in bulk instead of server-filtered
///
/// The obvious implementation is one query per filter combination
/// (`where('grade', ==, 10).where('medium', ==, 'Sinhala').orderBy('timestamp')`)
/// - but Firestore charges such a query with a **composite index** requirement
/// for every combination the UI can produce (3 grades x 3 mediums x N subjects
/// x 4 sort orders). Asking a volunteer admin to click through 100+ index
/// creation links is a bad trade for a free community app.
///
/// The catalogue of a whole country's school system is ~1-2k small documents
/// (a few hundred KB), so instead the app:
///   1. streams the collection in chunks of [AppConfig.firestorePageSize]
///      using only an `orderBy` on a single field (covered by the automatic
///      single-field index, no setup required),
///   2. caches the result on disk for [AppConfig.catalogCacheTtl],
///   3. filters, searches (any script) and paginates locally.
///
/// Reads are counted once per cache miss: a fresh install or a pull-to-refresh
/// after the TTL, well inside the Spark plan's 50k daily reads.
class CatalogRemoteSource {
  CatalogRemoteSource({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _books =>
      _firestore.collection(AppConfig.booksCollection);

  CollectionReference<Map<String, dynamic>> get _papers =>
      _firestore.collection(AppConfig.papersCollection);

  /// Newest first. Falls back to an unordered fetch when documents have no
  /// `timestamp` field (an admin may have created them by hand).
  Future<List<CatalogItem>> fetchBooks() => _fetchAll(
        collection: _books,
        mapper: BookModel.fromDoc,
      );

  Future<List<CatalogItem>> fetchPapers() => _fetchAll(
        collection: _papers,
        mapper: PaperModel.fromDoc,
      );

  Future<List<CatalogItem>> _fetchAll({
    required CollectionReference<Map<String, dynamic>> collection,
    required CatalogItem Function(DocumentSnapshot<Map<String, dynamic>>) mapper,
  }) async {
    try {
      return await _fetchChunked(collection: collection, mapper: mapper, ordered: true);
    } on FirebaseException catch (error) {
      // `failed-precondition` here means the field has no index at all or the
      // documents are missing `timestamp`: retry without ordering.
      if (error.code == 'failed-precondition' || error.code == 'invalid-argument') {
        return _fetchChunked(collection: collection, mapper: mapper, ordered: false);
      }
      rethrow;
    }
  }

  Future<List<CatalogItem>> _fetchChunked({
    required CollectionReference<Map<String, dynamic>> collection,
    required CatalogItem Function(DocumentSnapshot<Map<String, dynamic>>) mapper,
    required bool ordered,
  }) async {
    final List<CatalogItem> items = <CatalogItem>[];
    DocumentSnapshot<Map<String, dynamic>>? cursor;
    bool hasMore = true;

    while (hasMore && items.length < AppConfig.maxCatalogDocuments) {
      Query<Map<String, dynamic>> query = collection;
      if (ordered) query = query.orderBy('timestamp', descending: true);
      query = query.limit(AppConfig.firestorePageSize);
      if (cursor != null) query = query.startAfterDocument(cursor);

      final QuerySnapshot<Map<String, dynamic>> snapshot = await query.get();
      for (final QueryDocumentSnapshot<Map<String, dynamic>> doc in snapshot.docs) {
        final CatalogItem item = mapper(doc);
        // Skip half-created documents (admin saved without a PDF yet).
        if (item.pdfUrl.isEmpty) continue;
        items.add(item);
      }

      hasMore = snapshot.docs.length == AppConfig.firestorePageSize;
      if (snapshot.docs.isNotEmpty) cursor = snapshot.docs.last;
    }
    return items;
  }

  /// Best-effort download counter. Never throws: with read-only security rules
  /// (or an offline device) the counter simply stays as it is.
  Future<void> incrementDownloadCounter(ContentType type, String id) async {
    try {
      final CollectionReference<Map<String, dynamic>> collection =
          type == ContentType.paper ? _papers : _books;
      await collection.doc(id).update(<String, dynamic>{
        'downloads': FieldValue.increment(1),
      });
    } catch (_) {
      // Ignored on purpose - statistics are not worth an error dialog.
    }
  }

  /// Cheap "did anything change?" probe used by the periodic refresh: one
  /// document read instead of a full collection download.
  Future<int> latestTimestamp(ContentType type) async {
    final CollectionReference<Map<String, dynamic>> collection =
        type == ContentType.paper ? _papers : _books;
    final QuerySnapshot<Map<String, dynamic>> snapshot =
        await collection.orderBy('timestamp', descending: true).limit(1).get();
    if (snapshot.docs.isEmpty) return 0;
    final Map<String, dynamic> data = snapshot.docs.first.data();
    return ParseUtils.date(data['timestamp'])?.millisecondsSinceEpoch ?? 0;
  }
}
