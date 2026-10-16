import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// The one card style used across EduLanka.
///
/// Wraps [Material] + [InkWell] so every card gets the same radius, border and
/// ripple, and so it works identically on light and dark themes.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.onLongPress,
    this.padding = const EdgeInsets.all(12),
    this.margin = EdgeInsets.zero,
    this.color,
  });

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius = BorderRadius.circular(16);
    return Padding(
      padding: margin,
      child: Material(
        color: color ?? AppTheme.cardDecoration(context).color,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(
            color: Theme.of(context).brightness == Brightness.dark
                ? const Color(0xFF283130)
                : const Color(0xFFE3E8E6),
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          onLongPress: onLongPress,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}
