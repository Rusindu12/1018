class OrderRequest {
  const OrderRequest({
    required this.symbol,
    required this.side,
    required this.type,
    required this.quantity,
    this.limitPrice,
    this.reduceOnly = false,
  });

  final String symbol;
  final String side;
  final String type;
  final double quantity;
  final double? limitPrice;
  final bool reduceOnly;
}
