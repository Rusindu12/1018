import 'package:flutter/material.dart';

class AppColors {
  static const background = Color(0xFF0B1110);
  static const surface = Color(0xFF121B19);
  static const surfaceRaised = Color(0xFF182320);
  static const mint = Color(0xFFB5F56B);
  static const teal = Color(0xFF53D6C1);
  static const red = Color(0xFFFF737B);
  static const muted = Color(0xFF92A39D);
  static const grid = Color(0xFF273531);
}

class AppTheme {
  static ThemeData get dark {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.mint,
      brightness: Brightness.dark,
      surface: AppColors.surface,
    ).copyWith(
      primary: AppColors.mint,
      secondary: AppColors.teal,
      error: AppColors.red,
      surface: AppColors.surface,
      onSurface: const Color(0xFFEAF1ED),
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceRaised,
        border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(14))),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: AppColors.grid),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          borderSide: BorderSide(color: AppColors.mint, width: 1.4),
        ),
      ),
      dividerColor: AppColors.grid,
      snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }
}
