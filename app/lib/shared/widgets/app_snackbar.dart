import 'package:flutter/material.dart';

import '../../core/errors/app_exception.dart';
import '../../l10n/app_localizations.dart';

/// Consistent, translated toast messages.
///
/// Centralising them means an error shown from the viewer and the same error
/// shown from the downloads list always read identically.
class AppSnackBar {
  AppSnackBar._();

  static void show(
    BuildContext context, {
    required String message,
    String? actionLabel,
    VoidCallback? onAction,
    bool isError = false,
    Duration duration = const Duration(seconds: 3),
  }) {
    final ColorScheme colors = Theme.of(context).colorScheme;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          duration: duration,
          backgroundColor: isError ? colors.errorContainer : null,
          action: actionLabel != null && onAction != null
              ? SnackBarAction(
                  label: actionLabel,
                  textColor: isError ? colors.onErrorContainer : null,
                  onPressed: onAction,
                )
              : null,
        ),
      );
  }

  static void error(BuildContext context, Object error) {
    final AppException exception = AppException.from(error);
    if (exception.kind == AppErrorKind.cancelled) return;
    show(context, message: messageFor(exception, context.l10n), isError: true);
  }

  /// Translated one-liner for an [AppException] (no hints, no details).
  static String messageFor(AppException exception, AppLocalizations l10n) {
    switch (exception.kind) {
      case AppErrorKind.network:
        return l10n.errorNetwork;
      case AppErrorKind.notFound:
        return l10n.errorNotFound;
      case AppErrorKind.permission:
        return l10n.errorPermission;
      case AppErrorKind.storage:
        return l10n.errorStorage;
      case AppErrorKind.corruptFile:
        return l10n.errorCorrupt;
      case AppErrorKind.missingIndex:
        return l10n.errorMissingIndex;
      case AppErrorKind.cancelled:
      case AppErrorKind.unknown:
        return l10n.errorUnknown;
    }
  }
}
