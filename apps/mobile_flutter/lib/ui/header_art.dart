import 'package:flutter/material.dart';

/// The quiet backdrop behind a picture-less cover or header: overlapping circles of light and shade, so a place
/// with no photo still has depth instead of an empty colour block.
class HeaderArt extends StatelessWidget {
  const HeaderArt({super.key});

  @override
  Widget build(BuildContext context) => const Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _ArtPainter())));
}

class _ArtPainter extends CustomPainter {
  const _ArtPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final r = h < w ? h : w;
    canvas.drawCircle(Offset(w * 0.9, h * 0.1), r * 0.62, Paint()..color = Colors.white.withValues(alpha: 0.08));
    canvas.drawCircle(Offset(w * 0.72, h * 0.98), r * 0.42, Paint()..color = Colors.white.withValues(alpha: 0.06));
    canvas.drawCircle(Offset(w * 0.0, h * 1.05), r * 0.55, Paint()..color = Colors.black.withValues(alpha: 0.1));
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
