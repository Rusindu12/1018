import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/app_providers.dart';
import '../../core/providers/library_providers.dart';
import '../../core/router/app_router.dart';
import '../../core/utils/cover_cache_manager.dart';
import '../../data/models/book.dart';
import '../../data/sources/catalog_local_source.dart';
import '../books/providers/books_providers.dart';
import '../papers/providers/papers_providers.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_snackbar.dart';
import 'widgets/settings_tile.dart';

/// Settings tab: appearance, language, storage, data source and about links.
///
/// Everything here is device-local - the app has no accounts, so there is
/// nothing to log out of and no data to sync.
class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final SettingsState settings = ref.watch(settingsProvider);
    final bool demoMode = ref.watch(demoModeProvider);
    final int downloadCount = ref.watch(downloadsProvider).valueOrNull?.length ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: <Widget>[
          if (demoMode) const _DemoModeBanner(),
          SettingsSection(
            title: l10n.settingsAppearance,
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(l10n.settingsTheme, style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: 10),
                    SegmentedButton<ThemeMode>(
                      segments: <ButtonSegment<ThemeMode>>[
                        ButtonSegment<ThemeMode>(
                          value: ThemeMode.system,
                          label: Text(l10n.settingsThemeSystem),
                          icon: const Icon(Icons.brightness_auto_outlined),
                        ),
                        ButtonSegment<ThemeMode>(
                          value: ThemeMode.light,
                          label: Text(l10n.settingsThemeLight),
                          icon: const Icon(Icons.light_mode_outlined),
                        ),
                        ButtonSegment<ThemeMode>(
                          value: ThemeMode.dark,
                          label: Text(l10n.settingsThemeDark),
                          icon: const Icon(Icons.dark_mode_outlined),
                        ),
                      ],
                      selected: <ThemeMode>{settings.themeMode},
                      showSelectedIcon: false,
                      onSelectionChanged: (Set<ThemeMode> selection) => ref
                          .read(settingsProvider.notifier)
                          .setThemeMode(selection.first),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SettingsSection(
            title: l10n.settingsLanguage,
            children: <Widget>[
              RadioListTile<String>(
                value: 'system',
                groupValue: settings.isSystemLanguage ? 'system' : settings.language!.code,
                title: Text(l10n.settingsThemeSystem),
                subtitle: Text(l10n.settingsLanguageSub),
                onChanged: (_) => ref.read(settingsProvider.notifier).setLanguage(null),
              ),
              for (final AppLanguage language in AppLanguage.values)
                RadioListTile<String>(
                  value: language.code,
                  groupValue: settings.isSystemLanguage ? 'system' : settings.language!.code,
                  title: Text(language.nativeLabel),
                  onChanged: (_) =>
                      ref.read(settingsProvider.notifier).setLanguage(language),
                ),
            ],
          ),
          SettingsSection(
            title: l10n.settingsData,
            children: <Widget>[
              SettingsTile(
                icon: Icons.cloud_outlined,
                title: l10n.settingsDataSource,
                subtitle: demoMode
                    ? l10n.settingsDemoMode
                    : (AppConfig.firebaseStatus.isEmpty
                        ? l10n.settingsFirebaseConnected
                        : AppConfig.firebaseStatus),
                trailing: Icon(
                  demoMode ? Icons.science_outlined : Icons.cloud_done_outlined,
                  color: Theme.of(context).colorScheme.outline,
                ),
              ),
              SettingsTile(
                icon: Icons.download_done_outlined,
                title: l10n.downloadsTitle,
                subtitle: l10n.itemsCount(downloadCount),
                onTap: () => AppRouter.openDownloads(context),
              ),
              SettingsTile(
                icon: Icons.refresh,
                title: l10n.settingsRefreshData,
                onTap: () async {
                  await ref.read(catalogRepositoryProvider).refresh();
                  ref.invalidate(booksProvider);
                  ref.invalidate(papersProvider);
                  if (!context.mounted) return;
                  AppSnackBar.show(context, message: l10n.settingsRefreshed);
                },
              ),
              SettingsTile(
                icon: Icons.image_outlined,
                title: l10n.settingsClearCache,
                subtitle: l10n.settingsClearCacheSub,
                onTap: () async {
                  // Covers have their own cache (CoverCacheManager); wipe the
                  // default manager too in case another widget ever caches art.
                  await CoverCacheManager.clear();
                  await DefaultCacheManager().emptyCache();
                  if (!context.mounted) return;
                  AppSnackBar.show(context, message: l10n.settingsCacheCleared);
                },
              ),
              SettingsTile(
                icon: Icons.history,
                title: l10n.settingsClearSearchHistory,
                onTap: () async {
                  await ref.read(searchHistoryProvider.notifier).clear();
                  if (!context.mounted) return;
                  AppSnackBar.show(context, message: l10n.settingsCacheCleared);
                },
              ),
              SettingsTile(
                icon: Icons.restart_alt,
                title: l10n.settingsClearData,
                onTap: () => _confirmReset(context, ref),
              ),
            ],
          ),
          if (demoMode)
            SettingsSection(
              title: l10n.settingsAbout,
              children: <Widget>[
                SettingsTile(
                  icon: Icons.picture_as_pdf_outlined,
                  title: 'Sample PDF',
                  subtitle: l10n.viewerOpenExternal,
                  onTap: () => _openSamplePdf(context, ref),
                ),
              ],
            ),
          SettingsSection(
            title: l10n.settingsAbout,
            children: <Widget>[
              SettingsTile(
                icon: Icons.info_outline,
                title: l10n.settingsAbout,
                subtitle: l10n.settingsAboutSub,
                onTap: () => AppRouter.openAbout(context),
              ),
              SettingsTile(
                icon: Icons.privacy_tip_outlined,
                title: l10n.settingsPrivacyPolicy,
                onTap: () => AppRouter.openPrivacy(context),
              ),
              SettingsTile(
                icon: Icons.article_outlined,
                title: l10n.settingsLicenses,
                onTap: () => showLicensePage(
                  context: context,
                  applicationName: AppConfig.appName,
                  applicationVersion: ref.read(appVersionProvider).valueOrNull,
                ),
              ),
              SettingsTile(
                icon: Icons.code,
                title: l10n.settingsSourceCode,
                subtitle: AppConfig.sourceCodeUrl,
                onTap: () => _launch(context, AppConfig.sourceCodeUrl),
              ),
              SettingsTile(
                icon: Icons.mail_outline,
                title: l10n.settingsReportProblem,
                subtitle: AppConfig.contactEmail,
                onTap: () => _launch(
                  context,
                  'mailto:${AppConfig.contactEmail}?subject=EduLanka feedback',
                ),
              ),
              SettingsTile(
                icon: Icons.star_outline,
                title: l10n.settingsRateApp,
                onTap: () => _launch(
                  context,
                  'https://play.google.com/store/apps/details?id=com.edulanka.app',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Opens the bundled sample PDF so users (and reviewers) can try the viewer
  /// without downloading anything.
  Future<void> _openSamplePdf(BuildContext context, WidgetRef ref) async {
    try {
      final CatalogLocalSource source = ref.read(catalogLocalSourceProvider);
      final String path = (await source.ensureSamplePdf()).path;
      if (!context.mounted) return;
      await AppRouter.openViewer(
        context,
        item: BookModel(
          id: 'sample',
          title: 'Sample paper',
          grade: 0,
          subject: 'Mathematics',
          medium: 'English',
          pdfUrl: AppConfig.samplePdfAsset,
          fileSize: '—',
        ),
        localPath: path,
      );
    } catch (error) {
      if (!context.mounted) return;
      AppSnackBar.error(context, error);
    }
  }

  Future<void> _confirmReset(BuildContext context, WidgetRef ref) async {
    final AppLocalizations l10n = context.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext context) => AlertDialog(
        title: Text(l10n.settingsClearData),
        content: Text(l10n.settingsClearDataBody),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.commonDelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(localStoreProvider).resetAppData();
    await ref.read(favoritesProvider.notifier).clearAll();
    await ref.read(searchHistoryProvider.notifier).clear();
    await ref.read(bookmarksProvider.notifier).clearAll();
    if (!context.mounted) return;
    AppSnackBar.show(context, message: l10n.settingsDataReset);
  }

  Future<void> _launch(BuildContext context, String url) async {
    final AppLocalizations l10n = context.l10n;
    final bool ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      AppSnackBar.show(context, message: l10n.errorUnknown, isError: true);
    }
  }
}

/// Yellow strip explaining that this build runs on the bundled demo catalogue.
class _DemoModeBanner extends StatelessWidget {
  const _DemoModeBanner();

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: AppCard(
        color: const Color(0xFFFFF3E0),
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Icon(Icons.science_outlined, color: Color(0xFFEF6C00)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    l10n.settingsDemoMode,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF8D4E00),
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.settingsDemoModeSub,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF8D4E00),
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
