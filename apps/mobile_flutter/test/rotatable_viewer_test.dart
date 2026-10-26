import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/screens/map/map_logic.dart';
import 'package:storiedlands/screens/map/rotatable_viewer.dart';

void main() {
  const vp = Size(400, 600), canvas = Size(800, 1200);

  Future<TransformationController> pump(WidgetTester tester) async {
    final c = TransformationController();
    await tester.pumpWidget(Directionality(
      textDirection: TextDirection.ltr,
      child: SizedBox(
        width: vp.width,
        height: vp.height,
        child: RotatableViewer(
          controller: c,
          constrain: (m) => clampView(m, canvas, vp),
          minScale: 1,
          maxScale: 8,
          child: const SizedBox(width: 800, height: 1200, child: ColoredBox(color: Colors.green)),
        ),
      ),
    ));
    return c;
  }

  // Two fingers either side of the centre, turned by [turn] radians and spread by [spread] times.
  Future<void> twist(WidgetTester tester, {required double turn, double spread = 1}) async {
    const mid = Offset(200, 300);
    const r = 80.0;
    final a = await tester.startGesture(mid + const Offset(-r, 0), pointer: 1);
    final b = await tester.startGesture(mid + const Offset(r, 0), pointer: 2);
    for (var i = 1; i <= 10; i++) {
      final t = i / 10;
      final ang = math.pi + turn * t, rr = r * (1 + (spread - 1) * t);
      await a.moveTo(mid + Offset(math.cos(ang) * rr, math.sin(ang) * rr));
      await b.moveTo(mid + Offset(math.cos(ang + math.pi) * rr, math.sin(ang + math.pi) * rr));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await a.up();
    await b.up();
    await tester.pumpAndSettle();
  }

  testWidgets('a two-finger twist rotates the map', (tester) async {
    final c = await pump(tester);
    await twist(tester, turn: 0.9);
    expect(viewAngle(c.value).abs(), greaterThan(0.4));
  });

  testWidgets('a small twist while zooming is ignored, so zooming does not tilt the map', (tester) async {
    final c = await pump(tester);
    await twist(tester, turn: 0.08, spread: 2);
    expect(viewAngle(c.value), 0);
    expect(c.value.getMaxScaleOnAxis(), greaterThan(1.5));
  });

  testWidgets('a one-finger drag pans without rotating', (tester) async {
    final c = await pump(tester);
    // zoom in first so there is room to pan
    await twist(tester, turn: 0, spread: 2);
    final before = c.value.getTranslation().clone();
    await tester.dragFrom(const Offset(200, 300), const Offset(60, 40));
    await tester.pumpAndSettle();
    expect(viewAngle(c.value), 0);
    expect(c.value.getTranslation().x, isNot(closeTo(before.x, 1)));
  });
}
