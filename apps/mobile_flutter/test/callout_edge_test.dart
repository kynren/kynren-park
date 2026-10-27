import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/theme.dart';
import 'package:storiedlands/screens/map/map_logic.dart';
import 'package:storiedlands/screens/map/map_widgets.dart';

const _screen = 390.0;

Widget _card({double arrowOffset = 0}) => MaterialApp(
      theme: buildTheme(false),
      home: Scaffold(
        body: Center(
          child: Callout(
            pin: const Pin(id: 'p', x: 0, y: 0, kind: PinKind.facility, title: 'Picnic', subtitle: 'picnic'),
            distance: null,
            flipDown: false,
            arrowOffset: arrowOffset,
            card: Colors.white,
            ink: Colors.black,
            muted: Colors.grey,
            onOpen: () {},
            onClose: () {},
          ),
        ),
      ),
    );

Finder get _pointer => find.byWidgetPredicate((w) => w is CustomPaint && w.size == const Size(18, 11));

void main() {
  group('keeping the place card on the screen', () {
    test('a marker in the middle of the screen leaves the card where it is', () {
      expect(calloutShift(_screen / 2, _screen), 0);
      expect(calloutShift(_screen / 2 + 30, _screen), 0);
    });

    test('a marker near the left edge slides the card right, until it is 12 pixels in from the edge', () {
      final shift = calloutShift(20, _screen);
      final left = 20 - calloutW / 2 + shift;
      expect(left, 12);
      expect(shift, greaterThan(0));
      expect(calloutShift(-200, _screen) + (-200 - calloutW / 2), 12, reason: 'even a marker off the screen only moves the card as far as the edge');
    });

    test('a marker near the right edge slides the card left, until it is 12 pixels in from the edge', () {
      final shift = calloutShift(_screen - 15, _screen);
      expect(_screen - 15 - calloutW / 2 + shift + calloutW, _screen - 12);
      expect(shift, lessThan(0));
    });

    test('a screen too narrow for the card keeps it at the left edge instead of failing', () {
      expect(calloutShift(100, 250) + (100 - calloutW / 2), 12);
    });
  });

  testWidgets('the pointer stays on the marker while the card slides: it moves the opposite way, and never leaves the card', (tester) async {
    await tester.pumpWidget(_card());
    final centred = tester.getCenter(_pointer).dx;
    final body = tester.getCenter(find.byType(Callout)).dx;
    expect(centred, closeTo(body, 0.5), reason: 'by default the pointer is under the middle of the card');

    await tester.pumpWidget(_card(arrowOffset: -60));
    expect(tester.getCenter(_pointer).dx, closeTo(centred - 60, 0.5));

    await tester.pumpWidget(_card(arrowOffset: 400));
    expect(tester.getCenter(_pointer).dx - centred, calloutW / 2 - 28, reason: 'held clear of the rounded corner');
    await tester.pumpWidget(_card(arrowOffset: -400));
    expect(centred - tester.getCenter(_pointer).dx, calloutW / 2 - 28);
  });
}
