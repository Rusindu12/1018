import 'dart:async';

import 'package:flutter/foundation.dart';

import '../analysis/ai_trading_engine.dart';
import '../data/binance/app_preferences_store.dart';
import '../data/binance/binance_api_client.dart';
import '../data/binance/market_stream.dart';
import '../models/app_settings.dart';
import '../models/market_models.dart';
import '../models/order_request.dart';
import '../security/credential_store.dart';

class TradingController extends ChangeNotifier {
  TradingController({
    required CredentialStore credentialStore,
    required AppPreferencesStore preferences,
    BinanceApiClient? apiClient,
  })  : _credentialStore = credentialStore,
        _preferences = preferences,
        _api = apiClient ?? BinanceApiClient(credentialStore: credentialStore) {
    _marketStream = MarketStream(onTicker: _onTicker);
  }

  final CredentialStore _credentialStore;
  final AppPreferencesStore _preferences;
  final BinanceApiClient _api;
  late final MarketStream _marketStream;
  final Map<String, PriceTicker> prices = {};
  final List<String> watchlist = AppPreferencesStore.allowedSymbols;

  AppSettings settings = const AppSettings();
  List<Candle> candles = const [];
  TradingAnalysis? analysis;
  PortfolioSnapshot? portfolio;
  bool isInitialised = false;
  bool isMarketLoading = false;
  bool isPortfolioLoading = false;
  bool hasApiCredentials = false;
  String? marketError;
  String? portfolioError;
  OrderReceipt? lastOrder;
  Timer? _tickerNotifyTimer;
  Timer? _portfolioRefreshTimer;
  Timer? _marketRefreshTimer;

  bool get dailyLossLimitReached {
    final dailyPnl = portfolio?.dailyPnlUsdt;
    return dailyPnl != null && dailyPnl <= -settings.dailyLossLimitUsdt;
  }

  String get environmentLabel => settings.testnet ? 'TESTNET' : 'LIVE';

  Future<void> initialize() async {
    settings = await _preferences.load();
    hasApiCredentials = await _credentialStore.hasCredentials(
      marketType: settings.marketType,
      testnet: settings.testnet,
    );
    isInitialised = true;
    _configureStream();
    _marketRefreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (!isMarketLoading) unawaited(refreshMarketData());
    });
    notifyListeners();
    unawaited(refreshMarketData());
    if (hasApiCredentials) {
      _startPortfolioRefreshTimer();
      unawaited(refreshPortfolio());
    }
  }

  Future<void> refreshDashboard() async {
    await Future.wait<void>([
      refreshMarketData(),
      if (hasApiCredentials) refreshPortfolio(),
    ]);
  }

  Future<void> refreshMarketData() async {
    if (isMarketLoading) return;
    isMarketLoading = true;
    marketError = null;
    notifyListeners();
    try {
      final fetched = await _api.getKlines(
        symbol: settings.symbol,
        interval: settings.interval,
        marketType: settings.marketType,
        testnet: settings.testnet,
      );
      candles = fetched;
      analysis = AiTradingEngine.analyze(fetched);
    } on Object catch (error) {
      marketError = _errorMessage(error);
    } finally {
      isMarketLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshPortfolio() async {
    if (isPortfolioLoading) return;
    if (!hasApiCredentials) {
      portfolio = null;
      portfolioError = null;
      notifyListeners();
      return;
    }
    isPortfolioLoading = true;
    portfolioError = null;
    notifyListeners();
    try {
      portfolio = await _api.getPortfolio(
        marketType: settings.marketType,
        testnet: settings.testnet,
      );
    } on Object catch (error) {
      portfolioError = _errorMessage(error);
    } finally {
      isPortfolioLoading = false;
      notifyListeners();
    }
  }

  Future<bool> saveAndVerifyCredentials({required String apiKey, required String secretKey}) async {
    if (apiKey.trim().isEmpty || secretKey.trim().isEmpty) {
      portfolioError = 'Enter both the API key and secret.';
      notifyListeners();
      return false;
    }
    await _credentialStore.save(
      ApiCredentials(apiKey: apiKey, secretKey: secretKey),
      marketType: settings.marketType,
      testnet: settings.testnet,
    );
    hasApiCredentials = true;
    _startPortfolioRefreshTimer();
    portfolio = null;
    notifyListeners();
    await refreshPortfolio();
    return portfolio != null && portfolioError == null;
  }

  Future<void> removeCredentials() async {
    await _credentialStore.clear(marketType: settings.marketType, testnet: settings.testnet);
    hasApiCredentials = false;
    _portfolioRefreshTimer?.cancel();
    portfolio = null;
    portfolioError = null;
    notifyListeners();
  }

  Future<void> updateSettings(AppSettings updated) async {
    final streamChanged = settings.marketType != updated.marketType || settings.testnet != updated.testnet;
    final chartChanged = settings.symbol != updated.symbol ||
        settings.interval != updated.interval ||
        settings.marketType != updated.marketType ||
        settings.testnet != updated.testnet;
    settings = updated;
    await _preferences.save(updated);
    if (streamChanged) {
      prices.clear();
      portfolio = null;
      hasApiCredentials = await _credentialStore.hasCredentials(
        marketType: updated.marketType,
        testnet: updated.testnet,
      );
      _configureStream();
      if (hasApiCredentials) _startPortfolioRefreshTimer();
    }
    notifyListeners();
    if (chartChanged) unawaited(refreshMarketData());
    if (streamChanged && hasApiCredentials) unawaited(refreshPortfolio());
  }

  Future<void> setRiskLimits({double? dailyLossLimitUsdt, double? riskPercent}) {
    return updateSettings(settings.copyWith(
      dailyLossLimitUsdt: dailyLossLimitUsdt,
      riskPercent: riskPercent,
    ));
  }

  Future<void> selectSymbol(String symbol) => updateSettings(settings.copyWith(symbol: symbol));

  Future<void> selectInterval(String interval) => updateSettings(settings.copyWith(interval: interval));

  Future<OrderReceipt> submitOrder(OrderRequest order) async {
    if (!hasApiCredentials) {
      throw const BinanceApiException('Add and verify the API credentials for the selected market and environment first.');
    }
    if (isPortfolioLoading) {
      throw const BinanceApiException('Account refresh is still in progress. Wait for it to finish, then review the order again.');
    }
    await refreshPortfolio();
    final snapshot = portfolio;
    if (snapshot == null || portfolioError != null || DateTime.now().difference(snapshot.asOf) > const Duration(minutes: 2)) {
      throw const BinanceApiException('Could not obtain a fresh account snapshot. Refresh the account and retry after checking API permissions.');
    }
    if (settings.marketType == MarketType.futures && snapshot.dailyPnlUsdt == null) {
      throw const BinanceApiException(
        'Futures daily P&L could not be verified. Ensure this API key can read Futures income history before placing an order.',
      );
    }
    if (snapshot.dailyPnlUsdt != null && snapshot.dailyPnlUsdt! <= -settings.dailyLossLimitUsdt) {
      throw const BinanceApiException(
        'The configured daily loss limit has been reached. Orders are paused until the next UTC day or until you review your risk settings.',
      );
    }
    final receipt = await _api.placeOrder(
      order: order,
      marketType: settings.marketType,
      testnet: settings.testnet,
    );
    lastOrder = receipt;
    notifyListeners();
    unawaited(refreshPortfolio());
    return receipt;
  }

  void _startPortfolioRefreshTimer() {
    _portfolioRefreshTimer?.cancel();
    _portfolioRefreshTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (hasApiCredentials && !isPortfolioLoading) unawaited(refreshPortfolio());
    });
  }

  void _configureStream() {
    _marketStream.connect(
      symbols: watchlist,
      marketType: settings.marketType,
      testnet: settings.testnet,
    );
  }

  void _onTicker(PriceTicker ticker) {
    prices[ticker.symbol] = ticker;
    if (_tickerNotifyTimer?.isActive == true) return;
    _tickerNotifyTimer = Timer(const Duration(milliseconds: 250), notifyListeners);
  }

  static String _errorMessage(Object error) {
    if (error is BinanceApiException) return error.message;
    return 'Something went wrong. Check your connection and try again.';
  }

  @override
  void dispose() {
    _tickerNotifyTimer?.cancel();
    _portfolioRefreshTimer?.cancel();
    _marketRefreshTimer?.cancel();
    unawaited(_marketStream.dispose());
    super.dispose();
  }
}
