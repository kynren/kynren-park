import 'package:flutter/material.dart';

/// Stylised golden-hour hero: sky, sun, hills and the Kynren keep.
class HeroArt extends StatelessWidget {
  const HeroArt({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.expand(child: CustomPaint(painter: _HeroPainter()));
}

class _HeroPainter extends CustomPainter {
  const _HeroPainter();
  static const w = 375.0, h = 300.0;
  static const kx = w * 0.72;

  @override
  void paint(Canvas canvas, Size size) {
    // viewBox 375x300 with xMidYMax slice
    final s = (size.width / w) > (size.height / h) ? size.width / w : size.height / h;
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    canvas.translate((size.width - w * s) / 2, size.height - h * s);
    canvas.scale(s);

    final sky = const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [Color(0xFF2C4A5E), Color(0xFFD9915A), Color(0xFFF3D9A4)],
      stops: [0, 0.55, 1],
    ).createShader(const Rect.fromLTWH(0, 0, w, h));
    canvas.drawRect(const Rect.fromLTWH(0, 0, w, h), Paint()..shader = sky);

    canvas.drawCircle(const Offset(300, 86), 44, Paint()..color = const Color(0xFFFFF1C7).withValues(alpha: 0.3));
    canvas.drawCircle(const Offset(300, 86), 28, Paint()..color = const Color(0xFFFFF1C7).withValues(alpha: 0.95));

    Path cloud(double x, double y, List<double> q) => Path()
      ..moveTo(x, y)
      ..relativeQuadraticBezierTo(10, -q[0], 26, -q[1])
      ..relativeQuadraticBezierTo(8, -q[2], 24, -q[3])
      ..relativeQuadraticBezierTo(16, 0, 16, 12)
      ..close();
    canvas.drawPath(cloud(30, 70, [14, 8, 12, 4]), Paint()..color = const Color(0xFFF7E3C2).withValues(alpha: 0.75));
    canvas.drawPath(cloud(150, 40, [12, 6, 10, 2]), Paint()..color = const Color(0xFFF7E3C2).withValues(alpha: 0.6));

    canvas.drawPath(
      Path()
        ..moveTo(0, h * 0.66)
        ..cubicTo(90, h * 0.58, 150, h * 0.7, 230, h * 0.64)
        ..cubicTo(290, h * 0.6, 340, h * 0.6, w, h * 0.66)
        ..lineTo(w, h)
        ..lineTo(0, h)
        ..close(),
      Paint()..color = const Color(0xFF4A7A52),
    );
    canvas.drawPath(
      Path()
        ..moveTo(0, h * 0.76)
        ..cubicTo(110, h * 0.68, 200, h * 0.8, 300, h * 0.73)
        ..cubicTo(340, h * 0.75, w, h * 0.75, w, h * 0.77)
        ..lineTo(w, h)
        ..lineTo(0, h)
        ..close(),
      Paint()..color = const Color(0xFF2F5A3A),
    );

    final keep = Paint()..color = const Color(0xFF2A2118);
    canvas.drawRect(const Rect.fromLTWH(kx - 40, h * 0.5, 80, h * 0.5), keep);
    canvas.drawRect(const Rect.fromLTWH(kx - 62, h * 0.58, 24, h * 0.42), keep);
    canvas.drawRect(const Rect.fromLTWH(kx + 38, h * 0.58, 24, h * 0.42), keep);
    for (final dx in const [-62, -52, -42, -12, -2, 8, 38, 48, 58]) {
      canvas.drawRect(Rect.fromLTWH(kx + dx, h * 0.5 - 7, 7, 9), keep);
    }
    canvas.drawPath(
      Path()
        ..moveTo(kx, h * 0.4)
        ..lineTo(kx - 14, h * 0.5)
        ..lineTo(kx + 14, h * 0.5)
        ..close(),
      keep,
    );
    canvas.drawPath(
      Path()
        ..moveTo(kx, h * 0.4)
        ..lineTo(kx, h * 0.33)
        ..lineTo(kx + 15, h * 0.355)
        ..close(),
      Paint()..color = const Color(0xFF8A1F31),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}
