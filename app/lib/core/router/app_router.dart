import 'package:flutter/material.dart';

import '../../data/models/catalog_item.dart';
import '../../features/books/books_page.dart';
import '../../features/downloads/downloads_page.dart';
import '../../features/favorites/favorites_page.dart';
import '../../features/home/app_shell.dart';
import '../../features/papers/papers_page.dart';
import '../../features/search/search_page.dart';
import '../../features/settings/about_page.dart';
import '../../features/settings/privacy_policy_page.dart';
import '../../features/settings/settings_page.dart';
import '../../features/splash/splash_page.dart';
import '../../features/viewer/pdf_viewer_page.dart';

/// Every route name in the app. Kept in one place so deep links, the bottom
/// navigation bar and `Navigator.pushNamed` calls cannot drift apart.
class AppRoutes {
  AppRoutes._();

  static const String splash = '/';
  static const String home = '/home';
  static const String books = '/books';
  static const String papers = '/papers';
  static const String search = '/search';
  static const String favorites = '/favorites';
  static const String downloads = '/downloads';
  static const String settings = '/settings';
  static const String viewer = '/viewer';
  static const String about = '/about';
  static const String privacy = '/privacy';
}

/// Arguments accepted by [AppRoutes.viewer].
class ViewerArgs {
  const ViewerArgs({
    required this.item,
    this.localPath,
    this.initialPage = 1,
  });

  final CatalogItem item;

  /// Set when the PDF was downloaded (or copied from the bundled sample), so
  /// the viewer skips the network entirely.
  final String? localPath;

  /// Bookmarked page to jump to.
  final int initialPage;
}

/// Central navigation: keeps `MaterialApp.onGenerateRoute` and all the typed
/// push helpers together, so widgets never build routes by hand.
class AppRouter {
  AppRouter._();

  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    final Object? args = settings.arguments;
    switch (settings.name) {
      case AppRoutes.splash:
        return _page(const SplashPage(), settings.name!);
      case AppRoutes.home:
        return _page(const AppShell(), settings.name!);
      case AppRoutes.books:
        return _page(const BooksPage(), settings.name!);
      case AppRoutes.papers:
        return _page(const PapersPage(), settings.name!);
      case AppRoutes.search:
        return _page(const SearchPage(), settings.name!);
      case AppRoutes.favorites:
        return _page(const FavoritesPage(), settings.name!);
      case AppRoutes.downloads:
        return _page(const DownloadsPage(), settings.name!);
      case AppRoutes.settings:
        return _page(const SettingsPage(), settings.name!);
      case AppRoutes.about:
        return _page(const AboutPage(), settings.name!);
      case AppRoutes.privacy:
        return _page(const PrivacyPolicyPage(), settings.name!);
      case AppRoutes.viewer:
        final ViewerArgs? viewerArgs = args is ViewerArgs ? args : null;
        if (viewerArgs == null) {
          return _page(const _MissingArgumentsPage(routeName: AppRoutes.viewer), settings.name!);
        }
        return _page(
          PdfViewerPage(
            item: viewerArgs.item,
            localPath: viewerArgs.localPath,
            initialPage: viewerArgs.initialPage,
          ),
          settings.name!,
        );
      default:
        return _page(_MissingArgumentsPage(routeName: settings.name ?? '?'), settings.name ?? '?');
    }
  }

  /// Material page route with the platform transition, named for analytics.
  static MaterialPageRoute<dynamic> _page(Widget child, String name) =>
      MaterialPageRoute<dynamic>(builder: (_) => child, settings: RouteSettings(name: name));

  // ----------------------------------------------------------- typed helpers
  static Future<void> openViewer(
    BuildContext context, {
    required CatalogItem item,
    String? localPath,
    int initialPage = 1,
  }) {
    return Navigator.of(context).pushNamed(
      AppRoutes.viewer,
      arguments: ViewerArgs(item: item, localPath: localPath, initialPage: initialPage),
    );
  }

  static Future<void> openSearch(BuildContext context) =>
      Navigator.of(context).pushNamed(AppRoutes.search);

  static Future<void> openFavorites(BuildContext context) =>
      Navigator.of(context).pushNamed(AppRoutes.favorites);

  static Future<void> openDownloads(BuildContext context) =>
      Navigator.of(context).pushNamed(AppRoutes.downloads);

  static Future<void> openAbout(BuildContext context) =>
      Navigator.of(context).pushNamed(AppRoutes.about);

  static Future<void> openPrivacy(BuildContext context) =>
      Navigator.of(context).pushNamed(AppRoutes.privacy);
}

/// Shown when a named route is reached without its arguments (e.g. a malformed
/// deep link). Better than a red error screen in release builds.
class _MissingArgumentsPage extends StatelessWidget {
  const _MissingArgumentsPage({required this.routeName});

  final String routeName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(routeName)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.link_off, size: 48, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 16),
              Text(
                'This link is incomplete.\nOpen EduLanka from the app icon instead.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
