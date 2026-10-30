import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:storiedlands/app/router.dart';
import 'package:storiedlands/core/format.dart';
import 'package:storiedlands/core/location.dart';
import 'package:storiedlands/core/meeting.dart';
import 'package:storiedlands/core/offline.dart';
import 'package:storiedlands/core/sync.dart';
import 'package:storiedlands/core/theme.dart';
import 'package:storiedlands/main.dart';
import 'package:storiedlands/ui/meeting_card.dart';

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
  group('telling a guest the phone is offline', () {
    test('says when the park was last saved: the time today, the date on another day, nothing about age when unknown', () {
      final now = DateTime.utc(2026, 10, 27, 15, 0);
      expect(offlineNote(DateTime.utc(2026, 10, 27, 9, 42), now), 'You’re offline. Showing the park as it was saved at 09:42.', reason: 'British Summer Time ended on 25 October, so UK time is UTC');
      expect(offlineNote(DateTime.utc(2026, 10, 26, 18, 0), now), contains('on 26 October'));
      expect(offlineNote(null, now), 'You’re offline. Showing the park as it was saved on your phone.');
    });
  });

  group('the meeting spot', () {
    test('is kept as written and read back, and an unreadable value is no spot at all', () {
      final spot = MeetSpot(54.671234, -1.678901, DateTime.fromMillisecondsSinceEpoch(1790000000000));
      final back = MeetSpot.fromJson(spot.toJson())!;
      expect([back.lat, back.lng, back.savedAt], [spot.lat, spot.lng, spot.savedAt]);
      expect(MeetSpot.fromJson(null), isNull);
      expect(MeetSpot.fromJson('not json'), isNull);
      expect(MeetSpot.fromJson('{"lat": "x"}'), isNull);
    });

    test('is sent as a link that opens in any maps app, with the place named', () {
      final spot = MeetSpot(54.6712341, -1.6789012, DateTime(2026, 10, 27));
      expect(meetLink(spot), 'https://www.google.com/maps/search/?api=1&query=54.671234,-1.678901');
      expect(meetText(spot), startsWith('Meet me here at Kynren – The Storied Lands:\n'));
      expect(meetText(spot), endsWith(meetLink(spot)));
    });
  });

  testWidgets('the meeting card marks where the guest is, remembers it, and clears it; it cannot mark a spot without a position', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final location = LocationState();
    Widget app() => ChangeNotifierProvider<LocationState>.value(
          value: location,
          child: MaterialApp(theme: buildTheme(false), home: const Scaffold(body: MeetingCard())),
        );

    await tester.pumpWidget(app());
    await tester.pump();
    expect(find.text('Meeting spot'), findsOneWidget);
    expect(find.text('Turn on location to mark a spot.'), findsOneWidget);
    await tester.tap(find.text('Mark where I am'));
    await tester.pump();
    expect(find.textContaining('Marked at'), findsNothing, reason: 'with no position there is nothing to mark');

    location.gps = const Geo(54.6712, -1.6789);
    location.notifyListeners();
    await tester.pump();
    expect(find.text('Turn on location to mark a spot.'), findsNothing);
    await tester.tap(find.text('Mark where I am'));
    await tester.pump();
    expect(find.textContaining('Marked at'), findsOneWidget);
    expect(find.textContaining('min walk'), findsOneWidget, reason: 'standing on it');
    expect(find.text('Send to my group'), findsOneWidget);
    expect(find.text('Open in Maps'), findsOneWidget);
    final saved = MeetSpot.fromJson((await SharedPreferences.getInstance()).getString('kynren_meeting_spot'));
    expect([saved!.lat, saved.lng], [54.6712, -1.6789], reason: 'kept for next time');

    // closing and reopening the app finds it again
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(app());
    await tester.pump();
    await tester.pump();
    expect(find.textContaining('Marked at'), findsOneWidget);

    await tester.tap(find.text('Clear'));
    await tester.pump();
    expect(find.text('Mark where I am'), findsOneWidget);
    expect((await SharedPreferences.getInstance()).getString('kynren_meeting_spot'), isNull);
  });

  testWidgets('Home says so when the phone is offline, and stops saying so when it is back', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    final bundle = jsonDecode(File('test/fixtures/bundle.json').readAsStringSync()) as Map<String, dynamic>;
    bundle['date'] = ukTodayStr();
    final dir = Directory.systemTemp.createTempSync('kynren_offline_test');
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
    router.go('/');
    await _settle(tester, 20);
    expect(find.textContaining('You’re offline'), findsNothing);

    final sync = tester.element(find.byType(Scaffold).first).read<SyncState>();
    sync.online = false;
    sync.lastSynced = DateTime.now();
    sync.notifyListeners();
    await _settle(tester, 8);
    expect(find.textContaining('You’re offline. Showing the park as it was saved at'), findsOneWidget);

    sync.online = true;
    sync.notifyListeners();
    await _settle(tester, 8);
    expect(find.textContaining('You’re offline'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
