import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:storiedlands/app/router.dart';
import 'package:storiedlands/core/essentials.dart';
import 'package:storiedlands/core/format.dart';
import 'package:storiedlands/core/location.dart';
import 'package:storiedlands/core/models.dart';
import 'package:storiedlands/main.dart';

Poi _poi(String id, String type, String name, double lat, double lng, {String? zone}) =>
    Poi.fromJson({'id': id, 'type': type, 'name': name, 'lat': lat, 'lng': lng, 'mapZone': zone});

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
  // One degree of latitude is about 111 km, so 0.001 is about 111 m: a minute and a half's walk.
  const here = Geo(54.6700, -1.6800);
  final pois = [
    _poi('far', 'RESTROOM', 'Far toilets', 54.6730, -1.6800), // about 333 m
    _poi('near', 'RESTROOM', 'Near toilets', 54.6710, -1.6800), // about 111 m
    _poi('aid', 'FIRST_AID', 'First aid', 54.6720, -1.6800),
    _poi('park', 'PARKING', 'Car park', 54.6690, -1.6800),
    _poi('water', 'WATER_POINT', 'Water point', 54.6705, -1.6800),
    _poi('shop', 'SHOP', 'A shop', 54.6701, -1.6800),
    _poi('act', 'ATTRACTION', 'A show', 54.6701, -1.6800),
    _poi('food', 'RESTAURANT', 'A cafe', 54.6701, -1.6800),
    _poi('lost', 'INFO', 'Unplaced', 0, 0),
  ];

  group('what counts as an essential', () {
    final groups = essentialGroups(pois, here);

    test('attractions, shops and restaurants have their own screens, and a place never put on the map is left out', () {
      final ids = [for (final g in groups) for (final s in g.spots) s.poi.id];
      expect(ids, isNot(contains('shop')));
      expect(ids, isNot(contains('act')));
      expect(ids, isNot(contains('food')));
      expect(ids, isNot(contains('lost')));
    });

    test('the known kinds come in their usual order, then any other kind the park adds', () {
      expect(groups.map((g) => g.type), ['RESTROOM', 'FIRST_AID', 'PARKING', 'WATER_POINT']);
    });

    test('with a position, the nearest of each kind comes first', () {
      final toilets = groups.first;
      expect(toilets.spots.map((s) => s.poi.id), ['near', 'far']);
      expect(toilets.nearest.poi.id, 'near');
    });

    test('without a position the park\'s own order is kept and no distance is claimed', () {
      final none = essentialGroups(pois, null);
      expect(none.first.spots.map((s) => s.poi.id), ['far', 'near']);
      expect(none.first.nearest.distanceText, isNull);
      expect(none.first.nearest.walk, isNull);
    });
  });

  group('how far', () {
    test('a nearby place is a number of minutes\' walk, never zero', () {
      final near = essentialGroups(pois, here).first.nearest;
      expect(near.walk, inInclusiveRange(1, 3));
      expect(near.distanceText, '${near.walk} min walk');
      final here2 = essentialGroups([_poi('x', 'RESTROOM', 'Right here', 54.6700, -1.6800)], here).first.nearest;
      expect(here2.walk, 1);
    });

    test('a place more than 2.5 km off is given as a distance instead', () {
      final far = essentialGroups([_poi('x', 'RESTROOM', 'Elsewhere', 54.7000, -1.6800)], here).first.nearest; // about 3.3 km
      expect(far.walk, isNull);
      expect(far.distanceText, matches(RegExp(r'^\d\.\d km away$')));
    });
  });

  group('how a kind reads', () {
    test('known kinds have their name, and an unknown one is tidied', () {
      expect(facilityLabel('RESTROOM'), 'Toilets');
      expect(facilityLabel('BABY_CHANGING'), 'Baby changing');
      expect(facilityLabel('WATER_POINT'), 'Water point');
      expect(facilityEmoji('FIRST_AID'), '➕');
      expect(facilityEmoji('WATER_POINT'), '📍');
    });
  });

  testWidgets('the Park essentials screen shows the quick tiles, each kind of place, and a way to turn location on', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    final bundle = jsonDecode(File('test/fixtures/bundle.json').readAsStringSync()) as Map<String, dynamic>;
    bundle['date'] = ukTodayStr();
    final dir = Directory.systemTemp.createTempSync('kynren_essentials_test');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/kynren_bundle_${ukTodayStr()}.json').writeAsStringSync(jsonEncode(bundle));
    PathProviderPlatform.instance = _FakePathProvider(dir.path);
    SharedPreferences.setMockInitialValues({});

    tester.view.physicalSize = const Size(780, 3200);
    tester.view.devicePixelRatio = 2;
    await tester.runAsync(() async {
      await tester.pumpWidget(const KynrenApp());
      await Future<void>.delayed(const Duration(seconds: 2));
    });
    await _settle(tester, 40);

    router.go('/essentials');
    await _settle(tester, 20);
    expect(find.text('Toilets, first aid, parking and more'), findsOneWidget);
    expect(find.text('Turn on location'), findsOneWidget, reason: 'no position in a test: it offers to find one');
    expect(find.text('Toilets'), findsWidgets);
    expect(find.text('First aid'), findsWidgets);
    expect(find.text('Baby changing'), findsWidgets);
    expect(find.text('Parking · 2'), findsOneWidget);
    expect(find.text('Picnic areas · 2'), findsOneWidget);
    expect(find.text('Information'), findsOneWidget);
    expect(find.text('Entrances'), findsOneWidget);
    expect(find.text('Restroom'), findsOneWidget);
    expect(find.text('The Kynren Shop'), findsNothing, reason: 'shops have their own screen');
    expect(find.text('See map'), findsNWidgets(3), reason: 'without a position the tiles send you to the map');

    // a place opens its own page
    await tester.tap(find.text('Restroom'));
    await _settle(tester, 20);
    expect(find.text('Restroom'), findsWidgets);
    expect(find.text('Toilets'), findsWidgets);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
