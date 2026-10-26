import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:storiedlands/app/router.dart';
import 'package:storiedlands/core/format.dart';
import 'package:storiedlands/main.dart';

class _FakePathProvider extends Fake with MockPlatformInterfaceMixin implements PathProviderPlatform {
  final String dir;
  _FakePathProvider(this.dir);
  @override
  Future<String?> getApplicationSupportPath() async => dir;
}

Future<void> _settle(WidgetTester tester, [int frames = 8]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  testWidgets('search ranks, finds screens by their words, and suggests a spelling when nothing matches', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    final dir = Directory.systemTemp.createTempSync('kynren_search_test');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/kynren_bundle_${ukTodayStr()}.json').writeAsStringSync(File('test/fixtures/bundle.json').readAsStringSync());
    PathProviderPlatform.instance = _FakePathProvider(dir.path);
    SharedPreferences.setMockInitialValues({});

    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    await tester.runAsync(() async {
      await tester.pumpWidget(const KynrenApp());
      await Future<void>.delayed(const Duration(seconds: 2));
    });
    await _settle(tester, 40);
    router.go('/search');
    await _settle(tester, 20);

    final box = find.byType(TextField).first;

    // A real name finds the place, with the typed part picked out, and says how many there are.
    await tester.enterText(box, 'vikings');
    await _settle(tester);
    expect(find.textContaining('result'), findsWidgets);
    expect(find.textContaining('Land of the', findRichText: true), findsWidgets);

    // A word for a screen offers that screen.
    await tester.enterText(box, 'bus');
    await _settle(tester);
    expect(find.text('Go to'), findsOneWidget);
    expect(find.textContaining('Shuttle', findRichText: true), findsWidgets);

    // A slip finds nothing, and the park's own word is offered.
    await tester.enterText(box, 'vikngs');
    await _settle(tester);
    expect(find.textContaining('Nothing found'), findsOneWidget);
    expect(find.textContaining('Did you mean “vikings”?'), findsOneWidget);
    await tester.tap(find.textContaining('Did you mean'));
    await _settle(tester);
    expect(find.textContaining('Nothing found'), findsNothing);

    // Saved is empty for a guest with nothing saved.
    await tester.enterText(box, '');
    await _settle(tester);
    await tester.tap(find.text('Saved'));
    await _settle(tester);
    expect(find.text('Nothing saved yet'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
