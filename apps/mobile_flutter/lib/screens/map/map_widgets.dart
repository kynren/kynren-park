import 'package:flutter/material.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../ui/cover.dart';
import 'map_logic.dart';

/// Pins keep a constant screen size, and stay upright, inside the zoomed and turned canvas: each marker is a real-sized
/// box positioned at its map coordinate and counter-scaled and counter-rotated around its anchor point, so it tracks
/// the map while looking the same on screen.
class Anchored extends StatelessWidget {
  final TransformationController controller;
  final double x, y, width, height, anchorX, anchorY;
  final Widget child;
  const Anchored({super.key, required this.controller, required this.x, required this.y, required this.width, required this.height, required this.anchorX, required this.anchorY, required this.child});

  @override
  Widget build(BuildContext context) {
    return Positioned(
      left: x - anchorX,
      top: y - anchorY,
      width: width,
      height: height,
      child: AnimatedBuilder(
        animation: controller,
        child: child,
        builder: (_, child) {
          final s = 1 / controller.value.getMaxScaleOnAxis();
          return Transform(
            transform: Matrix4.identity()
              ..scaleByDouble(s, s, 1, 1)
              ..rotateZ(-viewAngle(controller.value)),
            alignment: Alignment(anchorX / width * 2 - 1, anchorY / height * 2 - 1),
            child: child,
          );
        },
      ),
    );
  }
}

/// The shield-shaped marker body: a coloured shield with a white outline.
class _ShieldPainter extends CustomPainter {
  final Color color;
  const _ShieldPainter(this.color);
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 38, size.height / 46);
    final path = Path()
      ..moveTo(19, 1.5)
      ..lineTo(34.5, 6.8)
      ..lineTo(34.5, 22)
      ..cubicTo(34.5, 32.5, 27, 40.5, 19, 44.5)
      ..cubicTo(11, 40.5, 3.5, 32.5, 3.5, 22)
      ..lineTo(3.5, 6.8)
      ..close();
    canvas.drawShadow(path, Colors.black, 3, false);
    canvas.drawPath(path, Paint()..color = color);
    canvas.drawPath(path, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 2.4..strokeJoin = StrokeJoin.round);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ShieldPainter old) => old.color != color;
}

Color pinTint(Pin pin) => switch (pin.kind) {
      PinKind.evening => const Color(0xFF6E1423),
      PinKind.restaurant => const Color(0xFFA8452D),
      PinKind.facility => pin.color ?? const Color(0xFF6B6460),
      PinKind.show => Tokens.brand,
    };

class PinMarker extends StatelessWidget {
  final Pin pin;
  final bool selected;
  final VoidCallback onTap;
  const PinMarker({super.key, required this.pin, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final glyph = switch (pin.kind) {
      PinKind.restaurant => const Icon(Icons.restaurant_rounded, color: Colors.white, size: 19),
      PinKind.evening => const Icon(Icons.star_rounded, color: Colors.white, size: 19),
      PinKind.facility => Text(pin.emoji ?? '•', style: const TextStyle(fontSize: 15)),
      PinKind.show => Text('${pin.number}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
    };
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(children: [
        Transform.scale(
          scale: selected ? 1.2 : 1,
          alignment: Alignment.bottomCenter,
          child: SizedBox(
            width: 38,
            height: 46,
            child: Stack(alignment: Alignment.topCenter, children: [
              Positioned.fill(child: CustomPaint(painter: _ShieldPainter(pinTint(pin)))),
              Positioned(top: 6, left: 0, right: 0, height: 26, child: Center(child: glyph)),
            ]),
          ),
        ),
        if (pin.nextTime != null && (pin.kind == PinKind.show || pin.kind == PinKind.evening))
          Container(
            margin: const EdgeInsets.only(top: 1),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: const Color(0xFFE8861A), borderRadius: BorderRadius.circular(8), boxShadow: const [BoxShadow(color: Color(0x38000000), blurRadius: 2, offset: Offset(0, 1))]),
            child: Text(fmtTime(pin.nextTime!), maxLines: 1, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11)),
          ),
      ]),
    );
  }
}

class CountBubble extends StatelessWidget {
  final int count;
  final VoidCallback onTap;
  const CountBubble({super.key, required this.count, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(color: Tokens.brand, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 2.5), boxShadow: const [BoxShadow(color: Color(0x4D000000), blurRadius: 3, offset: Offset(0, 2))]),
          child: Center(child: Text('$count', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15))),
        ),
      );
}

class AreaBubble extends StatelessWidget {
  final int count;
  final String zone;
  final VoidCallback onTap;
  const AreaBubble({super.key, required this.count, required this.zone, required this.onTap});
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: onTap,
        child: Column(children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: Tokens.brand, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3), boxShadow: const [BoxShadow(color: Color(0x59000000), blurRadius: 4, offset: Offset(0, 2))]),
            child: Center(child: Text('$count', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17))),
          ),
          const SizedBox(height: 4),
          Container(
            constraints: const BoxConstraints(maxWidth: 130),
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(color: const Color(0xD1141414), borderRadius: BorderRadius.circular(999)),
            child: Text(zone, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11, letterSpacing: 0.2)),
          ),
        ]),
      );
}

/// "You are here": a glowing, pulsing location beacon.
class Beacon extends StatelessWidget {
  final Animation<double> pulse;
  final Color color;
  const Beacon({super.key, required this.pulse, required this.color});
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 60,
        height: 60,
        child: Stack(alignment: Alignment.center, children: [
          Container(width: 46, height: 46, decoration: BoxDecoration(color: color.withValues(alpha: 0.18), shape: BoxShape.circle)),
          AnimatedBuilder(
            animation: pulse,
            builder: (_, _) => Transform.scale(
              scale: 0.6 + pulse.value * 2.0,
              child: Container(width: 22, height: 22, decoration: BoxDecoration(color: color.withValues(alpha: 0.45 * (1 - pulse.value)), shape: BoxShape.circle)),
            ),
          ),
          Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3.5), boxShadow: [BoxShadow(color: color.withValues(alpha: 0.6), blurRadius: 5, offset: const Offset(0, 1))]),
          ),
        ]),
      );
}

/// The walking route: a white casing under a coloured line, like a map app.
class RoutePainter extends CustomPainter {
  final List<Offset> points;
  const RoutePainter(this.points);
  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final p in points.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    Paint line(Color c, double w) => Paint()..color = c..style = PaintingStyle.stroke..strokeWidth = w..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, line(Colors.white, 8));
    canvas.drawPath(path, line(const Color(0xFF2B7FFF), 5));
  }

  @override
  bool shouldRepaint(RoutePainter old) => old.points != points;
}

class _ArrowPainter extends CustomPainter {
  final Color color;
  final bool up;
  const _ArrowPainter(this.color, this.up);
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path();
    if (up) {
      path
        ..moveTo(0, size.height)
        ..lineTo(size.width / 2, 0)
        ..lineTo(size.width, size.height);
    } else {
      path
        ..moveTo(0, 0)
        ..lineTo(size.width / 2, size.height)
        ..lineTo(size.width, 0);
    }
    canvas.drawPath(path..close(), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_ArrowPainter old) => old.color != color;
}

/// The callout over a selected pin: picture, name, distance or next show time, and a link through to the detail page.
class Callout extends StatelessWidget {
  final Pin pin;
  final double? distance;
  final bool flipDown;
  final Color card, ink, muted;
  final VoidCallback onOpen, onClose;
  const Callout({super.key, required this.pin, required this.distance, required this.flipDown, required this.card, required this.ink, required this.muted, required this.onOpen, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final sub = distance != null
        ? '${fmtDist(distance!)} away · ~${walkMins(distance!)} min walk'
        : pin.nextTime != null
            ? 'Next show ${fmtTime(pin.nextTime!)}'
            : (pin.subtitle ?? pin.zone ?? 'Kynren — The Storied Lands');
    final body = GestureDetector(
      onTap: onOpen,
      child: Container(
        width: calloutW,
        height: calloutH,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: card, borderRadius: BorderRadius.circular(14), boxShadow: const [BoxShadow(color: Color(0x3D000000), blurRadius: 16, offset: Offset(0, 8))]),
        child: Row(children: [
          Cover(
            image: pin.image,
            color: pin.kind == PinKind.evening ? const Color(0xFF6E1423) : pin.kind == PinKind.restaurant ? featureGradient['restaurants']![0] : Tokens.brand,
            icon: pin.kind == PinKind.restaurant ? Icons.restaurant_rounded : Icons.calendar_month_rounded,
            height: calloutH,
            width: 96,
          ),
          Expanded(
            child: Stack(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 30, 8),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(pin.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontWeight: FontWeight.w700, fontSize: 14.5, height: 18 / 14.5, color: ink)),
                  Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, height: 16 / 12, color: muted))),
                  Padding(padding: const EdgeInsets.only(top: 6), child: Text(pin.kind == PinKind.restaurant ? 'See the menu' : 'More information', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, decoration: TextDecoration.underline, color: ink))),
                ]),
              ),
              Positioned(
                top: 6,
                right: 8,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onClose,
                  child: SizedBox(width: 24, height: 24, child: Center(child: Text('✕', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: muted)))),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
    final arrow = CustomPaint(size: const Size(18, 11), painter: _ArrowPainter(card, flipDown));
    return Column(mainAxisSize: MainAxisSize.min, children: flipDown ? [arrow, body] : [body, arrow]);
  }
}
