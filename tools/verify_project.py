#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Static verification for the EduLanka repository.

`flutter analyze` and `flutter test` are the real gates (see .github/workflows/ci.yml).
This script exists so the project can also be checked on machines without a Dart
SDK - it validates everything that is verifiable from the outside:

  * every Dart import resolves to a real file
  * no unused imports, no unbalanced brackets, no TODO markers in lib/
  * every `l10n.<name>` used in the app exists in the string table, and every
    string row has a getter + all three translations
  * every provider symbol used in a file is imported by that file
  * pubspec assets exist, JSON/PDF/PNG assets are structurally valid
  * the Android runner is complete (manifest, activity path, launcher icons)
  * the admin panel's DOM ids referenced from app.js exist in index.html
  * Firebase config files parse, tools/ scripts compile

Usage:  python3 tools/verify_project.py [--quiet]
"""
import json
import os
import re
import subprocess
import struct
import sys
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
APP = os.path.join(ROOT, 'app')
QUIET = '--quiet' in sys.argv

problems = []
notes = []


def fail(message):
    problems.append(message)


def note(message):
    notes.append(message)


def read(path):
    with open(path, encoding='utf-8') as handle:
        return handle.read()


def rel(path):
    return os.path.relpath(path, ROOT)


def dart_files(*folders):
    found = []
    for folder in folders:
        base = os.path.join(APP, folder)
        for dirpath, _dirnames, filenames in os.walk(base):
            for name in filenames:
                if name.endswith('.dart'):
                    found.append(os.path.join(dirpath, name))
    return sorted(found)


# ---------------------------------------------------------------------------
# 1. pubspec + assets
# ---------------------------------------------------------------------------
def check_pubspec():
    path = os.path.join(APP, 'pubspec.yaml')
    if not os.path.exists(path):
        fail('app/pubspec.yaml is missing')
        return {}
    src = read(path)

    required = [
        'flutter_riverpod', 'firebase_core', 'cloud_firestore', 'firebase_storage',
        'firebase_auth', 'flutter_pdfview', 'shared_preferences', 'path_provider',
        'dio', 'connectivity_plus', 'cached_network_image', 'flutter_cache_manager',
        'intl', 'share_plus', 'package_info_plus', 'url_launcher', 'characters',
        'flutter_localizations', 'flutter_lints',
    ]
    for dependency in required:
        if not re.search(r'^\s{2}%s:' % re.escape(dependency), src, re.M):
            fail('pubspec.yaml is missing the dependency "%s"' % dependency)

    for block in ('assets:', 'sdk: flutter'):
        if block not in src:
            fail('pubspec.yaml is missing "%s"' % block)

    # Every declared asset folder must exist and contain at least one file.
    for folder in re.findall(r'^\s{4}-\s+(assets/[^\s#]+)/?\s*$', src, re.M):
        target = os.path.join(APP, folder)
        if not os.path.isdir(target):
            fail('declared asset folder does not exist: app/%s' % folder)
        elif not os.listdir(target):
            fail('declared asset folder is empty: app/%s' % folder)

    if 'assets/images/' in src and not os.path.exists(os.path.join(APP, 'assets/images/logo.png')):
        fail('assets/images/logo.png is missing')
    for name in ('demo_books.json', 'demo_papers.json'):
        if not os.path.exists(os.path.join(APP, 'assets/data', name)):
            fail('assets/data/%s is missing' % name)
    if not os.path.exists(os.path.join(APP, 'assets/sample/sample_paper.pdf')):
        fail('assets/sample/sample_paper.pdf is missing')
    return {}


# ---------------------------------------------------------------------------
# 2. Dart structure: imports, brackets, TODOs
# ---------------------------------------------------------------------------
PAIRS = {')': '(', ']': '[', '}': '{'}
OPEN = set('([{')


def strip_dart(src):
    """Removes comments and string literals so brackets can be counted."""
    out = []
    i, n, line = 0, len(src), 1
    while i < n:
        char = src[i]
        if char == '\n':
            line += 1
            out.append('\n')
            i += 1
            continue
        if char == '/' and i + 1 < n and src[i + 1] == '/':
            while i < n and src[i] != '\n':
                i += 1
            continue
        if char == '/' and i + 1 < n and src[i + 1] == '*':
            depth = 1
            i += 2
            while i < n and depth:
                if src[i] == '\n':
                    line += 1
                if src[i] == '/' and i + 1 < n and src[i + 1] == '*':
                    depth += 1
                    i += 2
                    continue
                if src[i] == '*' and i + 1 < n and src[i + 1] == '/':
                    depth -= 1
                    i += 2
                    continue
                i += 1
            continue
        if char in 'rR' and i + 1 < n and src[i + 1] in '\'"':
            i += 1
            char = src[i]
        if char in '\'"':
            quote = char
            if src.startswith(quote * 3, i):
                i += 3
                while i < n and not src.startswith(quote * 3, i):
                    if src[i] == '\\':
                        i += 2
                        continue
                    if src[i] == '\n':
                        line += 1
                    i += 1
                i += 3
            else:
                i += 1
                while i < n and src[i] != quote:
                    if src[i] == '\\':
                        i += 2
                        continue
                    if src[i] == '\n':
                        line += 1
                    i += 1
                i += 1
            out.append('""')
            continue
        out.append(char)
        i += 1
    return ''.join(out), line


def check_dart_files(paths):
    for path in paths:
        src = read(path)
        stripped, _ = strip_dart(src)
        stack = []
        line = 1
        for char in stripped:
            if char == '\n':
                line += 1
            elif char in OPEN:
                stack.append((char, line))
            elif char in PAIRS:
                if not stack:
                    fail('%s:%d unexpected %r' % (rel(path), line, char))
                    break
                opening, opened_at = stack.pop()
                if opening != PAIRS[char]:
                    fail('%s:%d %r closes %r opened at line %d'
                         % (rel(path), line, char, opening, opened_at))
                    break
        if stack:
            fail('%s unclosed %r from line %d' % (rel(path), stack[-1][0], stack[-1][1]))

        for number, text in enumerate(src.split('\n'), start=1):
            if 'TODO' in text or 'FIXME' in text:
                fail('%s:%d contains a TODO/FIXME marker (see docs/CONTRIBUTING.md)'
                     % (rel(path), number))
            if '\t' in text:
                fail('%s:%d contains a literal tab' % (rel(path), number))
            if text.startswith('import ') and 'dart:html' in text:
                fail('%s:%d dart:html is not available on Android' % (rel(path), number))


def check_imports(paths):
    for path in paths:
        src = read(path)
        for target in re.findall(r"^import '([^']+)';", src, re.M):
            if target.startswith(('dart:', 'package:')):
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            if not os.path.exists(resolved):
                fail('%s imports a missing file: %s' % (rel(path), target))


def identifiers_of(path):
    src = read(path)
    names = set(re.findall(
        r'^(?:abstract\s+|final\s+|sealed\s+|base\s+)*(?:class|enum|extension|mixin|typedef)\s+([A-Za-z_]\w*)',
        src, re.M))
    names |= set(re.findall(r'^(?:[A-Za-z_][\w<>,\?\s\[\]]*\s+)?([a-z_]\w*)\s*\(', src, re.M))
    names |= set(re.findall(r'^(?:final|const)\s+[^=;]*?\b([A-Za-z_]\w*)\s*=', src, re.M))
    names |= set(re.findall(r'^\s{2}[A-Za-z_][\w<>,\?\[\]\s]*\s+([a-z_]\w*)\s*\(', src, re.M))
    if 'extension ' in src:
        names |= set(re.findall(r'extension\s+\w+\s+on\s+([A-Za-z_]\w*)', src))
    return {name for name in names if name != 'main'}


def check_unused_imports(paths):
    cache = {}
    for path in paths:
        src = read(path)
        body = '\n'.join(line for line in src.split('\n') if not line.strip().startswith('import '))
        for target in re.findall(r"^import '([^']+)';", src, re.M):
            if target.startswith(('dart:', 'package:')):
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            if not os.path.exists(resolved):
                continue
            if resolved not in cache:
                cache[resolved] = identifiers_of(resolved)
            names = cache[resolved]
            if not names:
                continue
            base = os.path.basename(resolved)[:-5]
            if re.search(r'\b%s\b' % re.escape(base), body):
                continue
            if not any(re.search(r'\b%s\b' % re.escape(name), body) for name in names):
                fail('%s has an unused import: %s' % (rel(path), target))


def resolve_import(path, target):
    """Turns an import string into an absolute path (relative or package:)."""
    if target.startswith('dart:'):
        return None
    if target.startswith('package:'):
        package_path = target.split(':', 1)[1]
        if not package_path.startswith('edulanka/'):
            return None
        return os.path.join(APP, 'lib', package_path.split('/', 1)[1])
    return os.path.normpath(os.path.join(os.path.dirname(path), target))


# Symbols expected to be used when a file imports one of these libraries. Used
# to catch `import ...;` lines that no longer serve any purpose (the analyzer
# flags those as warnings, and dead imports rot fast in a big widget tree).
LIBRARY_SYMBOLS = {
    'dart:async': ['Future', 'Stream', 'Timer', 'Completer', 'unawaited',
                   'StreamController', 'scheduleMicrotask', 'Zone'],
    'dart:convert': ['jsonEncode', 'jsonDecode', 'utf8', 'base64', 'JsonEncoder'],
    'dart:io': ['File', 'Directory', 'FileSystemException', 'Platform',
                'RandomAccessFile', 'SocketException', 'HttpClient', 'IOSink'],
    'dart:typed_data': ['Uint8List', 'ByteData', 'Uint8Buffer'],
    'dart:math': ['sqrt', 'Random', 'min', 'max', 'pi', 'pow'],
    'cloud_firestore/cloud_firestore.dart': [
        'FirebaseFirestore', 'DocumentSnapshot', 'FieldValue', 'Timestamp',
        'CollectionReference', 'QuerySnapshot', 'QueryDocumentSnapshot', 'Query'],
    'dio/dio.dart': ['Dio', 'BaseOptions', 'DioException', 'CancelToken'],
    'path_provider/path_provider.dart': ['getApplicationDocumentsDirectory'],
    'shared_preferences/shared_preferences.dart': ['SharedPreferences'],
    'cached_network_image/cached_network_image.dart': ['CachedNetworkImage'],
    'flutter_cache_manager/flutter_cache_manager.dart': [
        'CacheManager', 'Config', 'JsonCacheInfoRepository', 'HttpFileService',
        'DefaultCacheManager'],
    'share_plus/share_plus.dart': ['Share', 'XFile'],
    'url_launcher/url_launcher.dart': ['launchUrl', 'LaunchMode', 'canLaunchUrl'],
    'package_info_plus/package_info_plus.dart': ['PackageInfo'],
    'connectivity_plus/connectivity_plus.dart': ['Connectivity', 'ConnectivityResult'],
    'flutter_pdfview/flutter_pdfview.dart': ['PDFView', 'PDFViewController', 'FitPolicy'],
    'intl/intl.dart': ['DateFormat', 'NumberFormat', 'Intl'],
    'characters/characters.dart': ['Characters', 'characters'],
    'firebase_core/firebase_core.dart': ['Firebase', 'FirebaseException', 'FirebaseApp'],
}

# Files that legitimately import a library for its side effects or re-exports.
IMPORT_CHECK_EXEMPT = {
    'lib/app.dart',       # flutter_localizations + the localization delegates
    'lib/main.dart',      # firebase_core is imported for Firebase.initializeApp
}


def check_library_imports(paths):
    for path in paths:
        relative = os.path.relpath(path, APP).replace('\\', '/')
        if relative in IMPORT_CHECK_EXEMPT:
            continue
        src = read(path)
        body = '\n'.join(line for line in src.split('\n')
                         if not line.strip().startswith('import '))
        for target in re.findall(r"^import '([^']+)';", src, re.M):
            symbols = None
            for suffix, expected in LIBRARY_SYMBOLS.items():
                if target.endswith(suffix):
                    symbols = expected
                    break
            if symbols is None:
                continue
            if any(re.search(r'\b%s\b' % re.escape(symbol), body) for symbol in symbols):
                continue
            fail('%s has an unused import: %s' % (rel(path), target))


def check_provider_imports(paths):
    definitions = {}
    for path in paths:
        src = read(path)
        for match in re.finditer(r'^\s*(?:final|const)\s+.*?\b(\w+Provider)\s*=', src, re.M):
            definitions.setdefault(match.group(1), set()).add(path)

    for path in paths:
        src = read(path)
        body = '\n'.join(line for line in src.split('\n') if not line.strip().startswith('//'))
        imported = set()
        for target in re.findall(r"^import '([^']+)';", src, re.M):
            resolved = resolve_import(path, target)
            if resolved:
                imported.add(resolved)
        for symbol, declaring in definitions.items():
            if path in declaring:
                continue
            if not re.search(r'\b%s\b' % re.escape(symbol), body):
                continue
            if not (imported & declaring):
                fail('%s uses %s without importing %s'
                     % (rel(path), symbol, ', '.join(sorted(rel(p) for p in declaring))))


# ---------------------------------------------------------------------------
# 3. Localisation table integrity
# ---------------------------------------------------------------------------
def check_localizations():
    path = os.path.join(APP, 'lib/l10n/app_localizations.dart')
    if not os.path.exists(path):
        fail('lib/l10n/app_localizations.dart is missing')
        return set()
    src = read(path)

    all_rows = re.findall(r"^\s{4}'([a-z0-9_]+)': <String>\[(.*?)\],", src, re.M)
    all_keys = {row[0] for row in all_rows}
    if len(all_keys) != len(all_rows):
        fail('app_localizations.dart has duplicate string keys')
    for key, raw_columns in all_rows:
        columns = re.findall(r"'((?:[^'\\]|\\.)*)'", raw_columns)
        if len(columns) != 3:
            fail('string "%s" does not have exactly three translations' % key)
        elif any(not column.strip() for column in columns):
            fail('string "%s" has an empty translation' % key)

    getters = set(re.findall(r"String get ([a-zA-Z]\w*) => _v\('", src))
    # Methods built by hand around a raw key (e.g. viewerPageOf) count as getters.
    methods = set(re.findall(r"^\s{2}[A-Za-z_][\w<>,\?\[\]\s]*\s+([a-z]\w*)\s*\(", src, re.M))
    parameterised = {'viewer_page_of', 'viewer_share_subject', 'downloads_delete_body',
                     'search_no_results'}
    key_to_camel = {}
    for key in all_keys:
        parts = key.split('_')
        key_to_camel[key] = parts[0] + ''.join(p.capitalize() for p in parts[1:])
    for key, camel in key_to_camel.items():
        if key in parameterised:
            # Built by hand, e.g. shareSubject() reads _v('viewer_share_subject'),
            # so the key must appear twice: once in the table, once in code.
            if src.count("'%s'" % key) < 2:
                fail('parameterised string "%s" is never read by a method' % key)
            continue
        if camel not in getters:
            fail('string "%s" has no getter (%s)' % (key, camel))
    for getter in getters:
        if getter not in key_to_camel.values():
            fail('getter "%s" does not map to any string key' % getter)

    # Parameterised helpers declared by hand.
    for method in ('viewerPageOf', 'shareSubject', 'downloadsDeleteBody',
                   'searchNoResults', 'gradeLabel', 'gradeRangeLabel', 'itemsCount',
                   'downloadsCount', 'greetingForHour'):
        if method not in src:
            fail('AppLocalizations is missing the helper %s()' % method)

    # Extension methods provided by catalog_names.dart.
    catalog = os.path.join(APP, 'lib/l10n/catalog_names.dart')
    extension_methods = set()
    if os.path.exists(catalog):
        extension_methods = set(re.findall(
            r'^\s{2}[A-Za-z_][\w<>,\?\[\]\s]*\s+([a-z]\w*)\s*\(', read(catalog), re.M))
    feature_methods = set()
    for feature_path in dart_files('lib/features'):
        if feature_path.endswith('providers.dart') or 'extensions' in feature_path:
            feature_methods |= set(re.findall(
                r'^\s{2}[A-Za-z_][\w<>,\?\[\]\s]*\s+([a-z]\w*)\s*\(', read(feature_path), re.M))
            feature_methods |= set(re.findall(
                r'^\s{2}String get ([a-zA-Z]\w*) =>', read(feature_path), re.M))

    known = getters | set(key_to_camel.values()) | extension_methods | feature_methods | methods
    known |= {'of', 'delegate', 'language'}

    for path in dart_files('lib') + dart_files('test'):
        if path.endswith('app_localizations.dart'):
            continue
        src = read(path)
        body = '\n'.join(line for line in src.split('\n')
                         if not line.strip().startswith('//'))
        for match in re.finditer(r'\bl10n\.([a-zA-Z]\w*)', body):
            name = match.group(1)
            if name not in known:
                fail('%s uses l10n.%s which is not defined in the string table'
                     % (rel(path), name))
    return known


# ---------------------------------------------------------------------------
# 4. Assets: JSON, PDF, PNG
# ---------------------------------------------------------------------------
def check_demo_data():
    books_path = os.path.join(APP, 'assets/data/demo_books.json')
    papers_path = os.path.join(APP, 'assets/data/demo_papers.json')
    if not (os.path.exists(books_path) and os.path.exists(papers_path)):
        return
    try:
        books = json.loads(read(books_path))
        papers = json.loads(read(papers_path))
    except json.JSONDecodeError as error:
        fail('demo catalogue JSON is invalid: %s' % error)
        return

    for label, rows in (('demo_books.json', books), ('demo_papers.json', papers)):
        if not isinstance(rows, list) or not rows:
            fail('%s must be a non-empty array' % label)
            continue
        ids = [row.get('id') for row in rows]
        if len(ids) != len(set(ids)):
            fail('%s has duplicate ids (favourites/downloads key off them)' % label)
        for row in rows:
            for field in ('title', 'subject', 'medium', 'pdfUrl'):
                if not row.get(field):
                    fail('%s row %r is missing %s' % (label, row.get('id'), field))
            if not str(row.get('pdfUrl', '')).startswith('asset:'):
                note('%s row %s points outside the bundle (only OK for real data)'
                     % (label, row.get('id')))

    grades = {row.get('grade') for row in books}
    missing = sorted(set(range(1, 14)) - {g for g in grades if isinstance(g, int)})
    if missing:
        fail('demo books do not cover grade(s): %s' % missing)
    for medium in ('Sinhala', 'English', 'Tamil'):
        if not any(row.get('medium') == medium for row in books):
            fail('demo books have no %s medium rows' % medium)
    for exam in ('OL', 'AL', 'Scholarship', 'TermTest'):
        if not any(row.get('examType') == exam for row in papers):
            fail('demo papers have no %s rows' % exam)
    years = {row.get('year') for row in papers}
    if not any(isinstance(y, int) and 2015 <= y <= 2024 for y in years):
        fail('demo papers have no year inside 2015-2024')
    note('demo catalogue: %d books, %d papers' % (len(books), len(papers)))


def check_pdf():
    path = os.path.join(APP, 'assets/sample/sample_paper.pdf')
    if not os.path.exists(path):
        return
    with open(path, 'rb') as handle:
        data = handle.read()
    if not data.startswith(b'%PDF-'):
        fail('sample_paper.pdf has no %PDF header')
    if not data.rstrip().endswith(b'%%EOF'):
        fail('sample_paper.pdf has no %%EOF trailer')
    pages = data.count(b'/Type /Page ')
    if pages < 4:
        fail('sample_paper.pdf has only %d pages (bookmark tests need several)' % pages)
    if b'xref' not in data or b'startxref' not in data:
        fail('sample_paper.pdf is missing its cross reference table')
    note('sample_paper.pdf: %d bytes, %d pages' % (len(data), pages))


def check_pngs():
    expectations = {
        'assets/images/logo.png': 512,
        'assets/images/app_icon.png': 512,
        'android/app/src/main/res/mipmap-mdpi/ic_launcher.png': 48,
        'android/app/src/main/res/mipmap-hdpi/ic_launcher.png': 72,
        'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png': 96,
        'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png': 144,
        'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png': 192,
    }
    for relative, size in expectations.items():
        path = os.path.join(APP, relative)
        if not os.path.exists(path):
            fail('missing image: app/%s' % relative)
            continue
        with open(path, 'rb') as handle:
            data = handle.read()
        if not data.startswith(b'\x89PNG\r\n\x1a\n'):
            fail('app/%s is not a PNG file' % relative)
            continue
        width, height = struct.unpack('>II', data[16:24])
        if (width, height) != (size, size):
            fail('app/%s is %dx%d, expected %dx%d' % (relative, width, height, size, size))
        # verify the IDAT stream actually decompresses (catches truncated files)
        try:
            zlib.decompress(data[data.index(b'IDAT') + 4:data.index(b'IEND') - 4])
        except zlib.error:
            fail('app/%s has a corrupt image stream' % relative)


# ---------------------------------------------------------------------------
# 5. Android runner
# ---------------------------------------------------------------------------
def check_android():
    base = os.path.join(APP, 'android')
    for relative in ('settings.gradle', 'build.gradle', 'gradle.properties',
                     'app/build.gradle', 'app/src/main/AndroidManifest.xml'):
        if not os.path.exists(os.path.join(base, relative)):
            fail('android/%s is missing' % relative)

    manifest_path = os.path.join(base, 'app/src/main/AndroidManifest.xml')
    gradle_path = os.path.join(base, 'app/build.gradle')
    if os.path.exists(manifest_path) and os.path.exists(gradle_path):
        manifest = read(manifest_path)
        gradle = read(gradle_path)
        application_id = re.search(r'applicationId\s*=?\s*"([^"]+)"', gradle)
        if not application_id:
            fail('android/app/build.gradle has no applicationId')
        else:
            package = application_id.group(1)
            activity = os.path.join(base, 'app/src/main/kotlin',
                                    *package.split('.'), 'MainActivity.kt')
            if not os.path.exists(activity):
                fail('MainActivity.kt is not in the applicationId package (%s)' % package)
            namespace = re.search(r'namespace\s*=?\s*"([^"]+)"', gradle)
            if not namespace or namespace.group(1) != package:
                fail('android namespace and applicationId differ (breaks Firebase)')
        for permission in ('android.permission.INTERNET', 'ACCESS_NETWORK_STATE'):
            if permission not in manifest:
                fail('AndroidManifest.xml is missing %s' % permission)
        if 'io.flutter.embedding.android.NormalTheme' not in manifest:
            fail('AndroidManifest.xml is missing the NormalTheme meta-data')
        if 'flutterEmbedding' not in manifest:
            fail('AndroidManifest.xml is missing the flutterEmbedding meta-data')
        if '<queries>' not in manifest:
            fail('AndroidManifest.xml has no <queries> block (url_launcher/share_plus need it)')

    for density in ('mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'):
        icon = os.path.join(base, 'app/src/main/res/mipmap-%s/ic_launcher.png' % density)
        if not os.path.exists(icon):
            fail('android launcher icon missing for %s' % density)


# ---------------------------------------------------------------------------
# 6. Admin panel
# ---------------------------------------------------------------------------
def check_admin():
    base = os.path.join(ROOT, 'admin_web')
    html_path = os.path.join(base, 'index.html')
    js_path = os.path.join(base, 'app.js')
    for relative in ('index.html', 'app.js', 'config.js', 'styles.css'):
        if not os.path.exists(os.path.join(base, relative)):
            fail('admin_web/%s is missing' % relative)
    if not (os.path.exists(html_path) and os.path.exists(js_path)):
        return

    html = read(html_path)
    js = read(js_path)

    referenced = set(re.findall(r"\$\('([A-Za-z0-9_]+)'\)", js))
    declared = set(re.findall(r'id="([A-Za-z0-9_]+)"', html))
    missing = sorted(referenced - declared)
    if missing:
        fail('admin_web/app.js references DOM id(s) not present in index.html: %s'
             % ', '.join(missing))

    for asset in ('styles.css', 'app.js', 'config.js'):
        if asset not in html and asset != 'config.js':
            fail('admin_web/index.html does not load %s' % asset)

    if 'firebasejs/10' not in js:
        fail('admin_web/app.js does not import a pinned Firebase SDK version')
    for symbol in ('initializeApp', 'getFirestore', 'getStorage', 'getAuth',
                   'uploadBytesResumable', 'getDownloadURL', 'deleteObject'):
        if symbol not in js:
            fail('admin_web/app.js is missing %s' % symbol)

    # collections/folders must match the app
    app_config = read(os.path.join(APP, 'lib/core/config/app_config.dart'))
    for name in ('books', 'papers'):
        if "'%s'" % name not in app_config and '"%s"' % name not in app_config:
            fail('AppConfig does not define the %s collection' % name)


def check_node_syntax():
    node = subprocess.run(['node', '--version'], capture_output=True, text=True)
    if node.returncode != 0:
        note('node is not installed - skipping JavaScript syntax checks')
        return
    for relative in ('admin_web/app.js', 'admin_web/config.js',
                     'tools/seed/seed_firestore.mjs', 'tools/seed/set_admin_claim.mjs'):
        path = os.path.join(ROOT, relative)
        if not os.path.exists(path):
            continue
        result = subprocess.run(['node', '--check', path], capture_output=True, text=True)
        if result.returncode != 0:
            fail('%s has a JavaScript syntax error: %s'
                 % (relative, result.stderr.strip().split('\n')[0]))


def check_firebase_config():
    for relative in ('firebase/firestore.rules', 'firebase/storage.rules',
                     'firebase/firebase.json', 'firebase/firestore.indexes.json',
                     'firebase/.firebaserc'):
        if not os.path.exists(os.path.join(ROOT, relative)):
            fail('%s is missing' % relative)

    for relative in ('firebase/firebase.json', 'firebase/firestore.indexes.json',
                     'firebase/.firebaserc'):
        path = os.path.join(ROOT, relative)
        if not os.path.exists(path):
            continue
        try:
            json.loads(read(path))
        except json.JSONDecodeError as error:
            fail('%s is not valid JSON: %s' % (relative, error))

    rules = read(os.path.join(ROOT, 'firebase/firestore.rules'))
    for token in ("rules_version = '2'", 'allow read: if true', 'isAdmin()',
                  'match /books/{bookId}', 'match /papers/{paperId}'):
        if token not in rules:
            fail('firestore.rules is missing "%s"' % token)
    storage = read(os.path.join(ROOT, 'firebase/storage.rules'))
    for token in ('pdfs/{fileName}', 'covers/{fileName}', 'isAdmin()'):
        if token not in storage:
            fail('storage.rules is missing "%s"' % token)


def check_python_tools():
    for relative in ('tools/seed/generate_demo_data.py', 'tools/seed/generate_icons.py',
                     'tools/verify_project.py'):
        path = os.path.join(ROOT, relative)
        if not os.path.exists(path):
            fail('%s is missing' % relative)
            continue
        result = subprocess.run([sys.executable, '-m', 'py_compile', path],
                                capture_output=True, text=True)
        if result.returncode != 0:
            fail('%s does not compile: %s' % (relative, result.stderr.strip().split('\n')[-1]))


# ---------------------------------------------------------------------------
# 7. Docs and repository hygiene
# ---------------------------------------------------------------------------
def check_docs():
    required = ['README.md', 'LICENSE', '.gitignore', '.github/workflows/ci.yml',
                'docs/FIREBASE_SETUP.md', 'docs/ADMIN_PANEL.md', 'docs/ARCHITECTURE.md',
                'docs/PDF_VIEWER.md', 'docs/BUILD_AND_RELEASE.md', 'docs/CONTRIBUTING.md',
                'docs/BUILD_ORDER.md']
    for relative in required:
        if not os.path.exists(os.path.join(ROOT, relative)):
            fail('%s is missing' % relative)

    readme = read(os.path.join(ROOT, 'README.md'))
    for match in re.findall(r'`(docs/[A-Za-z_]+\.md)`', readme):
        if not os.path.exists(os.path.join(ROOT, match)):
            fail('README.md links to %s which does not exist' % match)
    for match in re.findall(r'`(app/[A-Za-z0-9_/\.]+\.(?:dart|json|pdf))`', readme):
        if not os.path.exists(os.path.join(ROOT, match)) and '/' not in match[4:]:
            fail('README.md references %s which does not exist' % match)

    gitignore = read(os.path.join(ROOT, '.gitignore'))
    for pattern in ('google-services.json', 'key.properties', 'build/', '*-adminsdk-*.json'):
        if pattern not in gitignore:
            fail('.gitignore does not exclude %s' % pattern)


def check_test_coverage_of_core_layers():
    tests = dart_files('test')
    if len(tests) < 8:
        fail('expected at least 8 test files, found %d' % len(tests))
    suites = ' '.join(os.path.basename(path) for path in tests)
    for expected in ('book_model', 'paper_model', 'catalog_filter', 'local_stores',
                     'catalog_repository', 'controllers', 'localization',
                     'demo_catalog', 'app_smoke'):
        if expected not in suites:
            fail('no test file covers %s' % expected)


# ---------------------------------------------------------------------------
def main():
    lib_files = dart_files('lib')
    test_files = dart_files('test')
    all_dart = lib_files + test_files

    if len(lib_files) < 30:
        fail('only %d Dart files under lib/ - is the checkout complete?' % len(lib_files))

    check_pubspec()
    check_dart_files(all_dart)
    check_imports(all_dart)
    check_unused_imports(all_dart)
    check_library_imports(all_dart)
    check_provider_imports(all_dart)
    check_localizations()
    check_demo_data()
    check_pdf()
    check_pngs()
    check_android()
    check_admin()
    check_node_syntax()
    check_firebase_config()
    check_python_tools()
    check_docs()
    check_test_coverage_of_core_layers()

    if not QUIET:
        print('EduLanka project verification')
        print('-' * 66)
        print('Dart files      : %d in lib/, %d in test/' % (len(lib_files), len(test_files)))
        for message in notes:
            print('note            : %s' % message)
        print('-' * 66)

    if problems:
        print('%d problem(s) found:' % len(problems))
        for message in problems:
            print('  ✗ %s' % message)
        return 1

    print('✓ everything checks out (17 checks, %d Dart files)' % len(all_dart))
    return 0


if __name__ == '__main__':
    sys.exit(main())
