#!/usr/bin/env node
/**
 * Publish a catalogue JSON file to Firestore - no npm dependencies.
 *
 * Uses the Firestore REST API with a service-account access token, so it runs
 * on any machine with Node 18+ and nothing else installed (no `npm install`, no
 * gcloud, no firebase-tools).
 *
 * Usage
 * -----
 *   1. Firebase Console → Project settings → Service accounts →
 *      "Generate new private key"  →  saves a JSON file.
 *   2. node tools/seed/seed_firestore.mjs \
 *        --key ~/Downloads/my-project-firebase-adminsdk.json \
 *        --project my-project \
 *        --collection books \
 *        --file app/assets/data/demo_books.json
 *
 * Flags
 *   --key         service account JSON (required)
 *   --project     Firebase project id (defaults to project_id in the key file)
 *   --collection  books | papers (required)
 *   --file        JSON array of documents (required)
 *   --id-field    field used as the document id (default: "id", else a slug of "title")
 *   --pdf-base    prefix added to relative pdfUrl values, e.g.
 *                 "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/pdfs%2F"
 *                 (the bundled demo rows use `asset:sample/sample_paper.pdf`)
 *   --dry-run     print what would be written, without calling the API
 *
 * Notes
 * -----
 *   • Firestore charges 1 write per document; a 400-row catalogue costs 400 of
 *     the Spark plan's 20k daily writes - a single seed run is effectively free.
 *   • Uploading the PDFs themselves is done either with the admin web panel or
 *     with `gsutil -m cp -r ./pdfs gs://<bucket>/pdfs` (gsutil comes with the
 *     Google Cloud SDK; the Firebase Storage "Files" tab also accepts drag&drop).
 */

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// --------------------------------------------------------------------- args
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.key || !args.collection || !args.file) {
  console.error(`Missing arguments.

Usage: node tools/seed/seed_firestore.mjs --key <service-account.json> \\
         --project <project-id> --collection <books|papers> --file <catalogue.json>

Run with --help for the full list of options.`);
  process.exit(2);
}

if (args.help) {
  console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0]);
  process.exit(0);
}

const collection = args.collection;
if (!['books', 'papers'].includes(collection)) {
  console.error(`--collection must be "books" or "papers" (got "${collection}")`);
  process.exit(2);
}

const serviceAccount = JSON.parse(readFileSync(args.key, 'utf8'));
const projectId = args.project || serviceAccount.project_id;
const pdfBase = typeof args['pdf-base'] === 'string' ? args['pdf-base'] : '';
const idField = typeof args['id-field'] === 'string' ? args['id-field'] : 'id';

// ------------------------------------------------------------------ helpers
const base64url = (input) => Buffer.from(input).toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = base64url(
    createSign('RSA-SHA256').update(`${header}.${payload}`).sign(serviceAccount.private_key),
  );
  const assertion = `${header}.${payload}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed (${response.status}): ${await response.text()}`);
  }
  const json = await response.json();
  return json.access_token;
}

/** Converts a JS value into the Firestore REST "Value" shape. */
function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    Object.entries(value).forEach(([key, entry]) => { fields[key] = toFirestoreValue(entry); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function slugify(title, fallback) {
  const slug = String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  // Sinhala/Tamil-only titles produce an empty slug: fall back to the index so
  // ids stay unique and stable for a given run of this script.
  return slug || `entry_${fallback}`;
}

async function commitDocuments(accessToken, documents) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}`
    + '/databases/(default)/documents:commit';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ writes: documents }),
  });
  if (!response.ok) {
    throw new Error(`Firestore commit failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

// --------------------------------------------------------------------- main
async function main() {
  const rows = JSON.parse(readFileSync(args.file, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`${args.file} must contain a non-empty JSON array`);
  }

  console.log(`Project     : ${projectId}`);
  console.log(`Collection  : ${collection}`);
  console.log(`Source file : ${basename(args.file)} (${rows.length} rows)`);
  console.log(`Service acct: ${serviceAccount.client_email}`);
  console.log('');

  const writes = rows.map((row, index) => {
    const id = String(row[idField] || slugify(row.title, index));
    const fields = {};
    Object.entries(row).forEach(([key, value]) => {
      if (key === 'id' || value === undefined) return;
      fields[key] = toFirestoreValue(value);
    });

    if (typeof fields.pdfUrl === 'undefined') throw new Error(`row ${index + 1} has no pdfUrl`);
    // A relative pdfUrl gets the storage prefix, so the demo assets can be
    // published without editing every row.
    if (pdfBase && fields.pdfUrl.stringValue && !/^https?:|^asset:/.test(fields.pdfUrl.stringValue)) {
      fields.pdfUrl = { stringValue: `${pdfBase}${encodeURIComponent(fields.pdfUrl.stringValue)}?alt=media` };
    }
    if (!fields.fileSize && !fields.fileSizeBytes) {
      console.warn(`row ${index + 1} has no fileSize - the app will show "—"`);
    }
    fields.downloads = fields.downloads || { integerValue: '0' };
    fields.keywords = fields.keywords || {
      arrayValue: {
        values: [row.title, row.subject, row.medium, row.grade ? `grade ${row.grade}` : null]
          .filter(Boolean)
          .map((value) => ({ stringValue: String(value).toLowerCase() })),
      },
    };

    return {
      update: {
        name: `projects/${projectId}/databases/(default)/documents/${collection}/${id}`,
        fields,
      },
    };
  });

  if (args['dry-run']) {
    console.log('Dry run - first two writes:');
    console.log(JSON.stringify(writes.slice(0, 2), null, 2));
    console.log(`Would write ${writes.length} documents to ${collection}.`);
    return;
  }

  const token = await getAccessToken();

  // The commit endpoint accepts 500 writes per request; batch the rest.
  const BATCH = 450;
  let written = 0;
  for (let start = 0; start < writes.length; start += BATCH) {
    const batch = writes.slice(start, start + BATCH);
    await commitDocuments(token, batch);
    written += batch.length;
    console.log(`  written ${written}/${writes.length}`);
  }

  console.log('');
  console.log(`Done. ${written} documents are live in "${collection}".`);
  console.log('Open the app (or pull-to-refresh) to see them, and remember that the');
  console.log('PDFs themselves must exist at the pdfUrl you seeded.');
}

main().catch((error) => {
  console.error('');
  console.error(`Failed: ${error.message}`);
  process.exit(1);
});
