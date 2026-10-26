import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/screens/map/map_logic.dart';

void main() {
  const canvas = Size(1000, 800), vp = Size(400, 600);

  test('composeView puts the chosen map point under the chosen screen point, at any turn', () {
    for (final angle in [0.0, 0.7, -1.9, math.pi]) {
      final m = composeView(scale: 2.5, angle: angle, content: const Offset(300, 120), screen: const Offset(200, 300));
      final on = viewToScreen(m, const Offset(300, 120));
      expect(on.dx, closeTo(200, 1e-6));
      expect(on.dy, closeTo(300, 1e-6));
      expect(viewAngle(m), closeTo(math.atan2(math.sin(angle), math.cos(angle)), 1e-9));
      expect(m.getMaxScaleOnAxis(), closeTo(2.5, 1e-9));
      final back = viewToContent(m, on);
      expect(back.dx, closeTo(300, 1e-6));
      expect(back.dy, closeTo(120, 1e-6));
    }
  });

  test('unrotated, the map cannot be dragged off its edges', () {
    final far = composeView(scale: 1.5, angle: 0, content: const Offset(0, 0), screen: const Offset(300, 200));
    final m = clampView(far, canvas, vp);
    expect(m.storage[12], 0);
    expect(m.storage[13], 0);
  });

  test('turned, the middle of the screen stays on the map', () {
    final far = composeView(scale: 1.5, angle: 0.8, content: const Offset(-900, -900), screen: const Offset(200, 300));
    final m = clampView(far, canvas, vp);
    final mid = viewToContent(m, Offset(vp.width / 2, vp.height / 2));
    expect(mid.dx, inInclusiveRange(0, canvas.width));
    expect(mid.dy, inInclusiveRange(0, canvas.height));
    expect(viewAngle(m), closeTo(0.8, 1e-9));
  });

  test('angleDelta takes the short way round', () {
    expect(angleDelta(3.0, -3.0), closeTo(2 * math.pi - 6.0, 1e-9));
    expect(angleDelta(0, 0.5), closeTo(0.5, 1e-9));
  });
}
