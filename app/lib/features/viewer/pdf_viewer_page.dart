import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/errors/app_exception.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/library_providers.dart';
import '../../core/providers/ui_providers.dart';
import '../../core/utils/format_utils.dart';
import '../../data/models/catalog_item.dart';
import '../../data/models/downloaded_file.dart';
import '../../data/models/book.dart';
import '../../data/models/paper.dart';
import '../../data/repositories/download_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../l10n/catalog_names.dart';
import '../../shared/widgets/app_snackbar.dart';
import '../../shared/widgets/catalog_cover.dart';
import '../../shared/widgets/download_action_button.dart';
import '../../shared/widgets/error_state_view.dart';
import '../../shared/widgets/favorite_button.dart';

/// Full-screen PDF reader.
///
/// Always renders a **local** file: the screen either receives a path (the item
/// was downloaded already) or fetches it first with a visible progress bar. That
/// keeps reading smooth, makes "offline reading" the default rather than a
/// special case, and avoids the flaky "stream a PDF over a slow 3G link"
/// behaviour students complain about.
class PdfViewerPage extends ConsumerStatefulWidget {
  const PdfViewerPage({
    super.key,
    required this.item,
    this.localPath,
    this.initialPage = 1,
  });

  final CatalogItem item;
  final String? localPath;
  final int initialPage;

  @override
  ConsumerState<PdfViewerPage> createState() => _PdfViewerPageState();
}

class _PdfViewerPageState extends ConsumerState<PdfViewerPage> {
  final PDFViewController _pdfController = PDFViewController();

  String? _filePath;
  Object? _openError;
  bool _downloading = false;
  double? _progress;
  int _currentPage = 1;
  int _totalPages = 0;
  bool _fitWidth = false;

  @override
  void initState() {
    super.initState();
    _currentPage = widget.initialPage;
    _resolveFile();
  }

  /// Decides what to display: local file, existing download, or start fetching.
  Future<void> _resolveFile() async {
    if (widget.localPath != null) {
      setState(() => _filePath = widget.localPath);
      return;
    }

    final DownloadedFile? already =
        ref.read(downloadedFileProvider(widget.item));
    if (already != null && await File(already.filePath).exists()) {
      setState(() => _filePath = already.filePath);
      return;
    }

    // Freshly downloaded files are hidden from the user here: the item may be a
    // "preview" that the student did not explicitly save, so we only keep the
    // copy if they tap the download button (which reuses this same file).
    await _download();
  }

  Future<void> _download() async {
    setState(() {
      _downloading = true;
      _progress = null;
      _openError = null;
    });
    try {
      final DownloadedFile? file =
          await ref.read(downloadManagerProvider.notifier).start(widget.item);
      if (!mounted || file == null) return;
      setState(() {
        _filePath = file.filePath;
        _downloading = false;
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _downloading = false;
        _openError = error;
      });
    }
  }

  @override
  void dispose() {
    _pdfController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final bool nightMode = ref.watch(viewerNightModeProvider);
    final List<int> bookmarks = ref.watch(bookmarksProvider)[itemKey(widget.item)] ?? const <int>[];

    return Scaffold(
      backgroundColor: nightMode ? Colors.black : null,
      appBar: AppBar(
        backgroundColor: nightMode ? Colors.black : null,
        foregroundColor: nightMode ? Colors.white70 : null,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              widget.item.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            Text(
              _totalPages > 0
                  ? l10n.viewerPageOf(_currentPage, _totalPages)
                  : widget.subtitleLine(l10n),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w400,
                color: nightMode ? Colors.white54 : Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        actions: <Widget>[
          FavoriteButton(item: widget.item, size: 22, showSnackBar: false),
          PopupMenuButton<_ViewerAction>(
            tooltip: l10n.commonShowMore,
            onSelected: (_ViewerAction action) => _handleAction(action, bookmarks),
            itemBuilder: (BuildContext context) => <PopupMenuEntry<_ViewerAction>>[
              PopupMenuItem<_ViewerAction>(
                value: _ViewerAction.share,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.share_outlined),
                  title: Text(l10n.viewerShare),
                ),
              ),
              PopupMenuItem<_ViewerAction>(
                value: _ViewerAction.download,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.download_for_offline_outlined),
                  title: Text(l10n.viewerDownload),
                ),
              ),
              PopupMenuItem<_ViewerAction>(
                value: _ViewerAction.openExternal,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.open_in_new),
                  title: Text(l10n.viewerOpenExternal),
                ),
              ),
              PopupMenuItem<_ViewerAction>(
                value: _ViewerAction.bookmarks,
                child: ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.bookmarks_outlined),
                  title: Text('${l10n.viewerBookmark} (${bookmarks.length})'),
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: <Widget>[
          Expanded(child: _buildBody(nightMode)),
          _ViewerBottomBar(
            nightMode: nightMode,
            fitWidth: _fitWidth,
            bookmarked: bookmarks.contains(_currentPage),
            onToggleNightMode: () => ref.read(viewerNightModeProvider.notifier).toggle(),
            onToggleFit: () => setState(() => _fitWidth = !_fitWidth),
            onToggleBookmark: () => _toggleBookmark(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(bool nightMode) {
    final AppLocalizations l10n = context.l10n;

    if (_openError != null) {
      return ErrorStateView(error: _openError!, onRetry: _download);
    }

    if (_downloading) {
      return _DownloadProgressView(
        item: widget.item,
        progress: _progress,
        onCancel: () {
          ref.read(downloadManagerProvider.notifier).cancel(widget.item);
          setState(() {
            _downloading = false;
            _openError = AppException(AppErrorKind.cancelled, retryable: false);
          });
        },
      );
    }

    final String? path = _filePath;
    if (path == null) {
      return Center(child: CircularProgressIndicator());
    }

    return Stack(
      children: <Widget>[
        PDFView(
          filePath: path,
          controller: _pdfController,
          // Swipe + pinch-zoom come from the native PDF engine.
          enableSwipe: true,
          swipeHorizontal: false,
          autoSpacing: true,
          fitEachPage: true,
          preventLinkAnnotations: false,
          fitPolicy: _fitWidth ? FitPolicy.WIDTH : FitPolicy.BOTH,
          defaultPage: widget.initialPage,
          // The plugin types these callbacks loosely; `dynamic` parameters keep
          // the code compiling across plugin versions (and are cast immediately).
          onRender: (dynamic pages) {
            final int pageCount = pages is int ? pages : _totalPages;
            if (!mounted) return;
            setState(() {
              _totalPages = pageCount;
              if (_currentPage < 1 || _currentPage > pageCount) _currentPage = 1;
            });
            // Remember the page count so the Downloads list can show it without
            // opening the document again.
            if (pageCount > 0) {
              ref.read(downloadRepositoryProvider).updatePageCount(widget.item.id, pageCount);
            }
          },
          onPageChanged: (dynamic page, dynamic total) {
            if (!mounted) return;
            setState(() {
              if (page is int) _currentPage = page;
              if (total is int && total > 0) _totalPages = total;
            });
          },
          onError: (dynamic error) {
            if (!mounted) return;
            setState(
              () => _openError = AppException(
                AppErrorKind.corruptFile,
                technical: '$error',
              ),
            );
          },
        ),
        // "Night mode" dims the page. A true colour inversion is not possible
        // for a native platform view on Android, so the viewer darkens the
        // surface and switches the chrome instead - see docs/PDF_VIEWER.md.
        if (nightMode)
          Positioned.fill(
            child: IgnorePointer(
              child: ColoredBox(color: Colors.black.withValues(alpha: 0.55)),
            ),
          ),
        if (_totalPages > 0)
          Positioned(
            right: 12,
            bottom: 12,
            child: _PagePill(label: l10n.viewerPageOf(_currentPage, _totalPages)),
          ),
      ],
    );
  }

  // ------------------------------------------------------------------ actions
  Future<void> _toggleBookmark() async {
    final bool added =
        await ref.read(bookmarksProvider.notifier).togglePage(widget.item, _currentPage);
    if (!mounted) return;
    AppSnackBar.show(
      context,
      message: added ? context.l10n.viewerBookmarked : context.l10n.viewerBookmarkRemoved,
      duration: const Duration(milliseconds: 1400),
    );
  }

  Future<void> _handleAction(_ViewerAction action, List<int> bookmarks) async {
    switch (action) {
      case _ViewerAction.share:
        await _share();
        break;
      case _ViewerAction.download:
        await _downloadForOffline();
        break;
      case _ViewerAction.openExternal:
        await _openExternal();
        break;
      case _ViewerAction.bookmarks:
        await _showBookmarks(bookmarks);
        break;
    }
  }

  Future<void> _share() async {
    final AppLocalizations l10n = context.l10n;
    final String path = _filePath ?? '';
    final bool hasFile = path.isNotEmpty && await File(path).exists();
    final String message = widget.item.pdfUrl.startsWith('http')
        ? '${widget.item.title}\n${widget.item.pdfUrl}\n\n${AppConfig.appName}'
        : '${widget.item.title} · ${AppConfig.appName}';

    final Rect? origin = _shareOrigin();
    if (hasFile) {
      await Share.shareXFiles(
        <XFile>[XFile(path, mimeType: 'application/pdf')],
        subject: l10n.shareSubject(widget.item.title),
        text: message,
        sharePositionOrigin: origin,
      );
    } else {
      await Share.share(
        message,
        subject: l10n.shareSubject(widget.item.title),
        sharePositionOrigin: origin,
      );
    }
  }

  /// iPad requires a source rectangle for the share popover.
  Rect? _shareOrigin() {
    final RenderObject? box = context.findRenderObject();
    if (box is RenderBox && box.hasSize) {
      return box.localToGlobal(Offset.zero) & box.size;
    }
    return null;
  }

  Future<void> _downloadForOffline() async {
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    try {
      final DownloadedFile? file =
          await ref.read(downloadManagerProvider.notifier).start(widget.item);
      if (file == null || !mounted) return;
      setState(() => _filePath = file.filePath);
      AppSnackBar.show(context, message: context.l10n.viewerSavedOffline);
    } on Object catch (error) {
      final AppException exception = AppException.from(error);
      if (exception.kind == AppErrorKind.cancelled) return;
      messenger.showSnackBar(
        SnackBar(content: Text(AppSnackBar.messageFor(exception, context.l10n))),
      );
    }
  }

  /// Hands the document to another app: a browser for remote PDFs, the system
  /// share sheet for local ones (a file:// intent needs a FileProvider that a
  /// plain Flutter app does not declare).
  Future<void> _openExternal() async {
    final AppLocalizations l10n = context.l10n;
    final String url = widget.item.pdfUrl;
    if (url.startsWith('http')) {
      final bool ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (ok) return;
    }
    if (!mounted) return;
    AppSnackBar.show(context, message: l10n.viewerShare);
    await _share();
  }

  Future<void> _showBookmarks(List<int> bookmarks) async {
    final AppLocalizations l10n = context.l10n;
    if (bookmarks.isEmpty) {
      if (!mounted) return;
      AppSnackBar.show(context, message: l10n.viewerBookmark);
      return;
    }
    final int? page = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (BuildContext context) => ListView(
        shrinkWrap: true,
        children: <Widget>[
          for (final int bookmark in bookmarks)
            ListTile(
              leading: const Icon(Icons.bookmark),
              title: Text(l10n.viewerPageOf(bookmark, _totalPages == 0 ? bookmark : _totalPages)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).pop(bookmark),
            ),
        ],
      ),
    );
    if (page == null) return;
    await _pdfController.setPage(page);
    if (mounted) setState(() => _currentPage = page);
  }
}

enum _ViewerAction { share, download, openExternal, bookmarks }

/// Progress screen shown while the PDF is being fetched for the first time.
class _DownloadProgressView extends ConsumerWidget {
  const _DownloadProgressView({
    required this.item,
    required this.progress,
    required this.onCancel,
  });

  final CatalogItem item;
  final double? progress;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final DownloadProgress? status = ref.watch(downloadManagerProvider)[itemKey(item)];

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: <Widget>[
            SizedBox(
              width: 140,
              height: 180,
              child: CatalogCover(item: item, showTypeBadge: true),
            ),
            const SizedBox(height: 20),
            Text(
              item.title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              item.subtitleLine(l10n),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 24),
            LinearProgressIndicator(value: progress),
            const SizedBox(height: 10),
            Text(
              status == null
                  ? l10n.commonDownloading
                  : FormatUtils.progressLabel(status.received, status.total),
              style: Theme.of(context).textTheme.labelMedium,
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: onCancel,
              icon: const Icon(Icons.close),
              label: Text(l10n.commonCancel),
            ),
          ],
        ),
      ),
    );
  }
}

/// Zoom / night mode / bookmark bar.
class _ViewerBottomBar extends StatelessWidget {
  const _ViewerBottomBar({
    required this.nightMode,
    required this.fitWidth,
    required this.bookmarked,
    required this.onToggleNightMode,
    required this.onToggleFit,
    required this.onToggleBookmark,
  });

  final bool nightMode;
  final bool fitWidth;
  final bool bookmarked;
  final VoidCallback onToggleNightMode;
  final VoidCallback onToggleFit;
  final VoidCallback onToggleBookmark;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final ColorScheme colors = Theme.of(context).colorScheme;
    final Color foreground = nightMode ? Colors.white70 : colors.onSurface;

    return Material(
      color: nightMode ? Colors.black : colors.surface,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: <Widget>[
              _BarButton(
                icon: fitWidth ? Icons.fit_screen_outlined : Icons.fit_screen,
                label: fitWidth ? l10n.viewerFitWidth : l10n.viewerZoomIn,
                color: foreground,
                onPressed: onToggleFit,
              ),
              _BarButton(
                icon: bookmarked ? Icons.bookmark : Icons.bookmark_border,
                label: l10n.viewerBookmark,
                color: bookmarked ? colors.primary : foreground,
                onPressed: onToggleBookmark,
              ),
              _BarButton(
                icon: nightMode ? Icons.dark_mode : Icons.dark_mode_outlined,
                label: l10n.viewerNightMode,
                color: nightMode ? colors.secondary : foreground,
                onPressed: onToggleNightMode,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BarButton extends StatelessWidget {
  const _BarButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(foregroundColor: color),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icon, size: 22),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10)),
        ],
      ),
    );
  }
}

/// Floating page number ("3 / 24").
class _PagePill extends StatelessWidget {
  const _PagePill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Localised one-line subtitle for any catalogue item (used in the app bar and
/// the download progress screen).
extension ViewerItemLabels on CatalogItem {
  String subtitleLine(AppLocalizations l10n) {
    if (this is BookModel) {
      final BookModel book = this as BookModel;
      return '${l10n.gradeLabel(book.grade)} · ${l10n.subjectName(book.subject)} · '
          '${l10n.mediumName(book.medium)}';
    }
    if (this is PaperModel) {
      final PaperModel paper = this as PaperModel;
      return '${l10n.examTypeShort(paper.examType)} ${paper.year} · '
          '${l10n.subjectName(paper.subject)} · ${l10n.paperTypeName(paper.paperType)}';
    }
    return '${l10n.subjectName(subject)} · ${l10n.mediumName(medium)}';
  }
}
