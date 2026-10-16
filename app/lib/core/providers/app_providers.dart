import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../data/repositories/catalog_repository.dart';
import '../../data/repositories/download_repository.dart';
import '../../data/sources/catalog_local_source.dart';
import '../../data/sources/catalog_remote_source.dart';
import '../../data/sources/downloads_store.dart';
import '../../data/sources/local_store.dart';
import '../../data/sources/settings_store.dart';
import '../../l10n/app_localizations.dart';
import '../config/app_config.dart';

/// SharedPreferences wrapper, opened once in `main()`.
///
/// It throws if it is ever read without an override, which turns a wiring
/// mistake into an immediate, obvious failure instead of a silent race.
final Provider<LocalStore> localStoreProvider = Provider<LocalStore>(
  (Ref ref) => throw StateError(
    'localStoreProvider must be overridden in ProviderScope (see main.dart)',
  ),
);

final Provider<SettingsStore> settingsStoreProvider = Provider<SettingsStore>(
  (Ref ref) => SettingsStore(ref.watch(localStoreProvider)),
);

final Provider<DownloadsStore> downloadsStoreProvider = Provider<DownloadsStore>(
  (Ref ref) => DownloadsStore(ref.watch(localStoreProvider)),
);

/// Catalogue reader. Firestore is only attached when Firebase really
/// initialised - otherwise the bundled demo catalogue is used, so the app never
/// shows a blank screen just because `firebase_options.dart` is missing.
final Provider<CatalogRepository> catalogRepositoryProvider = Provider<CatalogRepository>(
  (Ref ref) {
    final CatalogRepository repository = CatalogRepository(
      localStore: ref.watch(localStoreProvider),
      remote: AppConfig.demoMode ? null : CatalogRemoteSource(),
    );
    ref.onDispose(repository.dispose);
    return repository;
  },
);

final Provider<DownloadRepository> downloadRepositoryProvider = Provider<DownloadRepository>(
  (Ref ref) {
    final DownloadRepository repository = DownloadRepository(
      downloadsStore: ref.watch(downloadsStoreProvider),
    );
    ref.onDispose(repository.dispose);
    return repository;
  },
);

/// Extracts the bundled sample PDF. Used by the Settings "try the viewer" tile
/// and by the widget tests.
final Provider<CatalogLocalSource> catalogLocalSourceProvider =
    Provider<CatalogLocalSource>((Ref ref) => CatalogLocalSource());

// --------------------------------------------------------------------- theme
@immutable
class SettingsState {
  const SettingsState({required this.themeMode, this.language});

  final ThemeMode themeMode;

  /// `null` = follow the device language.
  final AppLanguage? language;

  bool get isSystemLanguage => language == null;

  SettingsState copyWith({ThemeMode? themeMode, Object? language = _keepLanguage}) {
    return SettingsState(
      themeMode: themeMode ?? this.themeMode,
      language: identical(language, _keepLanguage) ? this.language : language as AppLanguage?,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is SettingsState && other.themeMode == themeMode && other.language == language;

  @override
  int get hashCode => Object.hash(themeMode, language);
}

const Object _keepLanguage = Object();

class SettingsController extends Notifier<SettingsState> {
  SettingsStore get _store => ref.read(settingsStoreProvider);

  @override
  SettingsState build() {
    final SettingsStore store = ref.watch(settingsStoreProvider);
    return SettingsState(
      themeMode: store.loadThemeMode(),
      language: store.loadLanguage(),
    );
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = state.copyWith(themeMode: mode);
    await _store.saveThemeMode(mode);
  }

  /// Light <-> dark, used by the quick toggle in Settings and the PDF viewer.
  Future<void> toggleDarkMode() {
    final ThemeMode next =
        state.themeMode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    return setThemeMode(next);
  }

  /// `null` selects "System default" and clears the stored code.
  Future<void> setLanguage(AppLanguage? language) async {
    state = state.copyWith(language: language);
    if (language == null) {
      await _store.saveLanguage(resolveSystemLanguage());
      return;
    }
    await _store.saveLanguage(language);
  }

  /// Detected once so tests can stub the platform dispatcher.
  static AppLanguage resolveSystemLanguage() =>
      AppLanguage.fromLocale(WidgetsBinding.instance.platformDispatcher.locale);
}

final NotifierProvider<SettingsController, SettingsState> settingsProvider =
    NotifierProvider<SettingsController, SettingsState>(SettingsController.new);

// -------------------------------------------------------------- connectivity
/// `true` when the device has a network path. Used for the offline banner and
/// to skip network writes - never to block local reads (offline first).
final StreamProvider<bool> connectivityProvider = StreamProvider<bool>((Ref ref) async* {
  final Connectivity connectivity = Connectivity();
  bool isOnline(List<ConnectivityResult> results) =>
      results.any((ConnectivityResult result) => result != ConnectivityResult.none);

  try {
    yield isOnline(await connectivity.checkConnectivity());
    // connectivity_plus 6.x reports a *list* of active transports.
    yield* connectivity.onConnectivityChanged.map(isOnline);
  } catch (_) {
    // Some OEM builds throw when ACCESS_NETWORK_STATE is missing. Assuming
    // "online" keeps the download buttons usable instead of hiding them.
    yield true;
  }
});

/// Synchronous convenience wrapper with a safe default.
final Provider<bool> isOnlineProvider =
    Provider<bool>((Ref ref) => ref.watch(connectivityProvider).valueOrNull ?? true);

// ------------------------------------------------------------- about/version
final FutureProvider<String> appVersionProvider = FutureProvider<String>((Ref ref) async {
  try {
    final PackageInfo info = await PackageInfo.fromPlatform();
    return '${info.version} (${info.buildNumber})';
  } catch (_) {
    return '1.0.0';
  }
});

/// Exposes [AppConfig.demoMode] to the UI (Settings shows which source is live).
final Provider<bool> demoModeProvider = Provider<bool>((Ref ref) => AppConfig.demoMode);
