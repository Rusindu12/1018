/**
 * EduLanka Admin - Firebase configuration
 *
 * Option A (recommended, no file editing):
 *   Open the admin panel, click "⚙︎ Setup" and paste the config object from
 *   Firebase Console → Project settings → Your apps → Web app → SDK setup.
 *   It is stored in this browser's localStorage.
 *
 * Option B: paste your values below (safe to commit — a Firebase *web* config is
 * public by design; security comes from the Firestore/Storage rules in
 * `firebase/`). Then remove the "setup" step from the UI if you like.
 *
 * Leave the placeholders untouched to run the panel in demo mode.
 */

export const firebaseConfig = {
  apiKey: 'PASTE_API_KEY',
  authDomain: 'PASTE_PROJECT.firebaseapp.com',
  projectId: 'PASTE_PROJECT',
  storageBucket: 'PASTE_PROJECT.appspot.com',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',
};

/** UIDs allowed to write, in addition to users with the `admin` custom claim. */
export const adminUids = [
  // 'PASTE_YOUR_ADMIN_UID_HERE',
];

/** Firestore collection + Storage folder names (must match AppConfig in the app). */
export const COLLECTIONS = {
  books: 'books',
  papers: 'papers',
};

export const STORAGE = {
  pdfFolder: 'pdfs',
  coverFolder: 'covers',
};

/** Values offered in the dropdowns — keep in sync with CatalogConstants. */
export const CONSTANTS = {
  grades: Array.from({ length: 13 }, (_, i) => i + 1),
  mediums: ['Sinhala', 'English', 'Tamil'],
  bookCategories: ['textbook', 'workbook', 'syllabus', 'teachers-guide'],
  examTypes: ['OL', 'AL', 'Scholarship', 'TermTest'],
  paperTypes: ['Paper 1', 'Paper 2', 'MCQ', 'Essay', 'Term Test', 'Marking Scheme'],
  subjects: [
    'Mathematics', 'Science', 'Sinhala Language', 'Tamil Language', 'English Language',
    'History', 'Geography', 'Citizenship Education', 'Health & Physical Education', 'ICT',
    'Agriculture', 'Home Economics', 'Buddhism', 'Hinduism', 'Islam', 'Christianity',
    'Aesthetics', 'Business & Accounting Studies', 'Entrepreneurship Studies',
    'Design & Technology', 'Biology', 'Chemistry', 'Physics', 'Combined Mathematics',
    'Business Studies', 'Accounting', 'Economics', 'Political Science',
    'Logic & Scientific Method', 'Agricultural Science', 'Sinhala Literature',
    'Tamil Literature', 'English Literature', 'General Knowledge', 'Common General Test',
  ],
};

export const STORAGE_KEY = 'edulanka.admin.config';
export const DEMO_KEY = 'edulanka.admin.demo';

/** Reads the config from localStorage when present, else falls back to the file. */
export function effectiveConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...firebaseConfig, ...JSON.parse(raw) };
  } catch (error) {
    console.warn('Stored config is unreadable, falling back to config.js', error);
  }
  return firebaseConfig;
}

export function isConfigured(config) {
  return Boolean(
    config &&
      config.apiKey &&
      config.projectId &&
      !String(config.apiKey).startsWith('PASTE_') &&
      !String(config.projectId).startsWith('PASTE_'),
  );
}
