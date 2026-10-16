import 'package:flutter/material.dart';

/// Material 3 themes for EduLanka.
///
/// Colours are derived from a single seed (`_seed`) so light/dark stay in sync.
/// The palette is Sri Lanka inspired: tea-green primary, gold accent.
class AppTheme {
  AppTheme._();

  static const Color seed = Color(0xFF00695C);
  static const Color accent = Color(0xFFF9A825);

  /// Used for the "marking scheme available" badge and O/L card.
  static const Color olColor = Color(0xFF1565C0);
  static const Color alColor = Color(0xFF6A1B9A);
  static const Color scholarshipColor = Color(0xFFEF6C00);
  static const Color termTestColor = Color(0xFF00838F);

  static ThemeData light() => _base(Brightness.light);

  static ThemeData dark() => _base(Brightness.dark);

  static ThemeData _base(Brightness brightness) {
    final bool isDark = brightness == Brightness.dark;
    final ColorScheme scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: brightness,
    ).copyWith(secondary: isDark ? const Color(0xFFFFD54F) : accent);

    final ThemeData base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      brightness: brightness,
      scaffoldBackgroundColor: isDark ? const Color(0xFF101413) : const Color(0xFFF7F9F8),
      visualDensity: VisualDensity.standard,
    );

    return base.copyWith(
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 2,
        backgroundColor: isDark ? const Color(0xFF101413) : const Color(0xFFF7F9F8),
        foregroundColor: scheme.onSurface,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w600,
          color: scheme.onSurface,
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        side: BorderSide(color: scheme.outlineVariant),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        labelStyle: base.textTheme.labelLarge,
        padding: const EdgeInsets.symmetric(horizontal: 6),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 3,
        height: 68,
        backgroundColor: isDark ? const Color(0xFF161C1B) : Colors.white,
        indicatorColor: scheme.primary.withValues(alpha: 0.16),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? const Color(0xFF1A201F) : Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.primary, width: 1.6),
        ),
      ),
      listTileTheme: ListTileThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        iconColor: scheme.primary,
      ),
      dividerTheme: DividerThemeData(
        color: isDark ? const Color(0xFF262E2D) : const Color(0xFFE7EBE9),
        space: 1,
        thickness: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: scheme.primary),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: isDark ? const Color(0xFF161C1B) : Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
      ),
    );
  }

  /// Card decoration used by [AppCard] (deliberately not `ThemeData.cardTheme`:
  /// that field changed type across recent Flutter releases, and keeping the
  /// style in one small widget is version-proof *and* easier to tweak).
  static BoxDecoration cardDecoration(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    return BoxDecoration(
      color: isDark ? const Color(0xFF1A201F) : Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(
        color: isDark ? const Color(0xFF283130) : const Color(0xFFE3E8E6),
      ),
    );
  }

  /// Night-mode colour filter used by the PDF viewer (inverts dark text on a
  /// white page without recolouring photos completely).
  static const List<double> nightModeMatrix = <double>[
    -0.9, 0, 0, 0, 235,
    0, -0.9, 0, 0, 235,
    0, 0, -0.9, 0, 235,
    0, 0, 0, 1, 0,
  ];
}
