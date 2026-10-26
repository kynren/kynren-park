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

String _iso(DateTime d) => '${d.toIso8601String().split('.').first}.000Z';

void main() {
  testWidgets('the programme says what is on now and what is next, and its chips narrow the list', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    // The saved park data, with its show times moved to around "now" so there is something on today.
    final bundle = jsonDecode(File('test/fixtures/bundle.json').readAsStringSync()) as Map<String, dynamic>;
    final now = ukNow();
    final sessions = (bundle['sessions'] as List).cast<Map<String, dynamic>>();
    final starts = [-10, 25, 180, 200, 220, 240, 260];
    final lengths = [60, 30, 30, 30, 30, 30, 30];
    for (var i = 0; i < sessions.length; i++) {
      sessions[i]
        ..['startTime'] = _iso(now.add(Duration(minutes: starts[i])))
        ..['endTime'] = _iso(now.add(Duration(minutes: starts[i] + lengths[i])))
        ..['revisedStart'] = null
        ..['status'] = 'SCHEDULED';
    }
    bundle['date'] = ukTodayStr();
    final dir = Directory.systemTemp.createTempSync('kynren_prog_test');
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
    router.go('/shows');
    await _settle(tester, 20);

    expect(find.text('ON NOW'), findsOneWidget); // the up-next card features the show that is playing
    expect(find.textContaining('On now · until'), findsWidgets);
    expect(find.text('All'), findsOneWidget);

    await tester.tap(find.text('On now & soon'));
    await _settle(tester, 6);
    expect(find.textContaining('Starts in'), findsWidgets); // the show 25 minutes away is "soon"
    expect(find.text('Nothing is on or starting within the hour.'), findsNothing);

    await tester.ensureVisible(find.text('Favourites')); // the chips scroll sideways, and the test font is wide
    await tester.pump();
    await tester.tap(find.text('Favourites'));
    await _settle(tester, 6);
    expect(find.textContaining('No favourites on today'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
