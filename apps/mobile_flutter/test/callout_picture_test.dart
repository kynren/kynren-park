import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/theme.dart';
import 'package:storiedlands/screens/map/map_logic.dart';
import 'package:storiedlands/screens/map/map_widgets.dart';
import 'package:storiedlands/ui/cover.dart';

String _png(String b64) => 'data:image/png;base64,$b64';

// flat-colour pictures: a wide logo (4:1), a square one and a tall one (1:4)
final _wide = _png('iVBORw0KGgoAAAANSUhEUgAAAZAAAABkCAIAAAAnqfEgAAABZklEQVR4nO3UMQ0AIADAMEAN/lUgCwt8ZEmrYNfm2XsAFKzfAQCvDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCwgw7CADMMCMgwLyDAsIMOwgAzDAjIMC8gwLCDDsIAMwwIyDAvIMCxgVFxd6gHgjGsV1wAAAABJRU5ErkJggg==');
final _square = _png('iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA6UlEQVR4nO3SMREAIBADQUAN/lUgCwt//W6d6ib73buYOcMdYjWeFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIFYgViBWIteY+BfUB4BOcCicAAAAASUVORK5CYII=');
final _tall = _png('iVBORw0KGgoAAAANSUhEUgAAADIAAADICAIAAAAlVCWZAAABS0lEQVR4nM3OMQEAIAzAsFI1868CWRjgX6Mg587QI0mSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmS5Hbg7wGyWwKoH+nzywAAAABJRU5ErkJggg==');
// pictures whose edge is not one colour (a colour gradient), wide and tall
final _wideBusy = _png('iVBORw0KGgoAAAANSUhEUgAAAZAAAABkCAIAAAAnqfEgAAABm0lEQVR4nO3XQQrCQBBFwR7NKb3/QUQPIIEI+oaqlYKYrD6v18xjZta8rI8frv/gi3+167Oir73rs6KvPZs+a80cc3t/A/h7x9x//QoA5ygsIENhARkKC8hQWECGwQIynIRAhsICMhQWkKGwgAyFBWQoLCDDYAEZTkIgQ2EBGQoLyFBYQIbCAjIUFpBhsIAMJyGQobCADIUFZCgsIENhARkKC8gwWECGkxDIUFhAhsICMhQWkGGwgAwnIZChsIAMhQVkKCwgQ2EBGQoLyDBYQIaTEMhQWECGwgIyFBaQobCADIUFZBgsIMNJCGQoLCBDYQEZCgvIUFhAhsICMgwWkOEkBDIUFpChsIAMhQVkKCwgQ2EBGQYLyHASAhkKC8hQWECGwgIyDBaQ4SQEMhQWkKGwgAyFBWQoLCBDYQEZBgvIcBICGQoLyFBYQIbCAjIUFpChsIAMgwVkOAmBDIUFZCgsIENhARkKC8hQWECGwQIynIRAhsICMhQWkKGwgAyFBWQoLCDDYAEZTkIgQ2EBGQoLyFBYQIbBAqbiCXPgA+bM0IAzAAAAAElFTkSuQmCC');
final _tallBusy = _png('iVBORw0KGgoAAAANSUhEUgAAADIAAADICAIAAAAlVCWZAAABiUlEQVR4nO3SMW5DQQwD0aHA+JC5/0HSBWm3ykDQgwv/TuBs4PsLfn+fP///6/MDJQj1znpQBqFexA1rDUK1rhWEehE3RAxCvbf14CKuWCsI1XrWIFTrWkGoF3FDxCDUe1sPLuKKtYJQrWcNQrWuFYRqPWsQqnWtINSLuCFiEOq9rQcXccVaQajWswahWtcKQr2IGyIGod7benARV6wVhGo9axCqda0gVOtZg1CtawWhXsQNEYNQ7209uIgr1gpCtZ41CNW6VhDqRdwQMQj13taDi7hirSBU61mDUK1rBaFazxqEal0rCPUibogYhHpv68FFXLFWEKr1rEGo1rWCUC/ihohBqPe2HlzEFWsFoVrPGoRqXSsI1XrWIFTrWkGoF3FDxCDUe1sPLuKKtYJQrWcNQrWuFYR6ETdEDEK9t/XgIq5YKwjVetYgVOtaQajWswahWtcKQr2IGyIGod7benARV6wVhGo9axCqda0g1Iu4IWIQ6r2tBxdxxVpBqNazBqFa1wpCdUb8AZ3OBXaNZyuVAAAAAElFTkSuQmCC');
const _red = Color(0xFFC82828);

Widget _card(String? image) => MaterialApp(
      theme: buildTheme(false),
      home: Scaffold(
        body: Center(
          child: Callout(
            pin: Pin(id: 'p', x: 0, y: 0, kind: PinKind.show, title: 'Legend of the Wear', image: image),
            distance: null,
            flipDown: false,
            card: Colors.white,
            ink: Colors.black,
            muted: Colors.grey,
            onOpen: () {},
            onClose: () {},
          ),
        ),
      ),
    );

/// Shows the card and lets the picture shape and edge be read.
Future<void> _show(WidgetTester tester, String? image) async {
  await tester.pumpWidget(_card(image));
  for (var i = 0; i < 8; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 60)));
    await tester.pump(const Duration(milliseconds: 60));
  }
}

Finder get _flat => find.byWidgetPredicate((w) => w is ColoredBox && w.color == _red);

Uint8List _pixels(int w, int h, List<int> Function(int x, int y) at) {
  final out = Uint8List(w * h * 4);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      out.setRange((y * w + x) * 4, (y * w + x) * 4 + 4, at(x, y));
    }
  }
  return out;
}

void ignoreOverflow() {
  final original = FlutterError.onError!;
  FlutterError.onError = (d) {
    if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
    original(d);
  };
  addTearDown(() => FlutterError.onError = original);
}

void main() {
  group('the flat colour round a picture', () {
    test('is found when the edge is one colour, even with a little noise, and the middle does not matter', () {
      final logo = _pixels(40, 20, (x, y) => (x > 8 && x < 31 && y > 5 && y < 14) ? [250, 250, 250, 255] : [60, 100, 50, 255]);
      expect(uniformEdgeColour(logo, 40, 20), const Color(0xFF3C6432));
      final noisy = _pixels(40, 20, (x, y) => [60 + (x * 7 + y) % 9, 100 - (x + y * 3) % 9, 50, 255]);
      expect(uniformEdgeColour(noisy, 40, 20), isNotNull);
    });

    test('is not claimed for a picture whose edge changes colour, or one that is see-through', () {
      final photo = _pixels(40, 20, (x, y) => [x * 6, y * 12, 90, 255]);
      expect(uniformEdgeColour(photo, 40, 20), isNull);
      final clear = _pixels(40, 20, (x, y) => [60, 100, 50, 0]);
      expect(uniformEdgeColour(clear, 40, 20), isNull, reason: 'the card shows through: there is no colour to match');
      expect(uniformEdgeColour(Uint8List(0), 0, 0), isNull);
    });
  });

  test('a picture about the shape of the slot fills it; any other shape gets a box of its own shape, inside the slot', () {
    final slot = calloutPictureBox(calloutSlotW / calloutH);
    expect((slot.w, slot.h, slot.bleed), (calloutSlotW, calloutH, true));
    expect(calloutPictureBox(null).bleed, isTrue, reason: 'until the shape is known');
    expect(calloutPictureBox(1.1).bleed, isTrue, reason: 'close enough to fill, losing only a sliver');
    expect(calloutPictureBox(double.nan).bleed, isTrue);

    final wide = calloutPictureBox(4);
    expect(wide.bleed, isFalse);
    expect(wide.w, calloutSlotW - 16, reason: 'as wide as the margin allows, never wider than the slot');
    expect(wide.h, 28, reason: 'a very wide logo is not made any smaller than this');

    final tall = calloutPictureBox(0.25);
    expect(tall.bleed, isFalse);
    expect(tall.h, calloutH - 16);
    expect(tall.w, 40);

    final photo = calloutPictureBox(1.5);
    expect(photo.w / photo.h, closeTo(1.5, 0.01), reason: 'the box has the shape of the picture');
    expect(photo.w, lessThanOrEqualTo(calloutSlotW - 16));
    expect(photo.h, lessThanOrEqualTo(calloutH - 16));
  });

  testWidgets('a logo on a flat background fills the whole slot with its own colour and shows all of the logo on it', (tester) async {
    ignoreOverflow();
    for (final image in [_wide, _tall]) {
      await _show(tester, image);
      expect(_flat, findsOneWidget, reason: 'the slot is the picture colour');
      expect(tester.getSize(_flat), const Size(calloutSlotW, calloutH), reason: 'filling the slot, and never wider than it');
      expect(tester.widgetList<Image>(find.byType(Image)).single.fit, BoxFit.contain, reason: 'the whole picture');
      expect(find.byType(ImageFiltered), findsNothing);
      expect(find.byType(Cover), findsNothing);
    }
  });

  testWidgets('a picture about the shape of the slot fills it edge to edge', (tester) async {
    ignoreOverflow();
    await _show(tester, _square);
    expect(tester.getSize(find.byType(Cover)), const Size(calloutSlotW, calloutH));
    expect(tester.widgetList<Image>(find.byType(Image)).single.fit, BoxFit.cover);
    expect(find.byType(ImageFiltered), findsNothing);
  });

  testWidgets('a picture with a busy edge is shown whole in a box of its own shape, with no underlay', (tester) async {
    ignoreOverflow();
    await _show(tester, _wideBusy);
    final wide = tester.getSize(find.byType(Cover));
    expect(wide.width, lessThanOrEqualTo(calloutSlotW));
    expect(wide.width / wide.height, greaterThan(2.5), reason: 'a wide box for a wide picture');
    expect(_flat, findsNothing);
    expect(find.byType(ImageFiltered), findsNothing);
    expect(tester.widgetList<Image>(find.byType(Image)).single.fit, BoxFit.contain);

    await _show(tester, _tallBusy);
    final tall = tester.getSize(find.byType(Cover));
    expect(tall.width, lessThan(calloutSlotW), reason: 'a narrow picture gets a narrow box');
    expect(tall.height, lessThanOrEqualTo(calloutH));
  });

  testWidgets('with no picture the illustrated panel fills the slot', (tester) async {
    ignoreOverflow();
    await _show(tester, null);
    expect(tester.getSize(find.byType(Cover)), const Size(calloutSlotW, calloutH));
  });

  testWidgets('the notice at the top of the map says what is wrong and offers the fix', (tester) async {
    var enabled = 0, closed = 0;
    Widget host(bool away) => MaterialApp(theme: buildTheme(false), home: Scaffold(body: LocationNotice(awayFromPark: away, onEnable: () => enabled++, onClose: () => closed++)));

    await tester.pumpWidget(host(false));
    expect(find.text('Location is off'), findsOneWidget);
    expect(find.textContaining('Turn it on to see where you are'), findsOneWidget);
    await tester.tap(find.text('Turn on'));
    await tester.tap(find.byIcon(Icons.close_rounded));
    expect((enabled, closed), (1, 1));

    await tester.pumpWidget(host(true));
    expect(find.text('You seem to be outside the park'), findsOneWidget);
    expect(find.text('Turn on'), findsNothing, reason: 'nothing to turn on: they are simply not here yet');
  });
}
