import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/config/app_config.dart';
import 'core/providers/app_providers.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'l10n/app_localizations.dart';

/// Root widget: theme, locale plumbing and the named-route table.
class EduLankaApp extends ConsumerWidget {
  const EduLankaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final SettingsState settings = ref.watch(settingsProvider);

    return MaterialApp(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: settings.themeMode,
      // null = follow the device language (resolved against supportedLocales).
      locale: settings.language?.locale,
      supportedLocales: AppLanguage.supportedLocales,
      localizationsDelegates: const <LocalizationsDelegate<Object>>[
        AppLocalizationsDelegate(),
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      initialRoute: AppRoutes.splash,
      onGenerateRoute: AppRouter.onGenerateRoute,
      // Keeps huge system font settings from destroying the layout while still
      // honouring accessibility scaling.
      builder: (BuildContext context, Widget? child) => MediaQuery.withClampedTextScaling(
        minScaleFactor: 0.9,
        maxScaleFactor: 1.6,
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
