# Admin panel (free hosting, no build step)

`admin_web/` is a plain HTML/CSS/JS dashboard — no npm, no bundler, no server. It
uploads PDFs to Firebase Storage, writes the matching Firestore documents, and
gives you counts, edit and delete for everything in the catalogue.

---

## 1. Deploy it (2 minutes)

```bash
npm install -g firebase-tools
cd 1018
firebase login
firebase use --add                              # choose your project
firebase deploy --only hosting                  # serves admin_web/
```

`firebase/firebase.json` already points Hosting at `../admin_web`, so the panel
ends up at `https://<your-project>.web.app`.

**Alternatives that are also free:** GitHub Pages (push `admin_web/` to a `gh-pages`
branch — everything is relative paths), Netlify/Vercel free tier, or Cloudflare
Pages. Any static host works because there is no backend: the browser talks
straight to Firebase.

> Prefer to keep the panel private? Firebase Hosting supports
> `firebase deploy --only hosting` + **Hosting → Access control** is not a thing,
> but you can either (a) leave the URL unshared — the panel needs a Firebase Auth
> login and the `admin` claim to do *anything*, or (b) host it on Cloudflare
> Access / Netlify password protection. The security model is in the rules, not
> in URL secrecy.

## 2. Connect it to your project

Open the panel and click **⚙︎ Setup**, then paste the config object from
*Firebase Console → Project settings → Your apps → Web app → SDK setup and
configuration*. Example:

```json
{
  "apiKey": "AIzaSy...",
  "authDomain": "edulanka.firebaseapp.com",
  "projectId": "edulanka",
  "storageBucket": "edulanka.appspot.com",
  "messagingSenderId": "123456789012",
  "appId": "1:123456789012:web:abcdef123456"
}
```

It is stored in that browser's `localStorage` and never sent anywhere else. (A
Firebase *web* config is public by design — the rules are what protect your data.)
If you would rather hard-code it, edit `admin_web/config.js` and commit that
instead; both work.

## 3. Create the admin user

1. *Firebase Console → Authentication → Users → **Add user*** → email + strong password.
2. Copy the **User UID**.
3. Grant the admin claim:

```bash
node tools/seed/set_admin_claim.mjs \
  --key ~/Downloads/<project>-firebase-adminsdk-xxxx.json \
  --uid PASTE_USER_UID
```

(Service account key: *Project settings → Service accounts → Generate new private
key*. Keep it out of the repo — `.gitignore` already blocks `*-adminsdk-*.json`.)

That user's password **is** the admin password. Without the claim, the rules
reject every write, so a leaked password alone cannot damage the catalogue.

## 4. Sign in

Open the panel → email + password → sign in. The badge turns green
(`signed in · you@example.com`) and the dashboard loads counts plus the table.

## 5. Upload a book or paper

1. **＋ Add entry** (or *Edit* on an existing row).
2. Fill in the fields — the dialog shows only what matters for the active tab:
   * **Books**: title, grade (1–13), subject, medium, category, year, optional cover image
   * **Papers**: title, exam type, year, subject, medium, paper type, term (term tests), "marking scheme available" checkbox
3. Choose the PDF (max 120 MB, PDF only). Cover images are optional and only used
   for textbooks; papers get an auto-generated subject tile in the app.
4. **Save** → the panel uploads to `pdfs/<id>.pdf`, gets the download URL, writes
   the document with `timestamp: serverTimestamp()`, then refreshes the stats and
   the table.

The document id is derived from the title (`2023_o_l_mathematics_paper_1_2023`);
Sinhala/Tamil-only titles fall back to a timestamped id. That id is what the app
uses for favourites, downloads and bookmarks — it never changes once created, so
**editing a title keeps every student's downloads working**.

## 6. Bulk import (whole year of papers in one go)

**⇪ Import JSON** accepts an array in the same shape as
`app/assets/data/demo_books.json`:

```json
[
  {
    "title": "2023 O/L Mathematics Paper 1",
    "examType": "OL", "year": 2023, "subject": "Mathematics", "medium": "Sinhala",
    "paperType": "Paper 1", "hasMarkingScheme": true,
    "pdfUrl": "https://firebasestorage.googleapis.com/.../papers%2F2023ol_p1.pdf?alt=media",
    "fileSize": "3.2 MB", "fileSizeBytes": 3355443
  }
]
```

Rules: max 500 rows per import, `title` + `subject` + `medium` + `pdfUrl` required,
PDFs must already be uploaded. For PDFs in bulk, drag them into the Storage tab or:

```bash
gsutil -m cp -r ./pdfs_from_exam_dept gs://<bucket>/pdfs
```

Then use `tools/seed/seed_firestore.mjs --pdf-base` to generate the download URLs
while seeding (metadata-only, no npm install needed).

## 7. Editing and deleting

* **Edit** — change any field, optionally replace the PDF or cover. Leave the file
  picker empty to keep the current file.
* **Delete** — removes the Firestore document **and** the Storage objects, after a
  confirmation. Entries a student has downloaded remain readable on their phone
  (that is expected — offline copies are the point).

## 8. Stats

The dashboard header shows total books, total papers, lifetime downloads
(sum of the `downloads` field), catalogue size (sum of `fileSizeBytes`) and the
most recent upload. Stats are computed by scanning up to 5 000 documents with the
client SDK - that costs free-tier reads but needs no Cloud Function, keeping the
project on the Spark plan (no billing account).

## 9. Demo mode

Open the panel without a Firebase config (or tick *Demo mode* in Setup) and it
runs against the bundled demo JSON with the same UI: add, edit, delete and import
all work in memory, so you can rehearse a full upload session before touching real
data.

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| *Permission denied* on save | `admin` claim missing → run `set_admin_claim.mjs`, then sign out/in |
| Badge stuck on *connecting…* | Wrong `apiKey`/`projectId` in Setup, or the project has no Web app registered |
| Table empty but the app shows data | You are on the wrong project, or the rows were seeded into different collection names |
| Upload fails at 100 % | Storage rules rejected it: check MIME type (`application/pdf`) and the 120 MB limit |
| Stats say "Stats unavailable" | Firestore rules block reads — they should be `allow read: if true` |
