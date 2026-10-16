# Contributing

Thanks for helping Sri Lankan students. Everything here is designed to stay free,
offline-friendly and simple enough for a volunteer to maintain.

## Getting set up

```bash
git clone https://github.com/Rusindu12/1018.git
cd 1018/app
flutter pub get
flutter test          # must be green before and after your change
flutter run           # demo mode: no Firebase setup needed
```

## Code style

* `flutter analyze` must report **0 issues** (the repo ships a strict
  `analysis_options.yaml`).
* Format with `dart format lib test`.
* Comments explain **why**, not what — see `catalog_remote_source.dart` for the
  tone the codebase aims for.
* No `// TODO` markers in merged code: either do it, or describe it in an issue.
* Every user-visible string goes through `AppLocalizations`. A PR that hardcodes
  English text in a widget will be asked to move it into the string table — for all
  three languages.

## Common tasks

### Add a new subject or exam type

1. `app/lib/core/constants/catalog_constants.dart` — add it to the relevant list.
2. `app/lib/l10n/catalog_names.dart` — add a `['සිංහල', 'தமிழ்']` row so it displays
   translated (skip this and it shows in English, which is intentionally allowed).
3. `admin_web/config.js` — add it to `CONSTANTS` so the admin dropdown matches.
4. `tools/seed/generate_demo_data.py` — add it to the demo catalogue and run
   `python3 tools/seed/generate_demo_data.py`.

### Add a UI string

1. Add a row to `_table` in `app/lib/l10n/app_localizations.dart` with all three
   translations, plus a typed getter right below.
2. Use `context.l10n.yourNewGetter` — never a literal.
3. `flutter test test/l10n` verifies the table has no missing entries.

### Add a language (e.g. French)

1. Add a value to `AppLanguage` with its native label and ISO code.
2. Add a fourth column to every row of `_table` (and to `catalog_names.dart`).
3. If any row is empty the English string is shown — a partially translated
   language is a valid starting point, so submit it even if incomplete.

### Add a screen

1. `app/lib/features/<name>/<name>_page.dart` for the page.
2. Providers next to it (`providers/`) if it needs state; repositories/services go
   in `app/lib/data/`.
3. Register the route in `app/lib/core/router/app_router.dart` (routes live in one
   place on purpose).
4. Add a widget test under `app/test/widget/`.

## Data-layer rules

* Widgets must not import `cloud_firestore`, `dio` or `dart:io` — go through a
  repository, otherwise demo mode and the tests break.
* Anything thrown must be normalised with `AppException.from(...)`.
* New local state goes into a `*Store` under `data/sources/` and is exercised by
  `test/data/local_stores_test.dart`.

## Pull requests

Before opening one:

```bash
cd app
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

Then in the PR description: what changed, why, and which screens/languages you
tested. Screenshots help a lot for UI changes.

## Content contributions (books, papers, translations)

* **Papers/books**: open an issue with the source and licence of the file. Only
  material that is freely distributable for students can be hosted; the repo
  indexes links, it does not claim ownership.
* **Translations**: the three language columns in `app_localizations.dart` are the
  place — small, reviewable PRs are easiest to merge.
* **Takedowns**: if you own a file that should not be listed, email the address in
  `AppConfig.contactEmail` and it will be removed.
