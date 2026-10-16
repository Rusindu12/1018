# PDF viewer

`lib/features/viewer/pdf_viewer_page.dart` is the only place in the app that knows
a PDF is involved.

## Which plugin, and why

| Plugin | Licence | Verdict |
|---|---|---|
| **`flutter_pdfview`** | MIT | ✅ used — renders with the OS PDF engine through a platform view, so the APK stays small and 200-page textbooks scroll smoothly on low-end phones |
| `syncfusion_flutter_pdfviewer` | Free community licence, but the licence must be registered and it **forbids** some commercial uses | Optional; a drop-in alternative, see below |
| `pdfx` | MIT | Fine too, but it bundles extra native code and has had more platform-view quirks on Android 14 |
| `webview_flutter` + Google Docs viewer | free | ✗ needs internet *and* fails for Firebase Storage URLs with query strings |

Trade-offs of `flutter_pdfview` worth knowing:

* It renders a **native platform view**, so Dart cannot wrap it in a
  `ColorFiltered`/`ShaderMask`. That is why night mode dims the page and switches
  the surrounding chrome instead of truly inverting the PDF canvas.
* Text selection/copy is not supported (Flutter cannot talk to the native page).
* Zoom, pan, swipe-to-turn-page and bookmark-driven `setPage()` all work.

## Design: always render a local file

The viewer never streams a remote PDF into the platform view. Instead:

1. a path from the Downloads index, or a path passed by the caller, is used
   directly — **instant open, zero network**;
2. otherwise the file is fetched first, with visible progress
   (`_DownloadProgressView`), and then opened.

This gives three wins: smooth reading on 3G, no partial-page rendering bugs, and
"offline" stops being a separate code path.

## Features

| Feature | Implementation |
|---|---|
| Pinch zoom / pan | native engine (`enableSwipe`, `fitEachPage`) |
| Fit width toggle | `FitPolicy.WIDTH` ⇄ `FitPolicy.BOTH` via `setState` |
| Page counter | `onRender` gives the page count, `onPageChanged` tracks position; both are written to the Download index so the Downloads list shows "220 p" without reopening the file |
| Bookmark page | `bookmarksProvider` (local, per item, 1-based pages), shown as a bottom sheet with jump-to-page |
| Share | `share_plus`: the file itself when it is downloaded, otherwise a text link (WhatsApp, Gmail, Drive, …) |
| Save for offline | the same `DownloadManager` the list screens use, with progress + cancel |
| Night mode | stored in `viewerNightModeProvider` (separate from the app theme) and dims the page + recolours the chrome |
| Delete/corrupt recovery | `onError` and the `%PDF-` header check produce the "file could not be read" state with a re-download action |

## Swapping in Syncfusion

```bash
flutter pub add syncfusion_flutter_pdfviewer
```

then replace the `PDFView(...)` widget with:

```dart
SfPdfViewer.file(
  File(path),
  controller: _syncfusionController,
  canShowScrollHead: false,
  nightMode: nightMode,                    // real inversion, unlike the platform view
  onPageChanged: (PdfPageChangedDetails details) { /* same state updates */ },
  onDocumentLoaded: (PdfDocumentLoadedDetails details) {
    setState(() => _totalPages = details.document.pages.count);
  },
)
```

Everything else (downloads, bookmarks, share, night mode state) is unchanged
because it lives outside the widget. Register the free community licence at app
startup if you go this route.

## Why night mode is a dim, not an inversion

On Android a platform view is composited by the OS *after* Flutter's rendering, so
Dart-side colour matrices cannot affect it. Options considered:

1. dim overlay (chosen) — instant, no extra memory, keeps photos/diagrams intact;
2. re-render pages as bitmaps and filter them — perfect black-and-white inversion
   but 5–10× the memory and a visible delay per page;
3. Syncfusion's native `nightMode` — best result, at the cost of the licence above.

`AppTheme.nightModeMatrix` is kept in the codebase for option 2 or for a future
Flutter-side renderer, and the docs say plainly which one ships.
