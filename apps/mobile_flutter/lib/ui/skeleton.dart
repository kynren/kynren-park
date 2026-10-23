import 'package:flutter/material.dart';
import '../core/theme.dart';

/// A soft light sweep over a quiet block: what a picture or row looks like while it loads.
class Skeleton extends StatefulWidget {
  final double? width, height;
  final double radius;
  const Skeleton({super.key, this.width, this.height, this.radius = 16});

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final base = c.soft;
    final glint = context.isDark ? Colors.white.withValues(alpha: 0.06) : Colors.white.withValues(alpha: 0.7);
    return AnimatedBuilder(
      animation: _t,
      builder: (_, _) => Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(widget.radius),
          gradient: LinearGradient(
            begin: Alignment(-1.6 + _t.value * 3.2, -0.3),
            end: Alignment(-0.6 + _t.value * 3.2, 0.3),
            colors: [base, glint, base],
            stops: const [0.25, 0.5, 0.75],
          ),
        ),
      ),
    );
  }
}

/// A row-shaped placeholder: a picture block and two lines of text.
class SkeletonRow extends StatelessWidget {
  const SkeletonRow({super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(children: [
          const Skeleton(width: 64, height: 64, radius: 18),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: const [
              Skeleton(height: 14, radius: 7),
              SizedBox(height: 10),
              Skeleton(width: 120, height: 12, radius: 6),
            ]),
          ),
        ]),
      );
}

/// A card-shaped placeholder: a picture block and a few lines of text.
class SkeletonCard extends StatelessWidget {
  final double imageHeight;
  const SkeletonCard({super.key, this.imageHeight = 160});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Skeleton(height: imageHeight, radius: Tokens.radiusCard),
        const SizedBox(height: 14),
        const Skeleton(width: 200, height: 16, radius: 8),
        const SizedBox(height: 10),
        const Skeleton(width: 140, height: 12, radius: 6),
      ]);
}
