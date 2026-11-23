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
  testWidgets('the Eat tab offers no ordering, filters by diet, and a dish can be saved and found again', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    final bundle = jsonDecode(File('test/fixtures/bundle.json').readAsStringSync()) as Map<String, dynamic>;
    bundle['date'] = ukTodayStr();
    final dir = Directory.systemTemp.createTempSync('kynren_eat_test');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/kynren_bundle_${ukTodayStr()}.json').writeAsStringSync(jsonEncode(bundle));
    PathProviderPlatform.instance = _FakePathProvider(dir.path);
    SharedPreferences.setMockInitialValues({});

    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    await tester.runAsync(() async {
      await tester.pumpWidget(const KynrenApp());
      await Future<void>.delayed(const Duration(seconds: 2));
    });
    await _settle(tester, 40);
    router.go('/food');
    await _settle(tester, 20);

    // nothing to order yet: no Click & Collect, no order button, and the words say menus and opening times
    expect(find.text('Menus, opening hours and dietary choices'), findsOneWidget);
    expect(find.text('Click & Collect'), findsNothing);
    expect(find.text('Order now'), findsNothing);
    expect(find.text('Order food'), findsNothing);
    expect(find.text('See menu'), findsWidgets);

    // the filters the menus support are offered, and one narrows the list: only one place has a vegan dish
    expect(find.text('Open now'), findsOneWidget);
    expect(find.text('Vegan'), findsOneWidget);
    expect(find.text('Gluten free'), findsOneWidget);
    expect(find.text('Pizza Shop'), findsOneWidget);
    expect(find.text('Time Travelers Restaurant'), findsOneWidget);
    await tester.drag(find.text('Open now'), const Offset(-300, 0));
    await _settle(tester, 4);
    await tester.tap(find.text('Vegan').first);
    await _settle(tester, 6);
    expect(find.text('Pizza Shop'), findsOneWidget);
    expect(find.text('Time Travelers Restaurant'), findsNothing);
    await tester.drag(find.text('Vegan').first, const Offset(600, 0));
    await _settle(tester, 4);
    await tester.tap(find.text('All'));
    await _settle(tester, 6);
    expect(find.text('Time Travelers Restaurant'), findsOneWidget);

    // a restaurant's page: clean hours, no ordering, a dietary filter on the menu, dishes that can be saved
    router.go('/restaurant/${(bundle['restaurants'] as List).first['slug']}');
    await _settle(tester, 20);
    expect(find.textContaining('Today 10:30 – 18:00'), findsOneWidget);
    expect(find.text('Order ahead'), findsNothing);
    expect(find.text('Sign in to order'), findsNothing);
    expect(find.textContaining('Allergies or intolerances?'), findsWidgets);
    await tester.tap(find.text('Vegan').first);
    await _settle(tester, 6);
    expect(find.text('Garden Veg Wellington'), findsOneWidget);
    expect(find.text('Fish & Chips'), findsNothing);
    await tester.tap(find.text('Vegan').first); // tapping it again shows every dish
    await _settle(tester, 6);
    expect(find.text('Fish & Chips'), findsOneWidget);

    final save = find.byWidgetPredicate((w) => w is Tap && w.label == 'Save Garden Veg Wellington');
    await tester.ensureVisible(save);
    await tester.pump();
    await tester.tap(save);
    await _settle(tester, 4);
    expect(find.byWidgetPredicate((w) => w is Tap && w.label == 'Remove Garden Veg Wellington from saved dishes'), findsOneWidget);

    router.go('/food');
    await _settle(tester, 20);
    expect(find.text('Your saved dishes'), findsOneWidget);
    expect(find.text('Garden Veg Wellington'), findsOneWidget);

    // the meal shortcuts show what is really on: nothing here is sweet, so the sweet break says so
    router.go('/restaurants?slot=sweet');
    await _settle(tester, 20);
    expect(find.text('Time Travelers Restaurant'), findsOneWidget, reason: 'its warm cookie is a sweet treat');
    expect(find.text('Pizza Shop'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
