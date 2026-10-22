import 'package:flutter/material.dart';

/// The storybook landscape along the foot of a header band: two rolling hills, the keep on the right
/// and a few stars, in translucent white and black so it takes on the colour of the band behind it.
class HeaderArt extends StatelessWidget {
  const HeaderArt({super.key});

  @override
  Widget build(BuildContext context) {
    return const Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      height: _vh,
      child: IgnorePointer(child: CustomPaint(painter: _ArtPainter())),
    );
  }
}

const double _vw = 375;
const double _vh = 96;
const double _kx = 318;

class _ArtPainter extends CustomPainter {
  const _ArtPainter();

  @override
  void paint(Canvas canvas, Size size) {
    // viewBox 375x96 with xMaxYMax slice: scale to cover, anchored bottom-right.
    final s = (size.width / _vw) > (size.height / _vh) ? size.width / _vw : size.height / _vh;
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.translate(size.width - _vw * s, size.height - _vh * s);
    canvas.scale(s);

    final white = Paint()..color = Colors.white.withValues(alpha: 0.5);
    for (final p in const [(48.0, 22.0, 1.6), (132.0, 40.0, 1.2), (212.0, 16.0, 1.8), (268.0, 34.0, 1.2), (352.0, 14.0, 1.5)]) {
      canvas.drawCircle(Offset(p.$1, p.$2), p.$3, white);
    }

    final far = Path()
      ..moveTo(0, _vh * 0.7)
      ..cubicTo(70, _vh * 0.5, 140, _vh * 0.78, 220, _vh * 0.62)
      ..cubicTo(280, _vh * 0.5, 340, _vh * 0.52, _vw, _vh * 0.6)
      ..lineTo(_vw, _vh)
      ..lineTo(0, _vh)
      ..close();
    canvas.drawPath(far, Paint()..color = Colors.white.withValues(alpha: 0.1));

    final keep = Paint()..color = Colors.black.withValues(alpha: 0.2);
    canvas.drawRect(Rect.fromLTWH(_kx - 22, _vh * 0.52, 44, _vh * 0.48), keep);
    canvas.drawRect(Rect.fromLTWH(_kx - 34, _vh * 0.62, 14, _vh * 0.38), keep);
    canvas.drawRect(Rect.fromLTWH(_kx + 20, _vh * 0.62, 14, _vh * 0.38), keep);
    for (final dx in const [-34, -28, -22, -6, 0, 6, 20, 26, 32]) {
      canvas.drawRect(Rect.fromLTWH(_kx + dx, _vh * 0.52 - 4, 4, 5), keep);
    }
    canvas.drawPath(
      Path()
        ..moveTo(_kx, _vh * 0.28)
        ..lineTo(_kx - 8, _vh * 0.52)
        ..lineTo(_kx + 8, _vh * 0.52)
        ..close(),
      keep,
    );

    final near = Path()
      ..moveTo(0, _vh * 0.84)
      ..cubicTo(90, _vh * 0.7, 170, _vh * 0.92, 260, _vh * 0.8)
      ..cubicTo(_vw - 120, _vh * 0.72, _vw - 20, _vh * 0.78, _vw, _vh * 0.82)
      ..lineTo(_vw, _vh)
      ..lineTo(0, _vh)
      ..close();
    canvas.drawPath(near, Paint()..color = Colors.black.withValues(alpha: 0.22));
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
