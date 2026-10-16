#!/usr/bin/env node
/**
 * Grants the `admin` custom claim to a Firebase Auth user - no npm dependencies.
 *
 * The security rules in `firebase/` only allow writes from users whose ID token
 * carries `admin: true`. This script sets that claim so the web admin panel can
 * upload books and papers.
 *
 * Usage
 * -----
 *   1. Create the admin user once:
 *        Firebase Console → Authentication → Users → Add user
 *        (email + a strong password) → copy the "User UID".
 *   2. Run:
 *        node tools/seed/set_admin_claim.mjs \
 *          --key ~/Downloads/edulanka-firebase-adminsdk-xxxx.json \
 *          --uid  PASTE_USER_UID
 *      Add --remove to revoke the claim again.
 *
 * The user must sign out and back in (or the panel's next token refresh) before
 * the claim is visible to Firestore/Storage.
 */

import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i += 1; }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.key || !args.uid || args.help) {
  console.error(`Usage: node tools/seed/set_admin_claim.mjs --key <service-account.json> --uid <user-uid> [--remove]

  --key     service account JSON (Firebase Console → Project settings → Service accounts)
  --uid     the admin user's UID (Firebase Console → Authentication → Users)
  --remove  revoke the claim instead of granting it
  --project override the project id (default: from the key file)`);
  process.exit(args.help ? 0 : 2);
}

const serviceAccount = JSON.parse(readFileSync(args.key, 'utf8'));
const projectId = args.project || serviceAccount.project_id;
const grant = !args.remove;

const base64url = (input) => Buffer.from(input).toString('base64')
  .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/identitytoolkit '
         + 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signature = base64url(
    createSign('RSA-SHA256').update(`${header}.${payload}`).sign(serviceAccount.private_key),
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${payload}.${signature}`,
    }),
  });
  if (!response.ok) throw new Error(`Token exchange failed: ${await response.text()}`);
  return (await response.json()).access_token;
}

async function main() {
  const token = await getAccessToken();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localId: args.uid,
      // an empty object clears the claim
      customAttributes: grant ? JSON.stringify({ admin: true }) : '{}',
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not update the user (${response.status}): ${await response.text()}`);
  }

  const user = await response.json();
  console.log(grant
    ? `✅ admin claim granted to ${user.email || args.uid}`
    : `✅ admin claim removed from ${user.email || args.uid}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Sign out of the admin panel and sign in again (tokens are cached ~1 h).');
  console.log('  2. Upload a test book — the security rules will now accept the write.');
}

main().catch((error) => {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
});
