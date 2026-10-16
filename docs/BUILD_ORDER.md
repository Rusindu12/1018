# Build order → what was actually implemented

The project was requested as "give me the folder structure first, then code file by
file, in 11 steps". This is the map from those steps to the files that implement
them, so you can review the work in the same order.

| Step | Deliverable | Where it lives |
|---|---|---|
| **1** | **Flutter project setup + Firebase integration** | `app/pubspec.yaml`, `app/analysis_options.yaml`, `app/android/**` (Gradle, manifest, launcher icons), `app/lib/main.dart` (prefs → optional Firebase → run), `app/lib/core/config/app_config.dart`, `firebase/firestore.rules`, `firebase/storage.rules`, `docs/FIREBASE_SETUP.md` |
| **2** | **Home screen + bottom navigation** | `app/lib/features/home/home_page.dart`, `app/lib/features/home/app_shell.dart`, `app/lib/core/providers/ui_providers.dart`, `app/lib/core/router/app_router.dart`, `app/lib/features/splash/splash_page.dart` |
| **3** | **Books page with data fetching** | `app/lib/features/books/books_page.dart`, `.../widgets/book_card.dart`, `.../widgets/book_filters_sheet.dart`, `.../providers/books_providers.dart`, `app/lib/data/**` (models, sources, repository) |
| **4** | **PDF viewer** | `app/lib/features/viewer/pdf_viewer_page.dart` (+ `docs/PDF_VIEWER.md`) |
| **5** | **Past papers page with filters** | `app/lib/features/papers/papers_page.dart`, `.../widgets/paper_tile.dart`, `.../widgets/paper_filters_sheet.dart`, `.../providers/papers_providers.dart` |
| **6** | **Download & offline storage** | `app/lib/data/repositories/download_repository.dart`, `app/lib/data/sources/downloads_store.dart`, `app/lib/features/downloads/downloads_page.dart`, `app/lib/core/providers/library_providers.dart` (`DownloadsController`, `DownloadManager`) |
| **7** | **Favorites / bookmarks** | `app/lib/data/sources/favorites_store.dart`, `favorites_store` + `bookmarks_store.dart`, `app/lib/features/favorites/favorites_page.dart`, `app/lib/shared/widgets/favorite_button.dart` |
| **8** | **Search** | `app/lib/features/search/search_page.dart`, `.../providers/search_providers.dart`, `CatalogRepository.search()` (Sinhala/Tamil/English matching) |
| **9** | **Settings (dark mode, language)** | `app/lib/features/settings/settings_page.dart`, `about_page.dart`, `privacy_policy_page.dart`, `app/lib/core/theme/app_theme.dart`, `app/lib/l10n/app_localizations.dart`, `app/lib/data/sources/settings_store.dart` |
| **10** | **Admin web panel** | `admin_web/index.html`, `app.js`, `config.js`, `styles.css`, `tools/seed/seed_firestore.mjs`, `tools/seed/set_admin_claim.mjs`, `docs/ADMIN_PANEL.md` |
| **11** | **Testing + APK build** | `app/test/**` (14 suites), `tools/verify_project.py`, `.github/workflows/ci.yml`, `docs/BUILD_AND_RELEASE.md` |

## Extras that were added on top of the 11 steps

| Extra | Why |
|---|---|
| **Demo mode** (`AppConfig.demoMode`) | The app must run before Firebase exists. It ships a 425-row demo catalogue plus a 6-page sample PDF, so a fresh clone (or an offline phone) shows a complete, filterable app. |
| **Bulk read + local filtering** (`docs/ARCHITECTURE.md`) | Removes the need for ~100 composite Firestore indexes and makes trilingual substring search possible on the free tier. |
| **`tools/verify_project.py`** | Static checks that run without a Dart SDK: imports, unused imports, string-table integrity, provider wiring, asset/JSON/PDF/PNG validation, Android runner, admin-panel DOM ids. Used by CI. |
| **Generated icon set** (`tools/seed/generate_icons.py`) | The launcher icon, in-app logo and Play Store icon are reproducible from code instead of being opaque binaries. |
| **`CoverCacheManager`** | Dedicated cover cache so "clear cache" is precise and covers cost bandwidth only once. |
| **Offline banner + connectivity provider** | Downloads keep working with no network; the UI explains the state instead of showing errors. |
