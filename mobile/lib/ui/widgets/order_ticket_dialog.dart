import 'package:flutter/material.dart';

import '../../models/app_settings.dart';
import '../../models/order_request.dart';
import '../app_theme.dart';
import '../formatters.dart';
import 'section_card.dart';

class OrderTicketDialog extends StatefulWidget {
  const OrderTicketDialog({
    required this.symbol,
    required this.marketType,
    required this.testnet,
    required this.currentPrice,
    required this.initialSide,
    this.initialQuantity,
    super.key,
  });

  final String symbol;
  final MarketType marketType;
  final bool testnet;
  final double currentPrice;
  final String initialSide;
  final double? initialQuantity;

  @override
  State<OrderTicketDialog> createState() => _OrderTicketDialogState();
}

class _OrderTicketDialogState extends State<OrderTicketDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _quantityController;
  late final TextEditingController _priceController;
  late String _side;
  String _type = 'MARKET';
  bool _reduceOnly = false;

  @override
  void initState() {
    super.initState();
    _side = widget.initialSide;
    final suggestedQuantity = widget.initialQuantity;
    final quantityText = suggestedQuantity != null && suggestedQuantity.isFinite
        ? suggestedQuantity.toStringAsFixed(12).replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '')
        : '';
    _quantityController = TextEditingController(text: quantityText);
    _priceController = TextEditingController(text: widget.currentPrice > 0 ? widget.currentPrice.toStringAsFixed(2) : '');
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _review() {
    if (!_formKey.currentState!.validate()) return;
    final quantity = double.parse(_quantityController.text.trim());
    final limitPrice = _type == 'LIMIT' ? double.parse(_priceController.text.trim()) : null;
    Navigator.of(context).pop(OrderRequest(
      symbol: widget.symbol,
      side: _side,
      type: _type,
      quantity: quantity,
      limitPrice: limitPrice,
      reduceOnly: _reduceOnly,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final environmentColor = widget.testnet ? AppColors.teal : AppColors.red;
    return AlertDialog(
      title: const Text('Prepare order'),
      content: SizedBox(
        width: 440,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SectionCard(
                  padding: const EdgeInsets.all(12),
                  child: Row(
                    children: [
                      Expanded(child: Text(widget.symbol, style: const TextStyle(fontWeight: FontWeight.w800))),
                      Text(widget.marketType.label, style: const TextStyle(color: AppColors.muted, fontSize: 11)),
                      const SizedBox(width: 8),
                      Text(widget.testnet ? 'TESTNET' : 'LIVE', style: TextStyle(color: environmentColor, fontWeight: FontWeight.w800, fontSize: 10)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: _SideButton(
                        label: 'BUY',
                        selected: _side == 'BUY',
                        color: AppColors.mint,
                        onTap: () => setState(() => _side = 'BUY'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _SideButton(
                        label: 'SELL',
                        selected: _side == 'SELL',
                        color: AppColors.red,
                        onTap: () => setState(() => _side = 'SELL'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: const InputDecoration(labelText: 'Order type'),
                  items: const [
                    DropdownMenuItem(value: 'MARKET', child: Text('Market')),
                    DropdownMenuItem(value: 'LIMIT', child: Text('Limit · GTC')),
                  ],
                  onChanged: (value) => setState(() => _type = value ?? 'MARKET'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _quantityController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Quantity (base asset)', hintText: 'e.g. 0.001'),
                  validator: (value) {
                    final number = double.tryParse(value?.trim() ?? '');
                    if (number == null || !number.isFinite || number <= 0) return 'Enter a quantity greater than zero.';
                    return null;
                  },
                ),
                if (_type == 'LIMIT') ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _priceController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(labelText: 'Limit price (USDT)', hintText: formatPrice(widget.currentPrice)),
                    validator: (value) {
                      final number = double.tryParse(value?.trim() ?? '');
                      if (number == null || !number.isFinite || number <= 0) return 'Enter a positive limit price.';
                      return null;
                    },
                  ),
                ],
                if (widget.marketType == MarketType.futures) ...[
                  const SizedBox(height: 8),
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    value: _reduceOnly,
                    onChanged: (value) => setState(() => _reduceOnly = value),
                    title: const Text('Reduce-only', style: TextStyle(fontSize: 13)),
                    subtitle: const Text('One-way mode only; Binance rejects this in Hedge Mode.', style: TextStyle(fontSize: 10, color: AppColors.muted)),
                  ),
                ],
                const SizedBox(height: 8),
                Text(
                  widget.testnet
                      ? 'Demo order only. Testnet balances are not real funds.'
                      : 'LIVE order. Fees, slippage and exchange filters apply. Review the next confirmation carefully.',
                  style: TextStyle(color: environmentColor, fontSize: 11, height: 1.35),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(onPressed: _review, child: const Text('Review order')),
      ],
    );
  }
}

class _SideButton extends StatelessWidget {
  const _SideButton({required this.label, required this.selected, required this.color, required this.onTap});

  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        backgroundColor: selected ? color.withValues(alpha: 0.12) : Colors.transparent,
        side: BorderSide(color: selected ? color : AppColors.grid),
        padding: const EdgeInsets.symmetric(vertical: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
    );
  }
}
