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

Future<void> _settle(WidgetTester tester, [int frames = 12]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

String _firstAttractionId() {
  final text = File('test/fixtures/bundle.json').readAsStringSync();
  return RegExp(r'"attractions":\[\{"id":"([^"]+)"').firstMatch(text)!.group(1)!;
}

void main() {
  testWidgets('the whole app boots with park data, and every screen opens, without a framework error', (tester) async {
    // Text in tests uses the square 'Ahem' font, so layout overflows there say nothing about a phone; everything else counts.
    final errors = <String>[];
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return;
      original(d);
    };
    // Whatever the framework caught since the last look; missing plugins (camera, speech, Firebase) are only absent from the test host.
    void collect() {
      final e = tester.takeException();
      if (e != null && !e.toString().contains('MissingPluginException')) errors.add(e.toString().split('\n').first);
    }
    addTearDown(() => FlutterError.onError = original);

    // A saved copy of the park's data (the same shape the API sends), so the screens have real content to draw.
    final dir = Directory.systemTemp.createTempSync('kynren_test');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/kynren_bundle_${ukTodayStr()}.json').writeAsStringSync(File('test/fixtures/bundle.json').readAsStringSync());
    PathProviderPlatform.instance = _FakePathProvider(dir.path);
    SharedPreferences.setMockInitialValues({});

    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    await tester.runAsync(() async {
      await tester.pumpWidget(const KynrenApp());
      await Future<void>.delayed(const Duration(seconds: 2)); // let the saved data load off the UI thread
    });
    await _settle(tester, 40);
    collect();
    expect(errors, isEmpty, reason: 'boot');

    // Tabs, the map with a place chosen (which opens its callout), then screens pushed over the tabs.
    // The scanner and read-aloud screens need a real device.
    for (final path in ['/map', '/search', '/food', '/', '/map?focus=${_firstAttractionId()}']) {
      router.go(path);
      await _settle(tester, 20);
      collect();
      expect(errors, isEmpty, reason: path);
    }
    for (final path in [
      '/shows', '/plan', '/tickets', '/menu', '/settings', '/profile', '/auth', '/language', '/orders',
      '/shuttle', '/accessibility', '/favorites', '/seen', '/find-bookings', '/restaurants?slot=lunch',
      '/attraction/land-of-the-vikings', '/restaurant/storytellers-tavern', '/restaurant/lakeside-kitchen',
      '/facility/none', '/ticket/none', '/search?filter=shop',
    ]) {
      router.push(path);
      await _settle(tester);
      collect();
      expect(errors, isEmpty, reason: path);
      router.pop();
      await _settle(tester, 4);
      collect();
      expect(errors, isEmpty, reason: 'closing $path');
    }

    // Shut the app down so its live connection's timers do not outlive the test.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
