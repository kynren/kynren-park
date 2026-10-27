import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui';
import 'package:flutter/widgets.dart' show Matrix4;
import '../../core/location.dart';
import '../../core/models.dart' show Poi;

/// Fixed geographic bounds of the park: the SAME box the admin map editor uses to place hotspots, so a pin
/// placed in admin lands on the exact same map spot here (both map these bounds onto the base-map image rectangle).
const parkBounds = (minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674);

/// How long the map picture is on the ground, across and down, for turning positions on it into walking distances.
final parkMetresAcross = (parkBounds.maxLng - parkBounds.minLng) * 111320 * math.cos((parkBounds.minLat + parkBounds.maxLat) / 2 * math.pi / 180);
final parkMetresDown = (parkBounds.maxLat - parkBounds.minLat) * 110540;

const areaOpenPx = 90.0; // an area stays grouped until its pins span more than this on screen
const halfMileM = 804.672; // only show the location beacon within this distance of the park
const minScale = 1.0;
const maxScaleCeiling = 12.0; // absolute ceiling; the effective max comes from the admin map config
const calloutH = 104.0;
const calloutW = 292.0;

/// The colour round the edge of a picture, when the edge is one flat colour (a logo on a plain background): then the slot
/// beside the picture can be filled with that colour and the whole picture sits on it, seamlessly. Null when the edge is
/// busy (a photo) or see-through. [rgba] is the picture's pixels, four bytes each, row by row.
Color? uniformEdgeColour(Uint8List rgba, int w, int h, {int tolerance = 28}) {
  if (w < 2 || h < 2 || rgba.length < w * h * 4) return null;
  final samples = <int>[]; // pixel indexes along the border, about 24 along each side
  void side(int count, int Function(int) at) {
    final step = math.max(1, count ~/ 24);
    for (var i = 0; i < count; i += step) {
      samples.add(at(i));
    }
  }

  side(w, (x) => x); // top
  side(w, (x) => (h - 1) * w + x); // bottom
  side(h, (y) => y * w); // left
  side(h, (y) => y * w + w - 1); // right
  var r = 0, g = 0, b = 0, a = 0;
  for (final p in samples) {
    r += rgba[p * 4];
    g += rgba[p * 4 + 1];
    b += rgba[p * 4 + 2];
    a += rgba[p * 4 + 3];
  }
  final n = samples.length;
  if (a / n < 235) return null; // see-through: the card shows through, so there is no colour to match
  final mr = r ~/ n, mg = g ~/ n, mb = b ~/ n;
  for (final p in samples) {
    if ((rgba[p * 4] - mr).abs() > tolerance || (rgba[p * 4 + 1] - mg).abs() > tolerance || (rgba[p * 4 + 2] - mb).abs() > tolerance) return null;
  }
  return Color.fromARGB(255, mr, mg, mb);
}

/// How far to slide the place card sideways, in screen pixels, so that it stays inside the screen when its marker is near
/// an edge: the card is centred on the marker, then held [margin] pixels in from each side.
double calloutShift(double markerX, double viewportW, {double margin = 12}) {
  final want = markerX - calloutW / 2;
  final left = want.clamp(margin, math.max(margin, viewportW - margin - calloutW)).toDouble();
  return left - want;
}

/// The picture slot on the left of the place card. It never grows: the text beside it keeps its room.
const calloutSlotW = 96.0;
const _slotInset = 8.0;

/// The picture's box inside the slot, for a picture of this shape (width over height; null while it is not known yet).
/// A picture close to the slot's own shape fills the slot edge to edge. Any other shape (a wide logo, a tall banner) gets
/// a box of its own shape, centred in the slot with a margin, so the whole picture shows and nothing needs filling round it.
({double w, double h, bool bleed}) calloutPictureBox(double? aspect) {
  const slot = calloutSlotW / calloutH;
  if (aspect == null || !aspect.isFinite || aspect <= 0 || (aspect >= slot * 0.85 && aspect <= slot * 1.25)) {
    return (w: calloutSlotW, h: calloutH, bleed: true);
  }
  const availW = calloutSlotW - _slotInset * 2, availH = calloutH - _slotInset * 2;
  final wide = aspect >= availW / availH;
  final w = wide ? availW : availH * aspect, h = wide ? availW / aspect : availH;
  return (w: w.clamp(40.0, availW).toDouble(), h: h.clamp(28.0, availH).toDouble(), bleed: false);
}

enum Cat { favorites, soon, shows, restaurants, facilities }

const pills = [
  (key: Cat.favorites, label: 'Favourites', emoji: '♡'),
  (key: Cat.soon, label: 'Soon', emoji: '⏱'),
  (key: Cat.shows, label: 'Shows', emoji: '🎭'),
  (key: Cat.restaurants, label: 'Restaurants', emoji: '🍴'),
  (key: Cat.facilities, label: 'Facilities', emoji: '🚻'),
];

/// Facility POI types shown under the "Facilities" filter, with default markers.
const facilityTypes = {
  'RESTROOM': (emoji: '🚻', color: 0xFF3A86C8),
  'FIRST_AID': (emoji: '⛑️', color: 0xFFE5544B),
  'SHOP': (emoji: '🛍️', color: 0xFF8B6FF0),
  'PARKING': (emoji: '🅿️', color: 0xFF6B6460),
  'ACCESSIBILITY': (emoji: '♿', color: 0xFF3A86C8),
  'BABY_CHANGING': (emoji: '🍼', color: 0xFFE2A53B),
  'PICNIC': (emoji: '🧺', color: 0xFF2E8B57),
  'ENTRANCE': (emoji: '🚪', color: 0xFF22B365),
  'INFO': (emoji: 'ℹ️', color: 0xFF6D5DF6),
};

/// Short names for the facility chips shown while the Facilities layer is on.
const facilityLabels = {
  'RESTROOM': 'Toilets',
  'FIRST_AID': 'First aid',
  'SHOP': 'Shops',
  'PARKING': 'Parking',
  'ACCESSIBILITY': 'Accessible',
  'BABY_CHANGING': 'Baby changing',
  'PICNIC': 'Picnic',
  'ENTRANCE': 'Entrance',
  'INFO': 'Info',
};

/// The marker for the car the guest saved. Its id is reserved; it is never a park place.
const parkedCarId = 'parked-car';

enum PinKind { show, evening, restaurant, facility }

class Pin {
  final String id;
  final String? attractionId, slug, image, emoji, subtitle, nextTime, zone;

  /// The callout's link text, when it should not be the usual "More information".
  final String? hint;
  final double x, y;
  final double? lat, lng;
  final Color? color;
  final PinKind kind;
  final int? number;
  final String title;
  const Pin({
    required this.id,
    this.attractionId,
    required this.x,
    required this.y,
    this.lat,
    this.lng,
    this.slug,
    this.color,
    this.image,
    required this.kind,
    this.number,
    this.emoji,
    required this.title,
    this.subtitle,
    this.nextTime,
    this.zone,
    this.hint,
  });
}

/// A rendered map marker: one or many loose pins (a count bubble) or a whole area grouped by its mapZone.
class Cluster {
  double x, y;
  final List<Pin> pins;
  final String? zone;
  final double? r;
  Cluster(this.x, this.y, this.pins, {this.zone, this.r});
}

String fmtDist(double m) => m < 1000 ? '${(m / 10).round() * 10} m' : '${(m / 1000).toStringAsFixed(1)} km';
int walkMins(double m) => math.max(1, (m / 80).round()); // ~80 m/min stroll

/// Minutes to walk from [from] to the park spot [poiId], when the guest is in the park (within 2.5 km, with a little extra
/// for paths that are not a straight line). Null when their position or the spot is unknown.
int? walkMinsToPoi(Geo? from, String? poiId, List<Poi> pois) {
  if (from == null || poiId == null) return null;
  final poi = pois.where((p) => p.id == poiId).firstOrNull;
  if (poi == null) return null;
  final m = distMeters(from, Geo(poi.lat, poi.lng));
  return m > 2500 ? null : walkMins(m * 1.25);
}

/// A k-nearest-neighbour graph over the POIs, so a route hops between real park spots (following the walkable
/// network) rather than cutting a straight line.
List<List<int>> buildPoiGraph(List<Geo> nodes, {int k = 3}) {
  final adj = List.generate(nodes.length, (_) => <int>[]);
  for (var i = 0; i < nodes.length; i++) {
    final near = [for (var j = 0; j < nodes.length; j++) if (j != i) j]..sort((a, b) => distMeters(nodes[i], nodes[a]).compareTo(distMeters(nodes[i], nodes[b])));
    for (final j in near.take(k)) {
      if (!adj[i].contains(j)) adj[i].add(j);
      if (!adj[j].contains(i)) adj[j].add(i); // keep it walkable both ways
    }
  }
  return adj;
}

int nearestNode(List<Geo> nodes, Geo p) {
  var best = -1;
  var bd = double.infinity;
  for (var i = 0; i < nodes.length; i++) {
    final d = distMeters(nodes[i], p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

List<int>? dijkstra(List<List<int>> adj, List<Geo> nodes, int start, int goal) {
  final n = nodes.length;
  final dist = List.filled(n, double.infinity), prev = List.filled(n, -1), seen = List.filled(n, false);
  dist[start] = 0;
  for (var it = 0; it < n; it++) {
    var u = -1;
    var ud = double.infinity;
    for (var i = 0; i < n; i++) {
      if (!seen[i] && dist[i] < ud) {
        ud = dist[i];
        u = i;
      }
    }
    if (u == -1 || u == goal) break;
    seen[u] = true;
    for (final v in adj[u]) {
      final w = distMeters(nodes[u], nodes[v]);
      if (dist[u] + w < dist[v]) {
        dist[v] = dist[u] + w;
        prev[v] = u;
      }
    }
  }
  if (dist[goal] == double.infinity) return null;
  final path = <int>[];
  for (var c = goal; c != -1; c = prev[c]) {
    path.insert(0, c);
  }
  return path.first == start ? path : null;
}

/// Clamp one axis of the pan so the map never leaves the viewport: when the map is larger than the viewport on
/// this axis you can pan to its edges; when it is smaller it stays centred. [t] is the screen position of the
/// content's start edge, with screen = content * s + t.
double clampAxis(double t, double s, double contentLen, double vp) {
  final len = contentLen * s;
  if (len >= vp) return t.clamp(vp - len, 0.0);
  return (vp - len) / 2;
}

// ------------------------------------------------------------------ rotatable view
// The map's view is one 2D transform: screen = T(t) * R(angle) * S(scale) * content. These helpers read and build it.

double viewAngle(Matrix4 m) => math.atan2(m.storage[1], m.storage[0]);

/// The view that puts [content] at [screen] with the given scale and rotation.
Matrix4 composeView({required double scale, required double angle, required Offset content, required Offset screen}) {
  final c = math.cos(angle) * scale, s = math.sin(angle) * scale;
  final tx = screen.dx - (c * content.dx - s * content.dy);
  final ty = screen.dy - (s * content.dx + c * content.dy);
  return Matrix4.identity()
    ..translateByDouble(tx, ty, 0, 1)
    ..rotateZ(angle)
    ..scaleByDouble(scale, scale, 1, 1);
}

Offset viewToScreen(Matrix4 m, Offset content) {
  final k = m.storage;
  return Offset(k[0] * content.dx + k[4] * content.dy + k[12], k[1] * content.dx + k[5] * content.dy + k[13]);
}

Offset viewToContent(Matrix4 m, Offset screen) {
  final k = m.storage;
  final det = k[0] * k[5] - k[4] * k[1];
  if (det.abs() < 1e-12) return Offset.zero;
  final x = screen.dx - k[12], y = screen.dy - k[13];
  return Offset((k[5] * x - k[4] * y) / det, (k[0] * y - k[1] * x) / det);
}

/// Keep the map in view. Unrotated, the picture's edges stop at the screen's edges (see [clampAxis]); once rotated
/// a rectangle no longer lines up with the screen, so the point at the middle of the screen is kept on the picture.
Matrix4 clampView(Matrix4 m, Size canvas, Size vp) {
  final s = m.getMaxScaleOnAxis(), a = viewAngle(m);
  if (a.abs() < 1e-3) {
    return Matrix4.identity()
      ..translateByDouble(clampAxis(m.storage[12], s, canvas.width, vp.width), clampAxis(m.storage[13], s, canvas.height, vp.height), 0, 1)
      ..scaleByDouble(s, s, 1, 1);
  }
  final mid = Offset(vp.width / 2, vp.height / 2);
  final p = viewToContent(m, mid);
  final q = Offset(p.dx.clamp(0.0, canvas.width), p.dy.clamp(0.0, canvas.height));
  if (q == p) return m;
  return composeView(scale: s, angle: a, content: q, screen: mid);
}

/// The shortest signed turn from [from] to [to], in radians.
double angleDelta(double from, double to) => (to - from + math.pi) % (2 * math.pi) - math.pi;
