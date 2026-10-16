# Firebase setup (free, ~10 minutes)

EduLanka runs **without** Firebase (bundled demo catalogue), so this guide is only
needed when you want your own real catalogue live. Everything here fits in the
Spark (free) plan and **never asks for a billing account**.

---

## 0. Prerequisites

```bash
flutter --version      # 3.27 or newer
npm -v                 # only for the optional firebase-tools / flutterfire CLI
```

The CLI tools are optional — the console walkthrough below is enough.

---

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. Name it e.g. `edulanka`, disable Google Analytics (not needed, keeps it simpler).
3. Wait for provisioning, then open the project.

## 2. Enable the services used

| Service | Where | Settings |
|---|---|---|
| **Firestore** | Build → Firestore Database → *Create database* | Production mode, region `asia-south1` (Mumbai — closest to Sri Lanka) |
| **Storage** | Build → Storage → *Get started* | Production mode, same region |
| **Authentication** *(optional)* | Build → Authentication → *Get started* | Enable **Email/Password** (for the admin panel) and, if you want counters, **Anonymous** |

Firestore and Storage both start in "locked" mode; step 4 installs the rules the
app expects.

## 3. Register the Android app

1. Project overview → **Add app** → Android.
2. **Android package name**: `com.edulanka.app` (must match
   `applicationId` in `app/android/app/build.gradle` — change both if you fork).
3. Download **`google-services.json`** and place it here:

```
app/android/app/google-services.json
```

`app/.gitignore` already excludes it, so your project credentials never get
committed. If you change the package name, also update
`android/app/src/main/kotlin/<package path>/MainActivity.kt` and the `namespace`.

4. Enable the Gradle plugin — open `app/android/app/build.gradle` and uncomment:

```gradle
plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
    id "com.google.gms.google-services"   // ← this line
}
```

> **Why not `firebase_options.dart`?** `Firebase.initializeApp()` with no
> arguments reads `google-services.json` on Android, which needs no code
> generation. If you prefer `flutterfire configure` (it also gives you iOS/web
> support), run it in `app/` and then pass
> `await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);`
> in `lib/main.dart`. The `.gitignore` already excludes the generated file.

## 4. Install the security rules

```bash
npm install -g firebase-tools
cd 1018/firebase
firebase login
firebase use --add              # pick your project, alias "default"
firebase deploy --only firestore:rules,storage
```

Or paste `firebase/firestore.rules` and `firebase/storage.rules` by hand into
**Firestore → Rules** and **Storage → Rules**.

What they do:

* **reads**: public — students never create an account.
* **writes**: only users with the `admin` custom claim (or a UID listed in the
  rules). See `docs/ADMIN_PANEL.md` to grant that claim.
* one deliberate exception: a signed-in user may increment a document's
  `downloads` field, which is what makes the "most downloaded" sort work.
  Delete that block if you prefer a strictly read-only catalogue.

## 5. Load some data

Three options, easiest first:

```bash
# A) the admin web panel (recommended: it also uploads the PDFs)
#    → see docs/ADMIN_PANEL.md

# B) CLI seeder: metadata only, PDFs must already exist at the pdfUrl
node tools/seed/seed_firestore.mjs \
  --key ~/Downloads/edulanka-firebase-adminsdk-xxxx.json \
  --collection books \
  --file app/assets/data/demo_books.json
node tools/seed/seed_firestore.mjs \
  --key ~/Downloads/edulanka-firebase-adminsdk-xxxx.json \
  --collection papers \
  --file app/assets/data/demo_papers.json

# C) Firebase Console → Firestore → Start collection → add documents by hand
```

The document shape the app expects (all fields optional except `title` and
`pdfUrl` — the parser is deliberately forgiving):

```jsonc
// books/{bookId}
{
  "title": "ගණිතය 10 ශ්‍රේණිය",
  "grade": 10,                       // 1..13
  "subject": "Mathematics",          // English key; the app localises it
  "medium": "Sinhala",               // Sinhala | English | Tamil
  "coverUrl": "https://firebasestorage...",   // optional, textbooks only
  "pdfUrl": "https://firebasestorage...",
  "fileSize": "12.5 MB",
  "fileSizeBytes": 13107200,
  "year": 2024,
  "category": "textbook",            // textbook | workbook | syllabus | teachers-guide
  "pages": 220,
  "downloads": 1500,
  "keywords": ["ගණිතය", "mathematics", "grade 10"],
  "timestamp": "<serverTimestamp>"
}

// papers/{paperId}
{
  "title": "2023 O/L Mathematics Paper 1",
  "examType": "OL",                  // OL | AL | Scholarship | TermTest
  "year": 2023,
  "subject": "Mathematics",
  "medium": "Sinhala",
  "paperType": "Paper 1",            // Paper 1 | Paper 2 | MCQ | Essay | Term Test | Marking Scheme
  "hasMarkingScheme": true,
  "grade": 11,                       // term tests only
  "term": 2,                         // term tests only
  "pdfUrl": "https://firebasestorage...",
  "fileSize": "3.2 MB",
  "fileSizeBytes": 3355443,
  "downloads": 800,
  "timestamp": "<serverTimestamp>"
}
```

Upload the PDFs to `pdfs/<id>.pdf` and covers to `covers/<id>.(png|jpg)` in
Storage; the admin panel does this for you and fills in `pdfUrl` automatically.

## 6. Run the app with real data

```bash
cd app
flutter clean
flutter pub get
flutter run
```

Check **Settings → Data source**: it should say *Firebase connected*. If it says
*Offline demo catalogue*, the `google-services.json` step or the Gradle plugin
line above is still missing (the app tells you instead of crashing — by design).

---

## 7. Indexes

**You do not need any.** The app reads each collection ordered by `timestamp`
only (covered by Firestore's automatic single-field indexes), then filters and
paginates on the device — see `docs/ARCHITECTURE.md`. `firebase/firestore.indexes.json`
is therefore intentionally empty; if you later switch to server-side filtering,
put the composite indexes there and deploy with
`firebase deploy --only firestore:indexes`.

---

## 8. Optional: anonymous authentication

Enable **Anonymous** in Authentication, then uncomment the single line in
`app/lib/main.dart`:

```dart
await FirebaseAuth.instance.signInAnonymously();
```

Use it together with a rules change if you want every read to be authenticated:

```
allow read: if request.auth != null;
```

---

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Settings shows *Offline demo catalogue* | `google-services.json` missing, wrong package name, or the Gradle plugin line still commented out. Check `flutter run` logs for the `Firebase not initialised` debug line |
| Empty lists but Firebase connected | Collections are empty, or documents have no `pdfUrl` (the app skips half-created entries) |
| "Access denied" screen | Rules still in locked mode, or the admin claim is missing when the app writes counters — see `docs/ADMIN_PANEL.md` |
| `PERMISSION_DENIED` on upload in the admin panel | The signed-in user has no `admin` claim |
| App feels slow on first launch only | It is downloading the whole catalogue once (~300–500 kB) and caching it for 12 h |
| Everything vanished | You uninstalled the app — favourites/downloads live on the device only. There is no account to restore them from (and that is intentional) |
