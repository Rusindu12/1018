import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/providers/app_providers.dart';
import 'data/sources/local_store.dart';

/// EduLanka entry point.
///
/// Startup order matters:
///   1. preferences (favourites/downloads indices must be readable immediately),
///   2. Firebase - *optional*: when no project is configured the app switches to
///      the bundled demo catalogue instead of failing (see [AppConfig.demoMode]),
///   3. run the app.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 1. Local storage ------------------------------------------------------
  final LocalStore localStore = await LocalStore.open();

  // 2. Firebase (never fatal) ---------------------------------------------
  await _initialiseFirebase();

  runApp(
    ProviderScope(
      // The only override in the app: everything else builds on top of it.
      overrides: <Override>[localStoreProvider.overrideWithValue(localStore)],
      child: const EduLankaApp(),
    ),
  );
}

/// Boots Firebase when the project is configured and degrades to demo mode when
/// it is not, so a fresh clone always runs.
///
/// Android/iOS configuration lives in `google-services.json` /
/// `GoogleService-Info.plist`, which is why `Firebase.initializeApp()` is called
/// without explicit options. See docs/FIREBASE_SETUP.md for the 3 steps, and for
/// how to use `flutterfire configure` + `DefaultFirebaseOptions` instead.
Future<void> _initialiseFirebase() async {
  if (AppConfig.forceDemo) {
    AppConfig.firebaseReady = false;
    AppConfig.firebaseStatus = 'Demo mode forced by --dart-define=FORCE_DEMO=true';
    return;
  }
  try {
    await Firebase.initializeApp();
    AppConfig.firebaseReady = true;
    AppConfig.firebaseStatus = 'Firebase connected';
    // Anonymous sign-in is optional: the Firestore rules in this repo allow
    // public reads, so the app works signed-out too. Enable it here if you
    // tighten the rules to "authenticated users only".
    // await FirebaseAuth.instance.signInAnonymously();
  } catch (error) {
    AppConfig.firebaseReady = false;
    AppConfig.firebaseStatus = 'Not configured – using bundled demo catalogue';
    if (kDebugMode) {
      debugPrint(
        'Firebase not initialised ($error). EduLanka will run on the bundled '
        'demo catalogue. See docs/FIREBASE_SETUP.md.',
      );
    }
  }
}
