import 'package:flutter/material.dart';

/// Pulsing grey block used while real content loads.
///
/// Cheaper and less jarring than a spinner: the layout does not jump when the
/// data arrives, which matters on the low-end devices this app targets.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = 8,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Color base = Theme.of(context).colorScheme.surfaceContainerHighest;
    return AnimatedBuilder(
      animation: _controller,
      builder: (BuildContext context, Widget? child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: base.withValues(alpha: 0.35 + (_controller.value * 0.45)),
            borderRadius: BorderRadius.circular(widget.borderRadius),
          ),
        );
      },
    );
  }
}

/// Placeholder for the book grid: cover + two text lines per card.
class BookGridSkeleton extends StatelessWidget {
  const BookGridSkeleton({super.key, this.itemCount = 6});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 220,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        childAspectRatio: 0.62,
      ),
      itemBuilder: (BuildContext context, int index) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const <Widget>[
            Expanded(child: SkeletonBox(height: double.infinity, borderRadius: 14)),
            SizedBox(height: 10),
            SkeletonBox(height: 14, width: 140),
            SizedBox(height: 6),
            SkeletonBox(height: 12, width: 90),
          ],
        );
      },
    );
  }
}

/// Placeholder for vertical lists (papers, favourites, downloads, search).
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.itemCount = 8, this.hasLeading = true});

  final int itemCount;
  final bool hasLeading;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: itemCount,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (BuildContext context, int index) {
        return Row(
          children: <Widget>[
            if (hasLeading) ...<Widget>[
              const SkeletonBox(width: 48, height: 60, borderRadius: 10),
              const SizedBox(width: 14),
            ],
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  SkeletonBox(height: 14, width: 200),
                  SizedBox(height: 8),
                  SkeletonBox(height: 12, width: 130),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
