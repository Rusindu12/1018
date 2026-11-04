import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/app_settings.dart';

class ApiCredentials {
  const ApiCredentials({required this.apiKey, required this.secretKey});

  final String apiKey;
  final String secretKey;
}

/// Stores separate Binance Spot/Futures and testnet/live credentials in
/// Android encrypted storage. Secrets are never written to preferences/logs.
class CredentialStore {
  CredentialStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  String _name(String field, MarketType type, bool testnet) =>
      'binance_${type.name}_${testnet ? 'testnet' : 'live'}_$field';

  Future<bool> hasCredentials({required MarketType marketType, required bool testnet}) async {
    final key = await _storage.read(key: _name('api_key', marketType, testnet));
    final secret = await _storage.read(key: _name('secret_key', marketType, testnet));
    return key != null && key.isNotEmpty && secret != null && secret.isNotEmpty;
  }

  Future<void> save(
    ApiCredentials credentials, {
    required MarketType marketType,
    required bool testnet,
  }) async {
    await _storage.write(key: _name('api_key', marketType, testnet), value: credentials.apiKey.trim());
    await _storage.write(key: _name('secret_key', marketType, testnet), value: credentials.secretKey.trim());
  }

  Future<ApiCredentials?> read({required MarketType marketType, required bool testnet}) async {
    final apiKey = await _storage.read(key: _name('api_key', marketType, testnet));
    final secretKey = await _storage.read(key: _name('secret_key', marketType, testnet));
    if (apiKey == null || apiKey.isEmpty || secretKey == null || secretKey.isEmpty) return null;
    return ApiCredentials(apiKey: apiKey, secretKey: secretKey);
  }

  Future<void> clear({required MarketType marketType, required bool testnet}) async {
    await _storage.delete(key: _name('api_key', marketType, testnet));
    await _storage.delete(key: _name('secret_key', marketType, testnet));
  }
}
