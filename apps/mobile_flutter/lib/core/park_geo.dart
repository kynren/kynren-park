import 'dart:math' as math;
import 'dart:ui' show Offset;
import 'location.dart';

/// The box of ground the map picture is assumed to cover when staff have not tied it to real coordinates. Places on the
/// map are stored as a latitude and longitude over this box (the admin map editor uses the SAME box), so a place placed
/// there lands on the same spot of the picture here.
const parkBounds = (minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674);

/// How long that box is on the ground, across and down, for turning positions on the picture into walking distances.
final parkMetresAcross = (parkBounds.maxLng - parkBounds.minLng) * 111320 * math.cos((parkBounds.minLat + parkBounds.maxLat) / 2 * math.pi / 180);
final parkMetresDown = (parkBounds.maxLat - parkBounds.minLat) * 110540;

const _metresPerDegLat = 110540.0;
const _metresPerDegLng = 111320.0;

/// Where the map picture really is on the ground, as the admin's map editor worked it out from landmarks (see
/// shared/src/geo-calibration.ts): a position on the picture (u across, v down, each 0 to 1) is a spot [m] metres east
/// and north of [origin].
class ParkGeo {
  final Geo origin;

  /// x = m[0]*u + m[1]*v + m[2];  y = m[3]*u + m[4]*v + m[5]  (metres east and north of [origin]).
  final List<double> m;
  final double metresAcross, metresDown;
  final double _det;
  final double _cosLat;

  ParkGeo._(this.origin, this.m, this.metresAcross, this.metresDown)
      : _det = m[0] * m[4] - m[1] * m[3],
        _cosLat = math.cos(origin.lat * math.pi / 180);

  /// Reads the calibration the API sends, or null when it is missing or does not make sense (the map then falls back to
  /// the assumed box rather than putting guests in the wrong place).
  static ParkGeo? fromJson(Object? raw) {
    if (raw is! Map || raw['v'] != 1) return null;
    final o = raw['origin'], m = raw['m'];
    if (o is! Map || m is! List || m.length != 6) return null;
    final lat = o['lat'], lng = o['lng'];
    if (lat is! num || lng is! num || m.any((n) => n is! num || !n.isFinite)) return null;
    final coef = [for (final n in m) (n as num).toDouble()];
    final across = math.sqrt(coef[0] * coef[0] + coef[3] * coef[3]), down = math.sqrt(coef[1] * coef[1] + coef[4] * coef[4]);
    if (across < 50 || across > 10000 || down < 50 || down > 10000) return null;
    if ((coef[0] * coef[4] - coef[1] * coef[3]).abs() < 1) return null;
    return ParkGeo._(Geo(lat.toDouble(), lng.toDouble()), coef, across, down);
  }

  /// The spot on the picture for a real position: outside 0 to 1 when it is off the picture.
  Offset pictureOf(Geo g) {
    final x = (g.lng - origin.lng) * _metresPerDegLng * _cosLat - m[2];
    final y = (g.lat - origin.lat) * _metresPerDegLat - m[5];
    return Offset((m[4] * x - m[1] * y) / _det, (m[0] * y - m[3] * x) / _det);
  }

  /// The real position of a spot on the picture.
  Geo groundOf(double u, double v) {
    final x = m[0] * u + m[1] * v + m[2], y = m[3] * u + m[4] * v + m[5];
    return Geo(origin.lat + y / _metresPerDegLat, origin.lng + x / (_metresPerDegLng * _cosLat));
  }
}

/// The calibration for the map the app is showing, set whenever a bundle arrives; null until staff have set one.
ParkGeo? parkGeo;

/// A guest's real position as a latitude and longitude in the frame places on the map are stored in, so it can be put on
/// the picture and compared with them. Without a calibration the two frames are the same.
Geo mapFrameOf(Geo ground) {
  final geo = parkGeo;
  if (geo == null) return ground;
  final p = geo.pictureOf(ground);
  return Geo(parkBounds.maxLat - p.dy * (parkBounds.maxLat - parkBounds.minLat), parkBounds.minLng + p.dx * (parkBounds.maxLng - parkBounds.minLng));
}

/// The real position of a place stored in the map's frame.
Geo groundOfMapFrame(Geo place) {
  final geo = parkGeo;
  if (geo == null) return place;
  final u = (place.lng - parkBounds.minLng) / (parkBounds.maxLng - parkBounds.minLng);
  final v = (parkBounds.maxLat - place.lat) / (parkBounds.maxLat - parkBounds.minLat);
  return geo.groundOf(u, v);
}

/// How far a guest, at [ground], is from a place stored in the map's frame at [lat], [lng], in real metres.
double metresToPlace(Geo ground, double lat, double lng) => distMeters(ground, groundOfMapFrame(Geo(lat, lng)));

/// The ground the picture covers, for turning distances across it into metres.
double get pictureMetresAcross => parkGeo?.metresAcross ?? parkMetresAcross;
double get pictureMetresDown => parkGeo?.metresDown ?? parkMetresDown;
