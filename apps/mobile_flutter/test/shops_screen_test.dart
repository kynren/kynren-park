import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:storiedlands/app/router.dart';
import 'package:storiedlands/core/format.dart';
import 'package:storiedlands/main.dart';
import 'package:storiedlands/ui/tap.dart';

class _FakePathProvider extends Fake with MockPlatformInterfaceMixin implements PathProviderPlatform {
  final String dir;
  _FakePathProvider(this.dir);
  @override
  Future<String?> getApplicationSupportPath() async => dir;
}

Future<void> _settle(WidgetTester tester, [int frames = 12]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  testWidgets('the Shops screen lists the shops, finds a gift by name or budget, and the shop page groups prices and saves products', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    final bundle = jsonDecode(File('test/fixtures/bundle.json').readAsStringSync()) as Map<String, dynamic>;
    bundle['date'] = ukTodayStr();
    final dir = Directory.systemTemp.createTempSync('kynren_shops_test');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/kynren_bundle_${ukTodayStr()}.json').writeAsStringSync(jsonEncode(bundle));
    PathProviderPlatform.instance = _FakePathProvider(dir.path);
    SharedPreferences.setMockInitialValues({});

    tester.view.physicalSize = const Size(780, 6000);
    tester.view.devicePixelRatio = 2;
    await tester.runAsync(() async {
      await tester.pumpWidget(const KynrenApp());
      await Future<void>.delayed(const Duration(seconds: 2));
    });
    await _settle(tester, 40);

    // the list: every shop, each with a way in; no hours in the data, so nothing claims to be open or shut
    router.go('/shops');
    await _settle(tester, 20);
    expect(find.text('Gifts, souvenirs and prices'), findsOneWidget);
    expect(find.text('The Bird Shop'), findsOneWidget);
    expect(find.text('The Kynren Shop'), findsOneWidget);
    expect(find.text('Viking Shop'), findsOneWidget);
    expect(find.text('See products'), findsNWidgets(3));
    expect(find.textContaining('open now'), findsNothing);
    expect(find.text('Open now'), findsNothing);

    // a budget lists the gifts that cost that little, from every shop, each with its shop
    expect(find.text('Under £5'), findsOneWidget);
    await tester.tap(find.text('Under £5'));
    await _settle(tester, 6);
    expect(find.textContaining('Under £5 ·'), findsOneWidget);
    expect(find.text('Poncho'), findsNWidgets(3));
    expect(find.text('Kynren Cap'), findsNothing, reason: 'it costs £15');
    await tester.tap(find.text('All'));
    await _settle(tester, 6);

    // a search finds a product wherever it is sold
    await tester.enterText(find.byType(TextField), 'poncho');
    await _settle(tester, 6);
    expect(find.text('3 products'), findsOneWidget);
    expect(find.text('Poncho'), findsNWidgets(3));
    expect(find.text('The Kynren Shop'), findsOneWidget, reason: 'named under the product it sells');
    await tester.enterText(find.byType(TextField), 'zzz');
    await _settle(tester, 6);
    expect(find.textContaining('Nothing matches'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '');
    await _settle(tester, 6);

    // a shop page: the adult and child prices on one product, a way to share, the catch-all line on its own, the other shops
    router.go('/shop/the-kynren-shop');
    await _settle(tester, 20);
    expect(find.text('Adult £25'), findsOneWidget);
    expect(find.text('Child £20'), findsOneWidget);
    expect(find.text('Kynren Hoodies'), findsOneWidget, reason: 'one product, not one per price');
    expect(find.text('Share prices'), findsOneWidget);
    expect(find.text('Also in store'), findsOneWidget);
    expect(find.text('Other souvenirs and gifts'), findsOneWidget);
    expect(find.text('More shops'), findsOneWidget);

    // ordering by price puts the cheapest first
    await tester.tap(find.text('Cheapest'));
    await _settle(tester, 6);
    final cheapest = tester.getTopLeft(find.text('Poncho').first).dy;
    final hoodie = tester.getTopLeft(find.text('Kynren Hoodies')).dy;
    expect(cheapest, lessThan(hoodie));

    // a product can be saved, and then found again from the Saved chip here and on the Shops screen
    expect(find.text('Saved'), findsNothing);
    final save = find.byWidgetPredicate((w) => w is Tap && w.label == 'Save Kynren Cap');
    await tester.ensureVisible(save);
    await tester.tap(save);
    await _settle(tester, 6);
    expect(find.text('Saved'), findsOneWidget);
    await tester.tap(find.text('Saved'));
    await _settle(tester, 6);
    expect(find.text('Kynren Cap'), findsOneWidget);
    expect(find.text('Kynren Hoodies'), findsNothing);

    router.go('/shops');
    await _settle(tester, 20);
    await tester.drag(find.text('Under £5'), const Offset(-400, 0)); // the chips are a lazy row: bring the last one in
    await _settle(tester, 4);
    await tester.tap(find.text('Saved'));
    await _settle(tester, 6);
    expect(find.text('Your saved products'), findsOneWidget);
    expect(find.text('1 product'), findsOneWidget);
    expect(find.text('From £15 in all'), findsOneWidget);
    expect(find.text('Share list'), findsOneWidget);
    expect(find.text('Kynren Cap'), findsOneWidget);
    expect(find.text('The Kynren Shop'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
