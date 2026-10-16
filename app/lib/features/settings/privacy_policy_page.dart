import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/app_config.dart';
import '../../l10n/app_localizations.dart';
import '../../shared/widgets/app_snackbar.dart';
import 'widgets/settings_tile.dart';

/// Plain-language privacy policy.
///
/// Written as UI text rather than a remote web page so it works offline and
/// cannot go stale - Play Store also accepts an in-app policy for apps that
/// collect nothing.
class PrivacyPolicyPage extends StatelessWidget {
  const PrivacyPolicyPage({super.key});

  /// Update this together with [AppConfig.appName] releases.
  static const String policyVersion = '1.0';

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsPrivacyPolicy)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: <Widget>[
          Text(
            '${AppConfig.appName} · ${l10n.settingsVersion} $policyVersion',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 14),
          Text(l10n.privacyIntro, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          _Section(title: l10n.privacyLocalTitle, body: l10n.privacyLocalBody),
          _Section(title: l10n.privacyNetworkTitle, body: l10n.privacyNetworkBody),
          _Section(title: l10n.privacyFilesTitle, body: l10n.privacyFilesBody),
          _Section(title: l10n.privacyContactTitle, body: l10n.privacyContactBody),
          // The same policy published on the web - Play Store listings ask for a
          // URL, and this keeps the two in one place (AppConfig.privacyPolicyUrl).
          SettingsSection(
            title: l10n.settingsPrivacyPolicy,
            children: <Widget>[
              SettingsTile(
                icon: Icons.open_in_new,
                title: AppConfig.privacyPolicyUrl,
                subtitle: l10n.viewerOpenExternal,
                onTap: () async {
                  final bool opened = await launchUrl(
                    Uri.parse(AppConfig.privacyPolicyUrl),
                    mode: LaunchMode.externalApplication,
                  );
                  if (!opened && context.mounted) {
                    AppSnackBar.show(context, message: l10n.errorUnknown, isError: true);
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '${l10n.privacyUpdated}: 2026',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: SettingsSection(
        title: title,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.all(14),
            child: Text(body, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}
