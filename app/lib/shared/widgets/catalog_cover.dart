import 'package:cached_network_image/cached_network_image.dart';
import 'package:characters/characters.dart';
import 'package:flutter/material.dart';

import '../../core/config/app_config.dart';
import '../../core/utils/cover_cache_manager.dart';
import '../../data/models/catalog_item.dart';
import 'subject_icon.dart';

/// Cover artwork for a catalogue entry.
///
/// Three sources are supported, in priority order:
///   1. `asset:` URLs - PDFs/covers bundled in the APK (demo catalogue),
///   2. `https://` URLs - Firebase Storage, cached on disk by
///      [CachedNetworkImage] (30 days, see [AppConfig.coverCacheStalePeriod]),
///   3. a generated cover built from the subject icon - used when the admin did
///      not upload artwork, which is the case for most past papers.
class CatalogCover extends StatelessWidget {
  const CatalogCover({
    super.key,
    required this.item,
    this.width,
    this.height,
    this.borderRadius = 12,
    this.showTypeBadge = false,
  });

  final CatalogItem item;
  final double? width;
  final double? height;
  final double borderRadius;

  /// Draws a small "BOOK"/"PAPER" flag in the corner (used in mixed lists).
  final bool showTypeBadge;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        width: width,
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            _image(context),
            if (showTypeBadge)
              Positioned(
                left: 6,
                top: 6,
                child: _TypeBadge(type: item.type),
              ),
          ],
        ),
      ),
    );
  }

  Widget _image(BuildContext context) {
    final String? url = item.coverUrl;
    if (url == null || url.isEmpty) return _generated(context);
    if (url.startsWith(AppConfig.assetScheme)) {
      return Image.asset(
        url.substring(AppConfig.assetScheme.length),
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _generated(context),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      // Dedicated, long-lived cache: covers cost bandwidth on metered 3G links,
      // and they practically never change (see [CoverCacheManager]).
      cacheManager: CoverCacheManager.instance,
      fadeInDuration: const Duration(milliseconds: 180),
      maxWidthDiskCache: 480,
      placeholder: (BuildContext context, String _) => _GeneratedCover(item: item, loading: true),
      errorWidget: (BuildContext context, String _, Object __) => _generated(context),
    );
  }

  Widget _generated(BuildContext context) => _GeneratedCover(item: item);

  static String initialsOf(String title) {
    final List<String> words = title.trim().split(RegExp(r'\s+'));
    if (words.isEmpty || words.first.isEmpty) return '?';
    if (words.length == 1) {
      return words.first.characters.take(2).toString().toUpperCase();
    }
    return (words[0].characters.first + words[1].characters.first).toUpperCase();
  }
}

/// Gradient tile with the subject icon - the fallback "cover".
class _GeneratedCover extends StatelessWidget {
  const _GeneratedCover({required this.item, this.loading = false});

  final CatalogItem item;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final Color base = SubjectIcon.colorFor(item.subject, brightness: Theme.of(context).brightness);
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[
            base.withValues(alpha: loading ? 0.25 : 0.85),
            base.withValues(alpha: loading ? 0.15 : 0.55),
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              SubjectIcon.iconFor(item.subject),
              color: Colors.white.withValues(alpha: 0.92),
              size: 30,
            ),
            const SizedBox(height: 6),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                CatalogCover.initialsOf(item.title),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.type});

  final ContentType type;

  @override
  Widget build(BuildContext context) {
    final bool isPaper = type == ContentType.paper;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: (isPaper ? const Color(0xFF1565C0) : const Color(0xFF00695C)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        isPaper ? 'PAPER' : 'BOOK',
        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
      ),
    );
  }
}
