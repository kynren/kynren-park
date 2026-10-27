import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/theme.dart';
import 'package:storiedlands/ui/cover.dart';

// A 1 x 1 PNG, as an embedded picture.
const _png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

Widget _host(Widget child) => MaterialApp(theme: buildTheme(false), home: Center(child: SizedBox(width: 96, height: 104, child: child)));

void main() {
  testWidgets('a cover fits the whole picture inside its box over a blurred copy, unless asked to fill the box', (tester) async {
    await tester.pumpWidget(_host(const Cover(image: _png, height: 104, width: 96)));
    expect(find.byType(ImageFiltered), findsOneWidget, reason: 'the soft backdrop that fills the space round a fitted picture');
    expect(tester.widgetList<Image>(find.byType(Image)).any((i) => i.fit == BoxFit.contain), isTrue);

    await tester.pumpWidget(_host(const Cover(image: _png, height: 104, width: 96, fit: BoxFit.cover)));
    expect(find.byType(ImageFiltered), findsNothing, reason: 'filling the box leaves no space to fill');
    final images = tester.widgetList<Image>(find.byType(Image)).toList();
    expect(images, hasLength(1));
    expect(images.single.fit, BoxFit.cover);
  });

  testWidgets('with no picture it still shows the illustrated panel, whatever the fit', (tester) async {
    await tester.pumpWidget(_host(const Cover(height: 104, width: 96, fit: BoxFit.cover)));
    expect(find.byType(Image), findsNothing);
    expect(find.byType(Icon), findsOneWidget);
  });

  testWidgets('a fitted picture can be drawn without the blurred underlay', (tester) async {
    await tester.pumpWidget(_host(const Cover(image: _png, height: 104, width: 96, underlay: false)));
    expect(find.byType(ImageFiltered), findsNothing);
    final images = tester.widgetList<Image>(find.byType(Image)).toList();
    expect(images, hasLength(1));
    expect(images.single.fit, BoxFit.contain, reason: 'still the whole picture');
  });
}
