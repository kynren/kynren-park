import 'dart:math' as math;
import 'dart:ui';
import '../../core/location.dart';

/// Fixed geographic bounds of the park: the SAME box the admin map editor uses to place hotspots, so a pin
/// placed in admin lands on the exact same map spot here (both map these bounds onto the base-map image rectangle).
const parkBounds = (minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674);

const areaOpenPx = 90.0; // an area stays grouped until its pins span more than this on screen
const halfMileM = 804.672; // only show the location beacon within this distance of the park
const minScale = 1.0;
const maxScaleCeiling = 12.0; // absolute ceiling; the effective max comes from the admin map config
const calloutH = 104.0;
const calloutW = 292.0;

enum Cat { favorites, shows, restaurants, facilities }

const pills = [
  (key: Cat.favorites, label: 'Favourites', emoji: '♡'),
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

enum PinKind { show, evening, restaurant, facility }

class Pin {
  final String id;
  final String? attractionId, slug, image, emoji, subtitle, nextTime, zone;
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
