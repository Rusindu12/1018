import 'package:flutter/material.dart';

import 'app.dart';
import 'data/binance/app_preferences_store.dart';
import 'security/credential_store.dart';
import 'state/trading_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final credentials = CredentialStore();
  final controller = TradingController(
    credentialStore: credentials,
    preferences: AppPreferencesStore(),
  );
  await controller.initialize();
  runApp(BinanceAiDeskApp(controller: controller));
}
