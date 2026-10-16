import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config/app_config.dart';
import '../../core/providers/app_providers.dart';
import '../../core/router/app_router.dart';
import '../../l10n/app_localizations.dart';

/// Branded splash screen.
///
/// Waits [delay] (2 s) *and* for the first catalogue load, then replaces itself
/// with the shell. Because the catalogue is already warm, the Home screen has
/// real data the moment it appears - no spinner-then-empty flicker.
class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key, this.delay = const Duration(seconds: 2)});

  /// Overridable so widget tests do not have to wait two real seconds.
  final Duration delay;

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(widget.delay, _goHome);
    // Warm the catalogue in parallel with the splash animation. Errors are
    // ignored on purpose: the Home screen shows its own error state.
    unawaited(_warmUp());
  }

  Future<void> _warmUp() async {
    try {
      await ref.read(catalogRepositoryProvider).recentlyAdded(limit: 1);
    } catch (_) {
      // Handled by the screens.
    }
  }

  void _goHome() {
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(AppRoutes.home);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final ColorScheme colors = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: <Color>[
              colors.primary,
              Color.alphaBlend(colors.primary.withValues(alpha: 0.65), Colors.black),
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: <Widget>[
              const Spacer(flex: 3),
              ScaleTransition(
                scale: CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
                child: FadeTransition(
                  opacity: _controller,
                  child: const AppLogo(size: 108),
                ),
              ),
              const SizedBox(height: 22),
              Text(
                AppConfig.appName,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.4,
                    ),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40),
                child: Text(
                  l10n.homeSubtitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                ),
              ),
              const Spacer(flex: 2),
              SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white.withValues(alpha: 0.9)),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                l10n.splashLoading,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
              ),
              const SizedBox(height: 28),
              if (AppConfig.demoMode)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Chip(
                    label: Text(l10n.settingsDemoMode),
                    avatar: const Icon(Icons.science_outlined, size: 16),
                    backgroundColor: Colors.white.withValues(alpha: 0.18),
                    labelStyle: const TextStyle(color: Colors.white, fontSize: 11),
                    side: BorderSide(color: Colors.white.withValues(alpha: 0.35)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The EduLanka mark drawn with Flutter primitives (no image asset needed, so
/// it stays crisp at any size and adds nothing to the APK size).
class AppLogo extends StatelessWidget {
  const AppLogo({super.key, this.size = 96});

  final double size;

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(size * 0.28),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: size * 0.18,
            offset: Offset(0, size * 0.06),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: <Widget>[
          Icon(Icons.menu_book_rounded, size: size * 0.56, color: colors.primary),
          Positioned(
            bottom: size * 0.16,
            child: Container(
              width: size * 0.42,
              height: size * 0.045,
              decoration: BoxDecoration(
                color: colors.secondary,
                borderRadius: BorderRadius.circular(size),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
