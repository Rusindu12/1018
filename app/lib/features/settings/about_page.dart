import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_card.dart';
import '../../shared/widgets/app_snackbar.dart';
import '../splash/splash_page.dart';
import 'widgets/settings_tile.dart';

/// About screen: version, what the app offers, and how to contribute.
class AboutPage extends ConsumerWidget {
  const AboutPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = context.l10n;
    final String version = ref.watch(appVersionProvider).valueOrNull ?? '…';

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsAbout)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        children: <Widget>[
          Center(
            child: Column(
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const AppLogo(size: 72),
                ),
                const SizedBox(height: 14),
                Text(
                  AppConfig.appName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${l10n.settingsVersion} $version',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                ),
                const SizedBox(height: 12),
                Text(
                  l10n.aboutTagline,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          SettingsSection(
            title: l10n.aboutFeatures,
            children: <Widget>[
              _Feature(icon: Icons.menu_book_outlined, text: l10n.aboutFeatureBooks),
              _Feature(icon: Icons.description_outlined, text: l10n.aboutFeaturePapers),
              _Feature(icon: Icons.offline_pin_outlined, text: l10n.aboutFeatureOffline),
              _Feature(icon: Icons.block_outlined, text: l10n.aboutFeatureFree),
              _Feature(icon: Icons.code, text: l10n.aboutFeatureOpen),
            ],
          ),
          SettingsSection(
            title: l10n.settingsAbout,
            children: <Widget>[
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
                  applicationVersion: version,
                ),
              ),
              SettingsTile(
                icon: Icons.favorite_outline,
                title: l10n.aboutContribute,
                subtitle: AppConfig.sourceCodeUrl,
                onTap: () async {
                  final bool ok = await launchUrl(
                    Uri.parse(AppConfig.sourceCodeUrl),
                    mode: LaunchMode.externalApplication,
                  );
                  if (!ok && context.mounted) {
                    AppSnackBar.show(context, message: l10n.errorUnknown, isError: true);
                  }
                },
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: AppCard(
              padding: const EdgeInsets.all(16),
              child: Text(
                '© ${DateTime.now().year} ${AppConfig.appName} contributors · Apache-2.0',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
      title: Text(text),
    );
  }
}
