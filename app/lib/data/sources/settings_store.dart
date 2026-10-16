import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import 'local_store.dart';

/// Theme mode + UI language, persisted between launches.
class SettingsStore {
  SettingsStore(this._local);

  final LocalStore _local;

  ThemeMode loadThemeMode() {
    switch (_local.getString(LocalKeys.themeMode)) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> saveThemeMode(ThemeMode mode) =>
      _local.setString(LocalKeys.themeMode, mode.name);

  /// Returns null when the user never picked a language (follow the device).
  AppLanguage? loadLanguage() {
    final String? code = _local.getString(LocalKeys.language);
    if (code == null || !AppLanguage.codes.contains(code)) return null;
    return AppLanguage.fromCode(code);
  }

  Future<void> saveLanguage(AppLanguage language) =>
      _local.setString(LocalKeys.language, language.code);
}
