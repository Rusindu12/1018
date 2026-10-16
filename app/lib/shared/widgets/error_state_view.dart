import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/errors/app_exception.dart';
import '../../l10n/app_localizations.dart';

/// Friendly, translated error screen for [AppException]s.
///
/// The raw technical detail is only shown in debug builds (and behind a
/// collapsible section) so a student never has to read a stack trace.
class ErrorStateView extends StatelessWidget {
  const ErrorStateView({
    super.key,
    required this.error,
    this.onRetry,
    this.compact = false,
  });

  /// Either an [AppException] or anything throwable - it is normalised here.
  final Object error;

  final VoidCallback? onRetry;

  /// Compact mode is used for inline errors (list footers, cards).
  final bool compact;

  AppException get _exception => AppException.from(error);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = context.l10n;
    final ColorScheme colors = Theme.of(context).colorScheme;
    final AppException exception = _exception;

    final (IconData icon, String title, String hint) = _describe(exception, l10n);

    if (compact) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: <Widget>[
            Icon(icon, color: colors.error),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: Theme.of(context).textTheme.bodyMedium)),
            if (onRetry != null && exception.retryable)
              TextButton(onPressed: onRetry, child: Text(l10n.commonRetry)),
          ],
        ),
      );
    }

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: colors.errorContainer.withValues(alpha: 0.6),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: colors.error),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              hint,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.onSurfaceVariant),
            ),
            if (onRetry != null && exception.retryable) ...<Widget>[
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: Text(l10n.errorRetry),
              ),
            ],
            if (kDebugMode && exception.technical != null) ...<Widget>[
              const SizedBox(height: 24),
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  title: Text(l10n.errorTechnical, style: Theme.of(context).textTheme.labelLarge),
                  childrenPadding: const EdgeInsets.all(12),
                  children: <Widget>[
                    SelectableText(
                      exception.debugLabel,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Icon + translated title + hint for each failure kind.
  (IconData, String, String) _describe(AppException exception, AppLocalizations l10n) {
    switch (exception.kind) {
      case AppErrorKind.network:
        return (Icons.wifi_off_rounded, l10n.errorNetwork, l10n.errorNetworkHint);
      case AppErrorKind.notFound:
        return (Icons.search_off_rounded, l10n.errorNotFound, l10n.errorNotFoundHint);
      case AppErrorKind.permission:
        return (Icons.lock_outline_rounded, l10n.errorPermission, l10n.errorPermissionHint);
      case AppErrorKind.storage:
        return (Icons.sd_card_alert_outlined, l10n.errorStorage, l10n.errorStorageHint);
      case AppErrorKind.corruptFile:
        return (Icons.description_outlined, l10n.errorCorrupt, l10n.errorCorruptHint);
      case AppErrorKind.missingIndex:
        return (Icons.schema_outlined, l10n.errorMissingIndex, l10n.errorMissingIndexHint);
      case AppErrorKind.cancelled:
      case AppErrorKind.unknown:
        return (Icons.error_outline_rounded, l10n.errorUnknown, l10n.errorUnknownHint);
    }
  }
}
