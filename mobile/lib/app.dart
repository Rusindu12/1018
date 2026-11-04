import 'package:flutter/material.dart';

import 'state/trading_controller.dart';
import 'ui/app_shell.dart';
import 'ui/app_theme.dart';

class BinanceAiDeskApp extends StatelessWidget {
  const BinanceAiDeskApp({required this.controller, super.key});

  final TradingController controller;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Binance AI Desk',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      home: AppShell(controller: controller),
    );
  }
}
