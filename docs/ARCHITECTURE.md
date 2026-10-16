# Architecture

```
UI (features/)  ──watches──▶  Providers (core/providers)  ──calls──▶  Repositories
                                                                        │
                                              ┌─────────────────────────┴───────────────────┐
                                     Remote sources                        Local sources
                                Firestore / Storage / HTTP        SharedPreferences / files / assets
```

Three rules keep the codebase predictable:

1. **Widgets never touch Firestore, Dio or the file system.** They read providers
   and call controller methods. That is why switching to demo mode, offline mode
   or a different backend later is a one-line change in the provider layer.
2. **One error type.** Every failure that can reach the UI is normalised into
   `AppException` (`core/errors/app_exception.dart`) with a `kind` that maps 1:1 to
   a translated message and an icon.
3. **Offline is the default, not a special case.** Favourites, bookmarks,
   downloads, settings and the catalogue cache are all readable without network,
   and the PDF viewer *always* renders a local file.

---

## Layers

### `data/models`
`CatalogItem` is the shared interface implemented by `BookModel` and `PaperModel`.
It carries the optional metadata each side may have (`grade`, `year`, `examType`,
`paperType`, `category`) as nullable getters, so **one widget can render either
type** — that is what makes Search, Favorites and Downloads work on mixed lists.

`fromMap` is deliberately defensive (`ParseUtils`): documents are created by hand
in the admin panel, so `grade` may arrive as `10`, `"10"`, `"Grade 10"` or be
missing entirely. Nothing crashes; the model fills in defaults.

### `data/sources`
| Source | Responsibility |
|---|---|
| `CatalogRemoteSource` | the only Firestore code in the app |
| `CatalogLocalSource` | the bundled demo catalogue + the sample PDF asset |
| `LocalStore` | typed wrapper over `SharedPreferences` (opened once in `main()`) |
| `FavoritesStore`, `DownloadsStore`, `BookmarksStore`, `SearchHistoryStore`, `SettingsStore` | small, testable JSON-backed stores |

### `data/repositories`
`CatalogRepository` answers every UI question — page N of the filtered books, the
search results, the years that actually exist — and hides *how*: memory cache →
disk cache → network/demo assets. `DownloadRepository` owns the whole
download → verify → index → delete lifecycle of a PDF.

### `core/providers`
| Provider | Purpose |
|---|---|
| `localStoreProvider` | the single override in `main()` |
| `catalogRepositoryProvider`, `downloadRepositoryProvider` | services |
| `settingsProvider` | theme mode + UI language |
| `connectivityProvider` / `isOnlineProvider` | offline banner, retry logic |
| `booksFilterProvider` + `booksProvider` | Books tab state + paged list |
| `papersFilterProvider` + `papersProvider` + `availableYearsProvider` | Past Papers |
| `searchQueryProvider`, `searchScopeProvider`, `searchResultsProvider` | debounced search |
| `favoritesProvider`, `bookmarksProvider`, `downloadsProvider`, `downloadManagerProvider`, `searchHistoryProvider` | the user's own library |
| `selectedTabProvider`, `viewerNightModeProvider` | pure UI state |

Paging is implemented once in `PagedCatalogController`: subclasses declare what to
watch (`watchInputs`) and how to fetch a page (`fetchPage`), and they get
first-page loading, append-with-deduplication, footer retry state and refresh for
free.

---

## Why the catalogue is fetched in bulk and filtered on the device

The obvious design is one Firestore query per filter combination:

```dart
// NOT what EduLanka does
query.where('grade', isEqualTo: 10)
     .where('medium', isEqualTo: 'Sinhala')
     .where('subject', isEqualTo: 'Mathematics')
     .orderBy('timestamp', descending: true)
```

Every combination of that — 13 grades × 3 mediums × ~35 subjects × 4 sort orders,
plus the search variations — needs its own **composite index**, and Firestore
refuses to run the query until an operator clicks through the generated
"create index" link. For a volunteer-run free app that is a support nightmare.

Instead:

1. `CatalogRemoteSource` streams each collection ordered by `timestamp`
   (single-field index, automatic, no setup) in chunks of 300 documents.
2. The result is cached **in memory** for the session and **on disk** for 12 hours
   (`AppConfig.catalogCacheTtl`).
3. `CatalogRepository` filters, sorts, searches and paginates locally.

Cost: one read per document per device per 12 h — a few hundred reads. Well inside
the 50 000/day free tier even with thousands of students, and no index setup.

Bonus: searching Sinhala (`ගණිතය`), Tamil (`கணிதம்`) and English in one field works
with no paid search service, because the app is matching against a real string
list rather than Firestore's prefix-only `where` (which cannot do substring or
diacritic-tolerant matching at all).

**When to outgrow this:** if the catalogue passes ~5 000 documents (roughly 1–2 MB
of metadata), switch `CatalogRemoteSource` to server-side filtering with composite
indexes (`firebase/firestore.indexes.json` exists for exactly that) and Algolia's
free tier or Typesense Cloud for search. The repository interface does not change,
so nothing above the data layer is touched.

---

## Offline strategy in detail

| Concern | Approach |
|---|---|
| Favourites / bookmarks / history / settings | `SharedPreferences` JSON, written immediately, read synchronously |
| Catalogue metadata | in-memory → disk cache (12 h) → network → stale disk → bundled demo |
| PDFs | downloaded into `documents/edulanka_downloads/<type>_<id>.pdf`, verified by the `%PDF-` header, then indexed |
| Missing file | `DownloadsController` reconciles the index with the file system on every load, so the UI never offers a file that is gone |
| Partial download | `deleteOnError: true` plus an explicit delete on any failure — a truncated PDF never reaches the index |
| No network at all | banner instead of an error, catalogue from cache, downloads still open |
| Old cache + no network | stale cache is served rather than an error screen |

---

## Error handling

`AppException.from()` maps Firestore codes, Dio failures and `FileSystemException`s
into `AppErrorKind`: `network`, `notFound`, `permission`, `storage`,
`corruptFile`, `missingIndex`, `cancelled`, `unknown`. Each kind has a translated
title + hint + icon (`ErrorStateView`), an inline compact mode for list footers,
and a `retryable` flag that decides whether a *Try again* button appears. In debug
builds the raw technical detail is available behind an expandable section, and it
is never shown in release builds.

## Internationalisation

* `AppLanguage` (si/en/ta) is persisted; `null` means "follow the device".
* `AppLocalizations` holds every UI string in a single table plus typed getters —
  no code generation, so the project builds with a plain `flutter pub get`.
* `catalog_names.dart` translates catalogue *values* (`Mathematics` → `ගණිතය`,
  `Marking Scheme` → `පිළිතුරු පත්‍රිකාව`) while unknown values pass through
  unchanged, so an admin can add a new subject without waiting for a release.
* `characters` is used for initials/avatars so Sinhala and Tamil grapheme clusters
  are never cut in half.

## Theming

One seed colour (`AppTheme.seed`) produces both light and dark Material 3 schemes.
Card styling lives in `AppTheme.cardDecoration` + `AppCard` on purpose: `CardTheme`
changed type across recent Flutter releases, and keeping it in the app means the
project builds across versions and looks consistent everywhere.
