/**
 * EduLanka Admin panel
 *
 * Zero build step: this file is plain ES modules loaded from the Firebase CDN,
 * so `firebase deploy --only hosting` (or GitHub Pages, or even opening the
 * folder locally) is the whole deployment story.
 *
 * What it does:
 *   • sign-in with a Firebase Auth admin user (email + password)
 *   • upload PDFs (and optional covers) to Storage, metadata to Firestore
 *   • edit / delete entries, with the Storage file cleaned up too
 *   • catalogue stats: counts, downloads, storage used, last upload
 *   • bulk JSON import for a whole year's papers in one go
 *
 * Every write goes through the security rules in `firebase/`, which only allow
 * admins (custom claim or UID allow-list) to create/update/delete documents.
 */

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, limit, startAfter, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

import {
  effectiveConfig, isConfigured, COLLECTIONS, STORAGE, CONSTANTS,
  STORAGE_KEY, DEMO_KEY, adminUids,
} from './config.js';

const PAGE_SIZE = 50;      // rows per Firestore page in the table
const MAX_SCAN = 5000;     // safety cap when computing stats

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const state = {
  app: null,
  auth: null,
  db: null,
  storage: null,
  user: null,
  demo: false,
  tab: 'books',
  docs: [],           // currently loaded documents of the active tab
  cursor: null,       // Firestore pagination cursor
  hasMore: false,
  search: '',
  medium: '',
  writing: false,
  demoData: { books: [], papers: [] },
};

// ---------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  children.forEach((child) => node.append(child));
  return node;
};

function toast(message, isError = false) {
  const node = $('toast');
  node.textContent = message;
  node.className = isError ? 'toast error' : 'toast';
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, isError ? 6000 : 3200);
}

function showError(id, message) {
  const node = $(id);
  if (!message) { node.hidden = true; return; }
  node.textContent = message;
  node.hidden = false;
}

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value || 0);

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  fillDropdowns();

  const config = effectiveConfig();
  state.demo = localStorage.getItem(DEMO_KEY) === '1' || !isConfigured(config);
  $('demoModeToggle').checked = state.demo;
  $('settingsBtn').addEventListener('click', toggleSetup);
  $('saveConfigBtn').addEventListener('click', saveConfig);
  $('clearConfigBtn').addEventListener('click', clearConfig);
  $('demoModeToggle').addEventListener('change', (event) => {
    localStorage.setItem(DEMO_KEY, event.target.checked ? '1' : '0');
    location.reload();
  });

  if (!isConfigured(config)) {
    $('setupCard').hidden = false;
  } else {
    $('projectLine').textContent = config.projectId;
  }

  if (state.demo) {
    setBadge('Demo mode · sample data', 'badge-warn');
    await loadDemoData();
    showDashboard();
    return;
  }

  try {
    state.app = initializeApp(config);
    state.auth = getAuth(state.app);
    state.db = getFirestore(state.app);
    state.storage = getStorage(state.app);
    setBadge('connecting…', 'badge-muted');

    onAuthStateChanged(state.auth, async (user) => {
      state.user = user;
      if (!user) {
        $('loginCard').hidden = false;
        $('dashboard').hidden = true;
        $('signOutBtn').hidden = true;
        setBadge('signed out', 'badge-muted');
        return;
      }
      $('loginCard').hidden = true;
      $('signOutBtn').hidden = false;
      setBadge(`signed in · ${user.email}`, 'badge-ok');
      await showDashboard();
    });
  } catch (error) {
    console.error(error);
    showError('configError', `Firebase failed to initialise: ${error.message}`);
    $('setupCard').hidden = false;
    setBadge('error', 'badge-error');
  }

  wireLogin();
  wireTable();
  wireEntryDialog();
  wireImportDialog();
}

function toggleSetup() {
  const card = $('setupCard');
  card.hidden = !card.hidden;
}

function saveConfig() {
  const raw = $('configInput').value.trim();
  if (!raw) { showError('configError', 'Paste the config object from Firebase Console first.'); return; }
  try {
    // Accept both JSON and the JS snippet that the Firebase console shows.
    const normalised = raw
      .replace(/^[^{]*/, '')
      .replace(/[^}]*$/, '')
      .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/,\s*}/g, '}')
      .replace(/'/g, '"');
    const parsed = JSON.parse(normalised);
    if (!parsed.apiKey || !parsed.projectId) {
      throw new Error('apiKey and projectId are required');
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    localStorage.setItem(DEMO_KEY, '0');
    location.reload();
  } catch (error) {
    showError('configError', `Could not read that config: ${error.message}`);
  }
}

function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DEMO_KEY);
  location.reload();
}

function setBadge(text, className) {
  const badge = $('connectionBadge');
  badge.textContent = text;
  badge.className = `badge ${className}`;
}

function fillDropdowns() {
  const subjectList = $('subjectList');
  subjectList.replaceChildren(...CONSTANTS.subjects.map((subject) => el('option', { value: subject })));
}

function wireLogin() {
  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('loginError', '');
    const button = event.submitter || $('loginForm').querySelector('button');
    button.disabled = true;
    try {
      await signInWithEmailAndPassword(state.auth, $('email').value.trim(), $('password').value);
      $('password').value = '';
    } catch (error) {
      showError('loginError', friendlyAuthError(error));
    } finally {
      button.disabled = false;
    }
  });

  $('signOutBtn').addEventListener('click', async () => {
    await signOut(state.auth);
    toast('Signed out');
  });
}

function friendlyAuthError(error) {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password. Create the admin user in Firebase Console → Authentication → Users.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No internet connection.';
    case 'auth/invalid-api-key':
      return 'The apiKey in your stored config is wrong — run Setup again.';
    default:
      return error.message;
  }
}

// ---------------------------------------------------------------------------
// Demo data (no Firebase): lets anyone preview the panel instantly
// ---------------------------------------------------------------------------
async function loadDemoData() {
  try {
    const [books, papers] = await Promise.all([
      fetch('../app/assets/data/demo_books.json').then((r) => r.json()),
      fetch('../app/assets/data/demo_papers.json').then((r) => r.json()),
    ]);
    state.demoData = { books, papers };
  } catch {
    // Hosted on its own (Firebase Hosting serves only admin_web/) — fall back to
    // a couple of hand written rows so the table is not empty.
    state.demoData = {
      books: [{
        id: 'demo1', title: 'ගණිතය 10 ශ්‍රේණිය', grade: 10, subject: 'Mathematics',
        medium: 'Sinhala', fileSize: '12.5 MB', downloads: 1500, pdfUrl: 'https://example.org/a.pdf',
      }],
      papers: [{
        id: 'demo2', title: '2023 O/L Mathematics Paper 1', examType: 'OL', year: 2023,
        subject: 'Mathematics', medium: 'Sinhala', paperType: 'Paper 1', hasMarkingScheme: true,
        fileSize: '3.2 MB', downloads: 800, pdfUrl: 'https://example.org/b.pdf',
      }],
    };
  }
  state.docs = state.demoData[state.tab] || [];
  state.hasMore = false;
}

// ---------------------------------------------------------------------------
// Dashboard + stats
// ---------------------------------------------------------------------------
async function showDashboard() {
  $('dashboard').hidden = false;
  await refreshStats();
  await loadPage(true);
}

async function refreshStats() {
  const container = $('stats');
  container.replaceChildren(el('div', { className: 'stat', textContent: 'Loading stats…' }));

  if (state.demo) {
    const books = state.demoData.books;
    const papers = state.demoData.papers;
    renderStats({
      books: books.length,
      papers: papers.length,
      downloads: [...books, ...papers].reduce((sum, row) => sum + (row.downloads || 0), 0),
      bytes: [...books, ...papers].reduce((sum, row) => sum + (row.fileSizeBytes || 0), 0),
      latest: (books[0] || papers[0] || {}).timestamp || null,
    });
    return;
  }

  try {
    const [books, papers] = await Promise.all([
      scanCollection(COLLECTIONS.books),
      scanCollection(COLLECTIONS.papers),
    ]);
    renderStats({
      books: books.length,
      papers: papers.length,
      downloads: [...books, ...papers].reduce((sum, row) => sum + (row.downloads || 0), 0),
      bytes: [...books, ...papers].reduce((sum, row) => sum + (row.fileSizeBytes || 0), 0),
      latest: [...books, ...papers]
        .map((row) => row.timestamp?.toDate?.() || null)
        .filter(Boolean)
        .sort((a, b) => b - a)[0] || null,
    });
  } catch (error) {
    container.replaceChildren(el('div', { className: 'stat' },
      [el('div', { className: 'stat-label', textContent: `Stats unavailable: ${error.message}` })]));
  }
}

function renderStats({ books, papers, downloads, bytes, latest }) {
  const cards = [
    ['📚', formatNumber(books), 'Textbooks & workbooks'],
    ['📝', formatNumber(papers), 'Past papers'],
    ['⬇️', formatNumber(downloads), 'Total app downloads'],
    ['💾', formatBytes(bytes), 'Catalogue size'],
    ['🕒', latest ? latest.toLocaleString() : '—', 'Last upload'],
  ];
  $('stats').replaceChildren(...cards.map(([icon, value, label]) => el('div', { className: 'stat' }, [
    el('span', { className: 'stat-icon', textContent: icon }),
    el('div', { className: 'stat-value', textContent: value }),
    el('div', { className: 'stat-label', textContent: label }),
  ])));
}

/** Reads a whole collection (paged) so stats do not need a Cloud Function. */
async function scanCollection(name) {
  const rows = [];
  let cursor = null;
  for (;;) {
    let q = query(collection(state.db, name), orderBy('timestamp', 'desc'), limit(300));
    if (cursor) q = query(q, startAfter(cursor));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnap) => rows.push({ id: docSnap.id, ...docSnap.data() }));
    if (snapshot.size < 300 || rows.length >= MAX_SCAN) break;
    cursor = snapshot.docs[snapshot.size - 1];
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------
function wireTable() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      state.tab = tab.dataset.tab;
      state.docs = [];
      state.cursor = null;
      await loadPage(true);
    });
  });

  $('tableSearch').addEventListener('input', (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderTable();
  });
  $('tableMedium').addEventListener('change', (event) => {
    state.medium = event.target.value;
    renderTable();
  });
  $('refreshBtn').addEventListener('click', async () => {
    await refreshStats();
    await loadPage(true);
    toast('Refreshed');
  });
  $('loadMoreBtn').addEventListener('click', () => loadPage(false));
  $('addBtn').addEventListener('click', () => openEntryDialog(null));
  $('importBtn').addEventListener('click', () => {
    $('importTarget').textContent = state.tab;
    $('importInput').value = '';
    showError('importError', '');
    $('importDialog').showModal();
  });
}

async function loadPage(reset) {
  if (state.demo) {
    state.docs = reset ? [...(state.demoData[state.tab] || [])] : state.docs;
    renderTable();
    return;
  }
  if (state.writing) return;

  const name = COLLECTIONS[state.tab];
  let q = query(collection(state.db, name), orderBy('timestamp', 'desc'), limit(PAGE_SIZE));
  if (!reset && state.cursor) q = query(q, startAfter(state.cursor));

  try {
    const snapshot = await getDocs(q);
    const rows = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.docs = reset ? rows : [...state.docs, ...rows];
    state.cursor = snapshot.docs[snapshot.size - 1] || null;
    state.hasMore = snapshot.size === PAGE_SIZE;
    renderTable();
  } catch (error) {
    console.error(error);
    toast(`Could not load ${name}: ${error.message}. Is the composite index created? See firebase/firestore.indexes.json.`, true);
  }
}

function filteredDocs() {
  return state.docs.filter((row) => {
    if (state.medium && row.medium !== state.medium) return false;
    if (!state.search) return true;
    const haystack = [row.title, row.subject, row.medium, row.grade, row.year, row.paperType, row.examType]
      .join(' ')
      .toLowerCase();
    return haystack.includes(state.search);
  });
}

function renderTable() {
  const table = $('catalogTable');
  const head = table.tHead;
  const body = table.tBodies[0];
  const isBooks = state.tab === 'books';

  const columns = isBooks
    ? ['Title', 'Grade', 'Subject', 'Medium', 'Type', 'Size', 'Downloads', 'Updated', '']
    : ['Title', 'Exam', 'Year', 'Subject', 'Medium', 'Type', 'Key', 'Size', 'Downloads', ''];

  head.replaceChildren(el('tr', {}, columns.map((label) => el('th', { textContent: label }))));

  const rows = filteredDocs();
  $('tableInfo').textContent = rows.length === state.docs.length
    ? `${rows.length} entries loaded`
    : `${rows.length} of ${state.docs.length} entries match`;
  $('loadMoreBtn').hidden = !state.hasMore || state.demo;

  body.replaceChildren(...rows.map((row) => buildRow(row, isBooks)));
}

function buildRow(row, isBooks) {
  const cells = [];
  const push = (content, className) => cells.push(
    el('td', { className: className || '' },
      typeof content === 'string' ? [document.createTextNode(content)] : [content]),
  );

  push(el('a', {
    href: row.pdfUrl || '#',
    target: '_blank',
    rel: 'noopener',
    textContent: row.title || '(untitled)',
  }));

  if (isBooks) {
    push(String(row.grade ?? '—'));
    push(row.subject || '—');
    push(row.medium || '—');
    push(row.category || 'textbook');
  } else {
    push(row.examType || '—');
    push(String(row.year ?? '—'));
    push(row.subject || '—');
    push(row.medium || '—');
    push(row.paperType || '—');
    push(row.hasMarkingScheme
      ? el('span', { className: 'badge badge-ok', textContent: 'yes' })
      : el('span', { className: 'badge badge-muted', textContent: 'no' }));
  }

  push(row.fileSize || (row.fileSizeBytes ? formatBytes(row.fileSizeBytes) : '—'));
  push(formatNumber(row.downloads));

  if (isBooks) {
    const updated = row.timestamp?.toDate?.();
    push(updated ? updated.toLocaleDateString() : '—');
  }

  const actions = el('td', { className: 'actions' }, [
    el('button', { className: 'btn btn-ghost', textContent: 'Edit', onclick: () => openEntryDialog(row) }),
    el('button', { className: 'btn btn-danger', textContent: 'Delete', onclick: () => removeEntry(row) }),
  ]);
  cells.push(actions);

  return el('tr', {}, cells);
}

// ---------------------------------------------------------------------------
// Add / edit dialog
// ---------------------------------------------------------------------------
function wireEntryDialog() {
  $('entryForm').addEventListener('submit', (event) => {
    event.preventDefault();
    saveEntry();
  });
  $('cancelEntryBtn').addEventListener('click', () => $('entryDialog').close());

  $('fExamType').addEventListener('change', () => {
    const isTermTest = $('fExamType').value === 'TermTest';
    $('fTermWrap').hidden = !isTermTest;
    $('fGrade').parentElement.hidden = !isTermTest && state.tab === 'books' ? false : !isTermTest;
  });
}

function openEntryDialog(row) {
  const isBooks = state.tab === 'books';
  $('entryTitle').textContent = row ? 'Edit entry' : `Add ${isBooks ? 'book' : 'paper'}`;
  $('entryId').value = row?.id || '';
  $('fTitle').value = row?.title || '';
  $('fSubject').value = row?.subject || '';
  $('fMedium').value = row?.medium || 'Sinhala';
  $('fGrade').value = row?.grade ?? (isBooks ? 10 : '');
  $('fYear').value = row?.year ?? new Date().getFullYear();
  $('fExamType').value = row?.examType || 'OL';
  $('fPaperType').value = row?.paperType || 'Paper 1';
  $('fCategory').value = row?.category || 'textbook';
  $('fTerm').value = String(row?.term || 1);
  $('fMarking').checked = Boolean(row?.hasMarkingScheme);
  $('fPdf').value = '';
  $('fCover').value = '';
  $('uploadProgress').hidden = true;
  showError('entryError', '');

  // Show only the fields that matter for the active tab.
  $('fGradeWrap').hidden = false;
  $('fExamWrap').hidden = isBooks;
  $('fPaperTypeWrap').hidden = isBooks;
  $('fTermWrap').hidden = isBooks || ($('fExamType').value !== 'TermTest');
  $('fCategoryWrap').hidden = !isBooks;
  $('fCoverWrap').hidden = !isBooks;
  $('fYearWrap').hidden = isBooks;
  $('fPdf').required = !row; // an edit may keep the existing PDF

  $('entryDialog').showModal();
}

async function saveEntry() {
  const isBooks = state.tab === 'books';
  const id = $('entryId').value;
  const title = $('fTitle').value.trim();
  if (!title) { showError('entryError', 'Title is required'); return; }

  const file = $('fPdf').files[0];
  if (!file && !id) { showError('entryError', 'Choose a PDF file'); return; }
  if (file && file.type && file.type !== 'application/pdf') {
    showError('entryError', 'Only PDF files are accepted');
    return;
  }

  const saveButton = $('saveEntryBtn');
  saveButton.disabled = true;
  state.writing = true;
  showError('entryError', '');

  try {
    const docId = id || buildDocId(title, isBooks ? $('fGrade').value : $('fExamType').value);

    if (state.demo) {
      // Demo mode: mutate the in-memory copy so the UI flow is testable.
      const list = state.demoData[state.tab];
      const existing = list.findIndex((entry) => entry.id === docId);
      const payload = collectForm(docId, file ? 'https://example.org/demo.pdf' : undefined);
      if (existing >= 0) list[existing] = { ...list[existing], ...payload };
      else list.unshift(payload);
      state.docs = [...list];
      renderTable();
      $('entryDialog').close();
      toast('Saved (demo mode — nothing was uploaded)');
      return;
    }

    let pdfUrl;
    if (file) {
      pdfUrl = await uploadFile(file, `${STORAGE.pdfFolder}/${docId}.pdf`, (percent) => {
        $('uploadProgress').hidden = false;
        $('uploadProgress').value = percent;
      });
    }

    const cover = $('fCover').files[0];
    const coverUrl = cover
      ? await uploadFile(cover, `${STORAGE.coverFolder}/${docId}.${extensionOf(cover.name)}`)
      : undefined;

    const payload = collectForm(docId, pdfUrl, coverUrl);
    await setDoc(doc(state.db, COLLECTIONS[state.tab], docId), payload, { merge: true });

    await refreshStats();
    await loadPage(true);
    $('entryDialog').close();
    toast(`Saved “${title}”`);
  } catch (error) {
    console.error(error);
    showError('entryError', friendlyWriteError(error));
  } finally {
    saveButton.disabled = false;
    state.writing = false;
  }
}

/** Builds the Firestore document for the active tab from the form values. */
function collectForm(docId, pdfUrl, coverUrl) {
  const isBooks = state.tab === 'books';
  const keywords = [
    $('fTitle').value.trim().toLowerCase(),
    $('fSubject').value.trim().toLowerCase(),
    $('fMedium').value.toLowerCase(),
  ];

  if (isBooks) {
    const grade = Number($('fGrade').value) || 0;
    keywords.push(`grade ${grade}`, String(grade));
    return {
      title: $('fTitle').value.trim(),
      grade,
      subject: $('fSubject').value.trim(),
      medium: $('fMedium').value,
      category: $('fCategory').value,
      year: Number($('fYear').value) || null,
      coverUrl: coverUrl ?? '',
      ...(pdfUrl ? { pdfUrl } : {}),
      fileSize: pdfUrl ? '' : undefined,
      downloads: 0,
      keywords,
      timestamp: serverTimestamp(),
    };
  }

  const examType = $('fExamType').value;
  const year = Number($('fYear').value) || new Date().getFullYear();
  keywords.push(examType.toLowerCase(), String(year), $('fPaperType').value.toLowerCase());
  return {
    title: $('fTitle').value.trim(),
    examType,
    year,
    subject: $('fSubject').value.trim(),
    medium: $('fMedium').value,
    paperType: $('fPaperType').value,
    hasMarkingScheme: $('fMarking').checked || $('fPaperType').value === 'Marking Scheme',
    grade: examType === 'TermTest' ? Number($('fGrade').value) || null
      : (examType === 'Scholarship' ? 5 : null),
    term: examType === 'TermTest' ? Number($('fTerm').value) || null : null,
    ...(pdfUrl ? { pdfUrl } : {}),
    downloads: 0,
    keywords,
    timestamp: serverTimestamp(),
  };
}

function friendlyWriteError(error) {
  switch (error.code) {
    case 'permission-denied':
      return 'Permission denied. The signed-in user needs the "admin" custom claim (or its UID must be in adminUids in config.js). See docs/ADMIN_PANEL.md.';
    case 'storage/unauthorized':
      return 'Storage rules rejected the upload. Check firebase/storage.rules and your admin claim.';
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out. Try a smaller file or a better connection.';
    case 'unavailable':
      return 'No connection to Firestore. Check your internet.';
    default:
      return error.message;
  }
}

function buildDocId(title, discriminator) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const suffix = String(discriminator ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  // Sinhala/Tamil titles collapse to an empty slug: fall back to a timestamp so
  // the id stays unique and stable for the app's favourites/downloads keys.
  const base = slug || `entry_${Date.now()}`;
  return suffix ? `${base}_${suffix}` : base;
}

function extensionOf(name) {
  const parts = String(name).split('.');
  return (parts.length > 1 ? parts.pop() : 'png').toLowerCase();
}

/** Uploads a file and reports progress; resolves with its public URL. */
function uploadFile(file, path, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef(state.storage, path), file, {
      contentType: file.type || 'application/pdf',
    });
    task.on('state_changed',
      (snapshot) => {
        if (onProgress) onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      async () => {
        try {
          resolve(await getDownloadURL(task.snapshot.ref));
        } catch (error) {
          reject(error);
        }
      });
  });
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------
async function removeEntry(row) {
  const label = row.title || row.id;
  if (!confirm(`Delete “${label}” from ${state.tab}?\n\nThe PDF is removed from Storage as well. This cannot be undone.`)) {
    return;
  }
  state.writing = true;
  try {
    if (state.demo) {
      state.demoData[state.tab] = state.demoData[state.tab].filter((entry) => entry.id !== row.id);
      state.docs = [...state.demoData[state.tab]];
      renderTable();
      toast('Deleted (demo mode)');
      return;
    }

    // Remove the Storage objects first: a document without files is more
    // obvious to fix than files without a document.
    for (const url of [row.pdfUrl, row.coverUrl]) {
      if (!url || !String(url).startsWith('http')) continue;
      try {
        await deleteObject(storageRef(state.storage, url));
      } catch (error) {
        if (error.code !== 'storage/object-not-found') throw error;
      }
    }

    await deleteDoc(doc(state.db, COLLECTIONS[state.tab], row.id));
    await refreshStats();
    await loadPage(true);
    toast(`Deleted “${label}”`);
  } catch (error) {
    console.error(error);
    toast(`Delete failed: ${friendlyWriteError(error)}`, true);
  } finally {
    state.writing = false;
  }
}

// ---------------------------------------------------------------------------
// Bulk JSON import
// ---------------------------------------------------------------------------
function wireImportDialog() {
  $('cancelImportBtn').addEventListener('click', () => $('importDialog').close());
  $('importForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('importError', '');
    let rows;
    try {
      rows = JSON.parse($('importInput').value);
      if (!Array.isArray(rows)) throw new Error('expected a JSON array');
      if (rows.length === 0) throw new Error('the array is empty');
      if (rows.length > 500) throw new Error('import at most 500 rows at a time');
    } catch (error) {
      showError('importError', `Could not parse the JSON: ${error.message}`);
      return;
    }

    const invalid = rows.findIndex((row) => !row.title || !row.subject || !row.medium);
    if (invalid >= 0) {
      showError('importError', `Row ${invalid + 1} needs title, subject and medium`);
      return;
    }
    const missingPdf = rows.findIndex((row) => !row.pdfUrl && !row.pdf_url);
    if (missingPdf >= 0) {
      showError('importError', `Row ${missingPdf + 1} has no pdfUrl. Upload the PDFs first (or use the mobile app’s asset: scheme for bundled files).`);
      return;
    }

    if (state.demo) {
      state.demoData[state.tab] = [...rows, ...state.demoData[state.tab]];
      state.docs = [...state.demoData[state.tab]];
      renderTable();
      $('importDialog').close();
      toast(`Imported ${rows.length} rows (demo mode)`);
      return;
    }

    const button = event.submitter;
    button.disabled = true;
    state.writing = true;
    let imported = 0;
    try {
      for (const row of rows) {
        const docId = row.id || buildDocId(String(row.title), row.grade ?? row.year ?? imported);
        const payload = { ...row, id: undefined };
        delete payload.id;
        await setDoc(doc(state.db, COLLECTIONS[state.tab], docId), {
          ...payload,
          downloads: payload.downloads || 0,
          keywords: [
            String(row.title).toLowerCase(),
            String(row.subject).toLowerCase(),
            String(row.medium).toLowerCase(),
          ],
          timestamp: serverTimestamp(),
        }, { merge: true });
        imported += 1;
      }
      await refreshStats();
      await loadPage(true);
      $('importDialog').close();
      toast(`Imported ${imported} entries`);
    } catch (error) {
      console.error(error);
      showError('importError', `Imported ${imported} of ${rows.length}. ${friendlyWriteError(error)}`);
    } finally {
      button.disabled = false;
      state.writing = false;
    }
  });
}

// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', boot);

// Keep the console tidy when the panel is embedded somewhere odd.
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection in the admin panel', event.reason);
});
