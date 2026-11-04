import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../../models/app_settings.dart';
import '../../models/market_models.dart';

class MarketStream {
  MarketStream({required this.onTicker});

  final void Function(PriceTicker ticker) onTicker;
  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnectTimer;
  List<String> _symbols = const [];
  MarketType _marketType = MarketType.spot;
  bool _testnet = true;
  bool _disposed = false;
  int _attempt = 0;

  void connect({
    required List<String> symbols,
    required MarketType marketType,
    required bool testnet,
  }) {
    _symbols = symbols.map((symbol) => symbol.trim().toLowerCase()).where((s) => s.isNotEmpty).toSet().toList();
    _marketType = marketType;
    _testnet = testnet;
    _attempt = 0;
    _disposed = false;
    _reconnectTimer?.cancel();
    final previousSubscription = _subscription;
    final previousChannel = _channel;
    _subscription = null;
    _channel = null;
    unawaited(previousSubscription?.cancel());
    unawaited(previousChannel?.sink.close());
    _open();
  }

  void _open() {
    if (_disposed || _symbols.isEmpty) return;
    final streamNames = _symbols.map((symbol) => '$symbol@ticker').join('/');
    final base = _webSocketBase(_marketType, _testnet);
    final uri = Uri.parse('$base/stream?streams=$streamNames');
    try {
      final channel = WebSocketChannel.connect(uri);
      _channel = channel;
      _subscription = channel.stream.listen(
        (raw) {
          if (identical(_channel, channel)) _handleMessage(raw);
        },
        onError: (Object error, StackTrace stackTrace) {
          if (identical(_channel, channel)) _scheduleReconnect();
        },
        onDone: () {
          if (identical(_channel, channel)) _scheduleReconnect();
        },
        cancelOnError: false,
      );
    } on Object {
      _scheduleReconnect();
    }
  }

  void _handleMessage(dynamic raw) {
    try {
      final decoded = jsonDecode(raw as String);
      final payload = decoded is Map<String, dynamic> && decoded['data'] is Map<String, dynamic>
          ? decoded['data'] as Map<String, dynamic>
          : decoded;
      if (payload is! Map<String, dynamic>) return;
      final symbol = payload['s']?.toString().toUpperCase();
      final price = double.tryParse(payload['c']?.toString() ?? '');
      final change = double.tryParse(payload['P']?.toString() ?? '');
      if (symbol == null || price == null || !price.isFinite) return;
      _attempt = 0;
      onTicker(PriceTicker(symbol: symbol, price: price, changePercent: change));
    } on Object {
      // Ignore a malformed frame; a subsequent valid update can still arrive.
    }
  }

  void _scheduleReconnect() {
    if (_disposed || _reconnectTimer?.isActive == true) return;
    final previousSubscription = _subscription;
    final previousChannel = _channel;
    _subscription = null;
    _channel = null;
    unawaited(previousSubscription?.cancel());
    unawaited(previousChannel?.sink.close());
    final exponent = _attempt < 5 ? _attempt : 5;
    final seconds = (1 << exponent).clamp(1, 30).toInt();
    _attempt++;
    _reconnectTimer = Timer(Duration(seconds: seconds), _open);
  }

  static String _webSocketBase(MarketType type, bool testnet) {
    if (type == MarketType.spot) {
      return testnet ? 'wss://stream.testnet.binance.vision' : 'wss://stream.binance.com:9443';
    }
    return testnet ? 'wss://stream.binancefuture.com' : 'wss://fstream.binance.com';
  }

  Future<void> dispose() async {
    _disposed = true;
    _reconnectTimer?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close();
  }
}
