# EduLanka 📚🇱🇰

**Free school books and past papers for every Sri Lankan student.**
No ads, no in-app purchases, no sign-up — an open source Flutter app plus a
zero-cost Firebase backend and a web admin panel.

```
📱 Flutter 3.x (Android APK)   ☁️ Firebase Spark plan (free)   🖥️ Vanilla-JS admin panel
```

| | |
|---|---|
| **App** | `app/` — Flutter app (Dart), Riverpod, Material 3, si / en / ta |
| **Admin** | `admin_web/` — static HTML/JS dashboard, hosted free on Firebase Hosting |
| **Backend** | Firestore (metadata) + Firebase Storage (PDFs) + optional anonymous Auth |
| **Cost** | **$0** — every service used sits inside the free tier (see the table below) |
| **Size** | APK well under the 30 MB budget (PDFs are streamed/streamed-then-cached, never bundled) |

---

## ✨ What is in the app

| Screen | What it does |
|---|---|
| **Splash** | Logo, 2 s brand moment, and it warms the catalogue so Home is never empty |
| **Home** | Search bar, the four sections (Books · Papers · Favorites · Downloads), grade 1–13 shortcuts, exam shortcuts, live counters, "recently added" rail |
| **Books** | Grade · Medium · Subject · Type filters + sort, cover grid, file size, favourite + download buttons, 20-per-page infinite scroll |
| **Past Papers** | Tabs for **O/L · A/L · Grade 5 Scholarship · Term tests**, filters for year (2015–2024), subject, medium and paper type, "marking scheme available" badge |
| **PDF viewer** | Full-screen reader, pinch-zoom, page bookmarking, share (WhatsApp/Gmail/…), save for offline, night mode, jump-to-bookmark |
| **Favorites** | Books *and* papers in one list, swipe to remove with undo |
| **Downloads** | Offline PDFs, real on-disk sizes, page counts, storage total, delete one / delete all |
| **Search** | Trilingual (සිංහල / English / தமிழ்) full-text search over both collections, recent searches, scope chips |
| **Settings** | Light/dark/system theme, UI language, clear image cache, reset app data, refresh catalogue, about, privacy policy, licences |

**Trilingual everywhere.** Titles the admin uploads are shown verbatim (they are
written in the medium of the book), while every *interface* string, filter label,
subject name, grade label and error message is translated in
`app/lib/l10n/app_localizations.dart` and `app/lib/l10n/catalog_names.dart`.

---

## 🚀 Quick start (10 minutes)

```bash
git clone https://github.com/Rusindu12/1018.git
cd 1018/app

flutter --version          # needs Flutter 3.27+ (3.19+ works if you update the SDK constraint)
flutter pub get
flutter run                # ← runs immediately in DEMO MODE
```

**You do not need Firebase to see the app working.** On first run EduLanka
detects that no project is configured and serves the bundled demo catalogue
(`app/assets/data/demo_books.json`, `demo_papers.json` — 237 books, 188 papers,
every grade 1–13, all three mediums, years 2018–2024). Every PDF URL points at a
bundled sample PDF, so downloading, offline reading, bookmarks and the viewer can
all be tested with the phone in flight mode.

To connect your own Firebase project (still free):

```bash
# 1. create a project at https://console.firebase.google.com  (Spark plan)
# 2. follow docs/FIREBASE_SETUP.md  (5 steps, ~10 minutes)
# 3. put google-services.json into app/android/app/ and uncomment the
#    google-services plugin line in app/android/app/build.gradle
flutter run                # ← now reads Firestore
```

Build the APK:

```bash
cd app
flutter build apk --release --split-per-abi     # ~7 MB per ABI
flutter build apk --release                     # single universal APK
```

---

## 📁 Folder structure

```
1018/
├── app/                                  # the Flutter application
│   ├── pubspec.yaml
│   ├── assets/
│   │   ├── data/          demo_books.json, demo_papers.json   (bundled demo catalogue)
│   │   ├── images/        logo.png, app_icon.png
│   │   └── sample/        sample_paper.pdf                    (offline smoke test)
│   ├── android/                          # Gradle + manifest + generated launcher icons
│   ├── lib/
│   │   ├── main.dart                     # bootstrap: prefs → Firebase (optional) → app
│   │   ├── app.dart                      # MaterialApp: themes, locales, routes
│   │   ├── core/
│   │   │   ├── config/app_config.dart     # every tunable + demo-mode switch
│   │   │   ├── constants/                 # grades, mediums, subjects, exam types
│   │   │   ├── errors/app_exception.dart  # one error type for the whole UI
│   │   │   ├── providers/                 # Riverpod: infra, library, paging, settings
│   │   │   ├── router/app_router.dart     # named routes + typed push helpers
│   │   │   ├── theme/app_theme.dart       # Material 3 light + dark, brand colours
│   │   │   └── utils/                     # file sizes, dates, parsing, debouncer
│   │   ├── data/
│   │   │   ├── models/                    # BookModel, PaperModel, CatalogItem, filters
│   │   │   ├── sources/                   # Firestore, assets, SharedPreferences stores
│   │   │   └── repositories/              # CatalogRepository, DownloadRepository
│   │   ├── features/                      # one folder per screen (page + widgets + providers)
│   │   │   ├── splash/ home/ books/ papers/ viewer/ favorites/ downloads/ settings/ search/
│   │   └── l10n/                          # trilingual strings + catalogue-name translations
│   └── test/                              # unit + widget tests (run offline, no Firebase)
├── admin_web/                             # admin dashboard (HTML/CSS/JS, no build step)
├── firebase/                              # firestore.rules, storage.rules, hosting config
├── tools/seed/                            # demo-data generator, Firestore seeder, icons
└── docs/                                  # setup, admin, architecture, release guides
```

---

## 💸 How this stays free

| Service | Free tier (Spark) | What EduLanka uses |
|---|---|---|
| Firestore (reads) | 50 000 / day | One catalogue read per device per 12 h (cached in memory **and** on disk), so a few thousand students cost nothing |
| Firestore (writes) | 20 000 / day | Only the admin panel + an optional anonymous download counter |
| Firestore (storage) | 1 GiB | ~1–2 k tiny metadata documents (a few hundred kB) |
| Firebase Storage | 5 GB stored, 1 GB/day egress | The PDFs. 1 GB/day ≈ 300 textbook downloads — add Cloudflare in front of a public bucket (documented) if you exceed it |
| Firebase Hosting | 10 GB/month | The admin panel (a ~50 KB static site) |
| Firebase Auth | Unlimited for email/password | One admin user (faculty accounts are optional) |
| Cloud Functions | ✗ not used | Everything client-side, so no billing account is required at all |

Because the catalogue is read in bulk and filtered on the device, EduLanka needs
**zero composite Firestore indexes** — see `docs/ARCHITECTURE.md` for why that
matters and how to switch to server-side filtering if the catalogue ever grows
past a few thousand documents.

---

## 🧪 Tests

```bash
cd app
flutter analyze
flutter test            # 100+ assertions, no network, no Firebase needed
```

The suite covers model parsing (including messy admin documents), filters and
search in all three scripts, the local stores (favourites, downloads, bookmarks,
history, settings), the repository paging/caching layer, the demo catalogue's
integrity, the trilingual string table, and widget smoke tests that boot the whole
app on the bundled catalogue.

---

## 📖 Documentation

| Guide | Contents |
|---|---|
| `docs/FIREBASE_SETUP.md` | Create the project, Firestore, Storage, rules, `google-services.json`, first data |
| `docs/ADMIN_PANEL.md` | Deploy the panel, create the admin user + `admin` claim, upload PDFs, bulk import |
| `docs/ARCHITECTURE.md` | Layers, providers, offline strategy, why bulk-read + local filter, error handling |
| `docs/PDF_VIEWER.md` | Viewer design, night mode reality check, Syncfusion alternative |
| `docs/BUILD_AND_RELEASE.md` | Signing, split APKs, Play Store checklist, optional iOS/web |
| `docs/CONTRIBUTING.md` | Add a subject, a language, a screen; code style; PR checklist |
| `docs/BUILD_ORDER.md` | Map from the 11 requested build steps to the files that implement them |

---

## 🗺️ Roadmap ideas (all still $0)

- Term-test papers scraped/curated per district school
- Teacher guides + syllabus documents (models already support `category`)
- Push notifications for new papers (FCM free tier)
- Study progress / "papers I have attempted" local tracking
- Offline-first SyncFirestore-style multi-device favourites

---

## ⚖️ Licence & content

Code: **Apache-2.0** (see `LICENSE`).
Textbook and past-paper PDFs remain the property of their respective owners
(Educational Publications Department, Department of Examinations, publishers).
EduLanka indexes links to material that is distributed freely for students —
verify you have the right to host any file before uploading it, and add a takedown
contact in `AppConfig.contactEmail`.
