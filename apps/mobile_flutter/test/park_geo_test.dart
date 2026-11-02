import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/location.dart';
import 'package:storiedlands/core/park_geo.dart';

// Fitted by the shared package (packages/shared/src/geo-calibration.ts) from four landmarks, so this proves the app reads
// and applies the numbers the admin saves the way the admin worked them out.
const _fitted = {
  'v': 1,
  'points': [],
  'origin': {'lat': 54.671605, 'lng': -1.67922},
  'm': [489.2166043005603, -223.52789040889914, -132.63355282842025, -121.85463498547553, -424.4654425203664, 268.30611115279],
  'metresAcross': 504,
  'metresDown': 480,
};

// where the shared package puts these spots on the ground
const _spots = [
  (u: 0.5, v: 0.5, lat: 54.67156108894879, lng: -1.679216725226837),
  (u: 0.25, v: 0.6, lat: 54.671452685786996, lng: -1.6814639235791364),
  (u: 0.9, v: 0.9, lat: 54.669584175333796, lng: -1.6775657702443718),
];

void main() {
  tearDown(() => parkGeo = null);

  group('reading the calibration', () {
    test('reads what the API sends', () {
      final g = ParkGeo.fromJson(_fitted);
      expect(g, isNotNull);
      expect(g!.metresAcross, closeTo(504, 1));
      expect(g.metresDown, closeTo(480, 1));
    });

    test('puts a spot on the picture where the shared package puts it, and back again', () {
      final g = ParkGeo.fromJson(_fitted)!;
      for (final s in _spots) {
        final ground = g.groundOf(s.u, s.v);
        expect(ground.lat, closeTo(s.lat, 1e-9));
        expect(ground.lng, closeTo(s.lng, 1e-9));
        final back = g.pictureOf(Geo(s.lat, s.lng));
        expect(back.dx, closeTo(s.u, 1e-6));
        expect(back.dy, closeTo(s.v, 1e-6));
      }
    });

    test('anything missing, malformed or impossible reads as no calibration', () {
      expect(ParkGeo.fromJson(null), isNull);
      expect(ParkGeo.fromJson('x'), isNull);
      expect(ParkGeo.fromJson({..._fitted, 'v': 2}), isNull);
      expect(ParkGeo.fromJson({..._fitted, 'm': [1, 2, 3]}), isNull);
      expect(ParkGeo.fromJson({..._fitted, 'm': [1, 2, 3, 4, 5, double.nan]}), isNull);
      expect(ParkGeo.fromJson({..._fitted, 'origin': null}), isNull);
      expect(ParkGeo.fromJson({..._fitted, 'm': [1, 0, 0, 0, 1, 0]}), isNull, reason: 'a picture one metre wide is not a park');
      expect(ParkGeo.fromJson({..._fitted, 'm': [500, 250, 0, 250, 125, 0]}), isNull, reason: 'a picture squashed flat has no inverse');
    });
  });

  group('between a real position and the frame the places are stored in', () {
    test('with no calibration the two are the same, so nothing changes until staff set one', () {
      const g = Geo(54.6712, -1.6779);
      expect(mapFrameOf(g).lat, g.lat);
      expect(mapFrameOf(g).lng, g.lng);
      expect(groundOfMapFrame(g).lat, g.lat);
      expect(pictureMetresAcross, parkMetresAcross);
      expect(pictureMetresDown, parkMetresDown);
    });

    test('with one, a guest standing at the middle of the picture is at the middle of the box the places live in', () {
      parkGeo = ParkGeo.fromJson(_fitted);
      final middle = parkGeo!.groundOf(0.5, 0.5);
      final inFrame = mapFrameOf(middle);
      final u = (inFrame.lng - parkBounds.minLng) / (parkBounds.maxLng - parkBounds.minLng);
      final v = (parkBounds.maxLat - inFrame.lat) / (parkBounds.maxLat - parkBounds.minLat);
      expect(u, closeTo(0.5, 1e-6));
      expect(v, closeTo(0.5, 1e-6));
    });

    test('a place and the guest standing on it are no distance apart, however the picture is turned', () {
      parkGeo = ParkGeo.fromJson(_fitted);
      // a place a quarter of the way across and 60% down the picture, stored the way the admin stores it
      const u = 0.25, v = 0.6;
      final lat = parkBounds.maxLat - v * (parkBounds.maxLat - parkBounds.minLat);
      final lng = parkBounds.minLng + u * (parkBounds.maxLng - parkBounds.minLng);
      final guest = parkGeo!.groundOf(u, v);
      expect(metresToPlace(guest, lat, lng), lessThan(0.5));
      // 100 m east of it is 100 m away, where the assumed box would have said something else
      final east = Geo(guest.lat, guest.lng + 100 / (111320 * 0.5787));
      expect(metresToPlace(east, lat, lng), closeTo(100, 3));
    });

    test('the ground the picture covers comes from the calibration', () {
      parkGeo = ParkGeo.fromJson(_fitted);
      expect(pictureMetresAcross, closeTo(504, 1));
      expect(pictureMetresDown, closeTo(480, 1));
    });

    test('a guest off the picture is outside the box, so no beacon is shown for them', () {
      parkGeo = ParkGeo.fromJson(_fitted);
      final far = mapFrameOf(const Geo(54.70, -1.60));
      final inside = far.lat >= parkBounds.minLat && far.lat <= parkBounds.maxLat && far.lng >= parkBounds.minLng && far.lng <= parkBounds.maxLng;
      expect(inside, isFalse);
    });
  });
}
