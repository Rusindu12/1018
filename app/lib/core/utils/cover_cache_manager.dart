import 'package:flutter_cache_manager/flutter_cache_manager.dart';

import '../config/app_config.dart';

/// Dedicated disk cache for book covers and thumbnails.
///
/// Why a named cache instead of the default one:
///   * covers are tiny and rarely change, so a long [AppConfig.coverCacheStalePeriod]
///     means a student on a metered connection downloads each cover once;
///   * it is isolated from any other image the app ever loads, so
///     Settings → "Clear image cache" can wipe covers without touching PDFs;
///   * the database is a plain JSON file, keeping the app free of the sqflite
///     native dependency (smaller APK, fewer platform edge cases).
class CoverCacheManager {
  CoverCacheManager._();

  static const String cacheKey = 'edulanka_covers';

  static final CacheManager instance = CacheManager(
    Config(
      cacheKey,
      stalePeriod: AppConfig.coverCacheStalePeriod,
      maxNrOfCacheObjects: 200,
      repo: JsonCacheInfoRepository(databaseName: cacheKey),
      fileService: HttpFileService(),
    ),
  );

  /// Called by Settings → "Clear image cache".
  static Future<void> clear() => instance.emptyCache();
}
