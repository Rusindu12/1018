import 'package:firebase_core/firebase_core.dart';
import 'package:dio/dio.dart';

/// Every failure in the app funnels through this single type so screens only
/// have to render one friendly message (plus an optional technical detail that
/// is hidden behind "details" in debug builds).
enum AppErrorKind {
  network,
  notFound,
  permission,
  cancelled,
  storage,
  corruptFile,
  unknown,
  missingIndex,
}

class AppException implements Exception {
  AppException(this.kind, {this.technical, this.retryable = true});

  final AppErrorKind kind;
  final String? technical;
  final bool retryable;

  String get debugLabel => '$kind${technical == null ? '' : ': $technical'}';

  /// Maps anything thrown by Firestore / Dio / the file system into an
  /// [AppException]. Never rethrows - the UI must always have something to show.
  static AppException from(Object error, [StackTrace? stackTrace]) {
    if (error is AppException) return error;

    if (error is FirebaseException) {
      switch (error.code) {
        case 'unavailable':
        case 'deadline-exceeded':
        case 'network-request-failed':
          return AppException(AppErrorKind.network, technical: error.code);
        case 'not-found':
          return AppException(AppErrorKind.notFound, technical: error.code, retryable: false);
        case 'permission-denied':
        case 'unauthenticated':
          return AppException(AppErrorKind.permission, technical: error.code, retryable: false);
        case 'failed-precondition':
        case 'invalid-argument':
          return AppException(AppErrorKind.missingIndex, technical: error.message);
        default:
          return AppException(AppErrorKind.unknown, technical: '${error.code}: ${error.message}');
      }
    }

    if (error is DioException) {
      switch (error.type) {
        case DioExceptionType.connectionError:
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.receiveTimeout:
        case DioExceptionType.sendTimeout:
          return AppException(AppErrorKind.network, technical: error.message);
        case DioExceptionType.cancel:
          return AppException(AppErrorKind.cancelled, technical: error.message, retryable: false);
        case DioExceptionType.badResponse:
          final int? status = error.response?.statusCode;
          if (status == 404) {
            return AppException(AppErrorKind.notFound, technical: 'HTTP 404', retryable: false);
          }
          if (status == 403 || status == 401) {
            return AppException(AppErrorKind.permission, technical: 'HTTP $status', retryable: false);
          }
          return AppException(AppErrorKind.network, technical: 'HTTP $status');
        default:
          return AppException(AppErrorKind.network, technical: error.message);
      }
    }

    if (error is FormatException) {
      return AppException(AppErrorKind.corruptFile, technical: error.message, retryable: false);
    }

    final String text = error.toString();
    if (text.contains('SocketException') || text.contains('Failed host lookup')) {
      return AppException(AppErrorKind.network, technical: text);
    }
    if (text.contains('FileSystemException') || text.contains('No space left')) {
      return AppException(AppErrorKind.storage, technical: text);
    }
    return AppException(AppErrorKind.unknown, technical: text);
  }
}
