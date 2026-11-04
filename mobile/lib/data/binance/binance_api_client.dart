import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;

import '../../models/app_settings.dart';
import '../../models/market_models.dart';
import '../../models/order_request.dart';
import '../../security/credential_store.dart';

class BinanceApiException implements Exception {
  const BinanceApiException(this.message, {this.statusCode, this.exchangeCode});

  final String message;
  final int? statusCode;
  final int? exchangeCode;

  @override
  String toString() => message;
}

/// A small REST client for Binance Spot and USDⓈ-M Futures.
/// The secret is read from secure storage only for the duration of signing.
class BinanceApiClient {
  BinanceApiClient({
    required CredentialStore credentialStore,
    http.Client? httpClient,
  })  : _credentialStore = credentialStore,
        _http = httpClient ?? http.Client();

  final CredentialStore _credentialStore;
  final http.Client _http;

  Future<List<Candle>> getKlines({
    required String symbol,
    required String interval,
    required MarketType marketType,
    required bool testnet,
    int limit = 200,
  }) async {
    final path = marketType == MarketType.spot ? '/api/v3/klines' : '/fapi/v1/klines';
    final result = await _request(
      method: 'GET',
      path: path,
      marketType: marketType,
      testnet: testnet,
      parameters: {
        'symbol': _normaliseSymbol(symbol),
        'interval': interval,
        'limit': '${limit.clamp(1, 1000)}',
      },
    );
    if (result is! List) throw const BinanceApiException('Unexpected kline response from Binance.');
    return result
        .whereType<List<dynamic>>()
        .where((row) => row.length >= 7)
        .map(Candle.fromBinance)
        .toList(growable: false);
  }

  Future<Map<String, double>> getAllPrices({
    required MarketType marketType,
    required bool testnet,
  }) async {
    final result = await _request(
      method: 'GET',
      path: marketType == MarketType.spot ? '/api/v3/ticker/price' : '/fapi/v1/ticker/price',
      marketType: marketType,
      testnet: testnet,
    );
    if (result is! List) throw const BinanceApiException('Unexpected ticker response from Binance.');
    final prices = <String, double>{};
    for (final row in result.whereType<Map<String, dynamic>>()) {
      final symbol = row['symbol']?.toString();
      final price = double.tryParse(row['price']?.toString() ?? '');
      if (symbol != null && price != null && price.isFinite) prices[symbol] = price;
    }
    return prices;
  }

  Future<PortfolioSnapshot> getPortfolio({
    required MarketType marketType,
    required bool testnet,
  }) {
    return marketType == MarketType.spot
        ? _getSpotPortfolio(testnet: testnet)
        : _getFuturesPortfolio(testnet: testnet);
  }

  Future<PortfolioSnapshot> _getSpotPortfolio({required bool testnet}) async {
    final account = await _request(
      method: 'GET',
      path: '/api/v3/account',
      marketType: MarketType.spot,
      testnet: testnet,
      signed: true,
    );
    if (account is! Map<String, dynamic> || account['balances'] is! List) {
      throw const BinanceApiException('Unexpected Spot account response from Binance.');
    }

    // A single public ticker request avoids one REST request per wallet asset.
    final prices = await getAllPrices(marketType: MarketType.spot, testnet: testnet);
    const stableAssets = {'USDT', 'USDC', 'FDUSD', 'TUSD', 'USDP', 'DAI'};
    final assets = <AssetBalance>[];
    var total = 0.0;
    var available = 0.0;
    var unpriced = 0;
    for (final row in (account['balances'] as List).whereType<Map<String, dynamic>>()) {
      final asset = row['asset']?.toString() ?? '';
      final double free = double.tryParse(row['free']?.toString() ?? '') ?? 0.0;
      final double locked = double.tryParse(row['locked']?.toString() ?? '') ?? 0.0;
      final quantity = free + locked;
      if (asset.isEmpty || quantity <= 0) continue;
      final rate = stableAssets.contains(asset) ? 1.0 : prices['${asset}USDT'];
      final value = rate == null ? null : quantity * rate;
      if (value != null && value.isFinite) {
        total += value;
        available += free * (rate ?? 0.0);
      } else {
        unpriced++;
      }
      assets.add(AssetBalance(asset: asset, free: free, locked: locked, usdtValue: value));
    }
    assets.sort((a, b) => (b.usdtValue ?? -1).compareTo(a.usdtValue ?? -1));
    return PortfolioSnapshot(
      totalValueUsdt: total,
      availableBalanceUsdt: available,
      assets: assets,
      asOf: DateTime.now(),
      unpricedAssetCount: unpriced,
    );
  }

  Future<PortfolioSnapshot> _getFuturesPortfolio({required bool testnet}) async {
    final account = await _request(
      method: 'GET',
      path: '/fapi/v3/account',
      marketType: MarketType.futures,
      testnet: testnet,
      signed: true,
    );
    if (account is! Map<String, dynamic>) {
      throw const BinanceApiException('Unexpected Futures account response from Binance.');
    }
    final wallet = _number(account['totalWalletBalance']);
    final unrealized = _number(account['totalUnrealizedProfit']);
    final available = _number(account['availableBalance']);
    final dailyPnl = await _getFuturesDailyPnl(testnet: testnet, currentUnrealized: unrealized);
    return PortfolioSnapshot(
      totalValueUsdt: mathMaxZero(wallet + unrealized),
      availableBalanceUsdt: available,
      unrealizedPnlUsdt: unrealized,
      dailyPnlUsdt: dailyPnl,
      assets: const [],
      asOf: DateTime.now(),
    );
  }

  Future<double?> _getFuturesDailyPnl({
    required bool testnet,
    required double currentUnrealized,
  }) async {
    try {
      final now = DateTime.now().toUtc();
      final startOfDay = DateTime.utc(now.year, now.month, now.day).millisecondsSinceEpoch;
      final rows = await _request(
        method: 'GET',
        path: '/fapi/v1/income',
        marketType: MarketType.futures,
        testnet: testnet,
        signed: true,
        parameters: {'startTime': '$startOfDay', 'limit': '1000'},
      );
      if (rows is! List) return null;
      const pnlTypes = {'REALIZED_PNL', 'COMMISSION', 'FUNDING_FEE'};
      var realised = 0.0;
      for (final row in rows.whereType<Map<String, dynamic>>()) {
        if (pnlTypes.contains(row['incomeType'])) realised += _number(row['income']);
      }
      // This risk metric combines today's booked P&L/fees/funding with the
      // current unrealized Futures P&L. It is deliberately not presented as
      // a tax/accounting statement.
      return realised + currentUnrealized;
    } on BinanceApiException {
      // Keep the account view usable if the API key lacks income-history scope.
      return null;
    }
  }

  Future<OrderReceipt> placeOrder({
    required OrderRequest order,
    required MarketType marketType,
    required bool testnet,
  }) async {
    final symbol = _normaliseSymbol(order.symbol);
    if (!RegExp(r'^[A-Z0-9]{5,20}$').hasMatch(symbol)) {
      throw const BinanceApiException('Invalid trading symbol.');
    }
    if (!order.quantity.isFinite || order.quantity <= 0) {
      throw const BinanceApiException('Quantity must be greater than zero.');
    }
    final type = order.type.toUpperCase();
    final side = order.side.toUpperCase();
    if (!{'MARKET', 'LIMIT'}.contains(type) || !{'BUY', 'SELL'}.contains(side)) {
      throw const BinanceApiException('Unsupported order type or side.');
    }
    if (type == 'LIMIT' && (order.limitPrice == null || !order.limitPrice!.isFinite || order.limitPrice! <= 0)) {
      throw const BinanceApiException('A positive limit price is required for a limit order.');
    }
    if (order.reduceOnly && marketType != MarketType.futures) {
      throw const BinanceApiException('Reduce-only is available only for Futures orders.');
    }

    final path = marketType == MarketType.spot ? '/api/v3/order' : '/fapi/v1/order';
    final parameters = <String, String>{
      'symbol': symbol,
      'side': side,
      'type': type,
      'quantity': _formatDecimal(order.quantity),
      'newOrderRespType': 'RESULT',
    };
    if (type == 'LIMIT') {
      parameters['timeInForce'] = 'GTC';
      parameters['price'] = _formatDecimal(order.limitPrice!);
    }
    if (order.reduceOnly) parameters['reduceOnly'] = 'true';

    final result = await _request(
      method: 'POST',
      path: path,
      marketType: marketType,
      testnet: testnet,
      signed: true,
      parameters: parameters,
    );
    if (result is! Map<String, dynamic>) {
      throw const BinanceApiException('Unexpected order response from Binance.');
    }
    return OrderReceipt.fromJson(result);
  }

  Future<Object?> _request({
    required String method,
    required String path,
    required MarketType marketType,
    required bool testnet,
    Map<String, String> parameters = const {},
    bool signed = false,
  }) async {
    final base = _baseUrl(marketType, testnet);
    final requestParameters = Map<String, String>.from(parameters);
    ApiCredentials? credentials;
    if (signed) {
      credentials = await _credentialStore.read(marketType: marketType, testnet: testnet);
      if (credentials == null) {
        throw const BinanceApiException('Add a Binance API key and secret in Settings first.');
      }
      requestParameters['timestamp'] = '${DateTime.now().millisecondsSinceEpoch}';
      requestParameters['recvWindow'] = '5000';
    }

    var query = Uri(queryParameters: requestParameters).query;
    if (signed) {
      final signature = Hmac(sha256, utf8.encode(credentials!.secretKey))
          .convert(utf8.encode(query))
          .toString();
      query = '$query&signature=$signature';
    }
    final uri = Uri.parse('$base$path${query.isEmpty ? '' : '?$query'}');
    final headers = <String, String>{'Accept': 'application/json'};
    if (credentials != null) headers['X-MBX-APIKEY'] = credentials.apiKey;

    try {
      late final http.Response response;
      switch (method) {
        case 'POST':
          response = await _http.post(uri, headers: headers).timeout(const Duration(seconds: 20));
          break;
        case 'DELETE':
          response = await _http.delete(uri, headers: headers).timeout(const Duration(seconds: 20));
          break;
        default:
          response = await _http.get(uri, headers: headers).timeout(const Duration(seconds: 20));
          break;
      }
      Object? decoded;
      try {
        decoded = jsonDecode(response.body);
      } on FormatException {
        throw BinanceApiException('Binance returned an unreadable response (${response.statusCode}).');
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (decoded is Map<String, dynamic>) {
          final code = int.tryParse(decoded['code']?.toString() ?? '');
          final message = decoded['msg']?.toString() ?? 'Binance request failed.';
          throw BinanceApiException(message, statusCode: response.statusCode, exchangeCode: code);
        }
        throw BinanceApiException('Binance request failed (${response.statusCode}).', statusCode: response.statusCode);
      }
      if (decoded is Map<String, dynamic> && decoded['code'] is num && (decoded['code'] as num) < 0) {
        throw BinanceApiException(decoded['msg']?.toString() ?? 'Binance rejected the request.');
      }
      return decoded;
    } on SocketException {
      throw const BinanceApiException('Network unavailable. Check your connection and try again.');
    } on HttpException {
      throw const BinanceApiException('Could not reach Binance. Try again shortly.');
    } on http.ClientException {
      throw const BinanceApiException('Could not connect to Binance. Check your network or endpoint availability.');
    }
  }

  String _baseUrl(MarketType marketType, bool testnet) {
    if (marketType == MarketType.spot) {
      return testnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
    }
    return testnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
  }

  static String _normaliseSymbol(String value) => value.trim().toUpperCase();

  static double _number(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse(value?.toString() ?? '') ?? 0.0;

  static String _formatDecimal(double value) {
    final text = value.toStringAsFixed(12).replaceFirst(RegExp(r'0+$'), '');
    return text.endsWith('.') ? text.substring(0, text.length - 1) : text;
  }

  static double mathMaxZero(double value) => value < 0 ? 0 : value;
}
