import '../screens/map/map_logic.dart' show walkMins;
import 'location.dart';
import 'models.dart';

/// The kinds of place that are not an attraction, a shop or a restaurant: what a guest looks for when they need something.
/// Listed in the order they are shown; any other type the park adds follows these.
const essentialTypes = ['RESTROOM', 'BABY_CHANGING', 'FIRST_AID', 'INFO', 'HELP', 'ENTRANCE', 'PARKING', 'PICNIC', 'ACCESSIBILITY'];

/// The types that have their own screens, so they are not essentials.
const _ownScreens = {'ATTRACTION', 'SHOP', 'RESTAURANT'};

/// The three a guest is most likely to need in a hurry, shown first with how far away the nearest is.
const urgentTypes = ['RESTROOM', 'FIRST_AID', 'BABY_CHANGING'];

const _label = {
  'RESTROOM': 'Toilets', 'BABY_CHANGING': 'Baby changing', 'FIRST_AID': 'First aid', 'INFO': 'Information', 'HELP': 'Help points',
  'ENTRANCE': 'Entrances', 'PARKING': 'Parking', 'PICNIC': 'Picnic areas', 'ACCESSIBILITY': 'Accessibility', 'SHOP': 'Shop',
};
const _emoji = {
  'RESTROOM': '🚻', 'FIRST_AID': '➕', 'SHOP': '🛍️', 'PARKING': '🅿️', 'ACCESSIBILITY': '♿',
  'BABY_CHANGING': '🍼', 'PICNIC': '🧺', 'ENTRANCE': '🚪', 'INFO': 'ℹ️', 'HELP': '❓',
};

/// A type as a guest reads it: "Toilets", or a tidied version of a type the app does not know ("WATER_POINT" → "Water point").
String facilityLabel(String type) {
  final known = _label[type];
  if (known != null) return known;
  final words = type.replaceAll('_', ' ').trim().toLowerCase();
  return words.isEmpty ? type : '${words[0].toUpperCase()}${words.substring(1)}';
}

String facilityEmoji(String type) => _emoji[type] ?? '📍';

/// A place a guest might need, with how far it is from them when they are in the park.
class Spot {
  final Poi poi;

  /// Metres in a straight line; null when the guest's position is unknown.
  final double? meters;
  const Spot(this.poi, this.meters);

  /// Minutes to walk, when they are within 2.5 km (allowing for paths that are not straight).
  int? get walk => meters == null || meters! > 2500 ? null : walkMins(meters! * 1.25);

  /// "3 min walk", "1.4 km away", or nothing when the position is unknown.
  String? get distanceText => distanceLabel(meters);
}

/// How far [meters] is, as a guest reads it: minutes' walk within 2.5 km, else a distance. Null when it is not known.
String? distanceLabel(double? meters) {
  final m = meters;
  if (m == null) return null;
  if (m <= 2500) return '${walkMins(m * 1.25)} min walk';
  return '${(m / 1000).toStringAsFixed(1)} km away';
}

/// A kind of place and the spots of it, nearest first when the guest's position is known.
class SpotGroup {
  final String type;
  final List<Spot> spots;
  const SpotGroup(this.type, this.spots);
  String get label => facilityLabel(type);
  Spot get nearest => spots.first;
}

/// The park's essentials grouped by kind: the known kinds in their usual order, then any other. Each group is nearest first
/// when [from] is known and in the park's own order otherwise. Places at the map's origin (never placed) are left out.
List<SpotGroup> essentialGroups(Iterable<Poi> pois, Geo? from) {
  final byType = <String, List<Spot>>{};
  for (final p in pois) {
    if (_ownScreens.contains(p.type) || (p.lat == 0 && p.lng == 0)) continue;
    byType.putIfAbsent(p.type, () => []).add(Spot(p, from == null ? null : distMeters(from, Geo(p.lat, p.lng))));
  }
  for (final spots in byType.values) {
    if (from != null) spots.sort((a, b) => a.meters!.compareTo(b.meters!));
  }
  final known = [for (final t in essentialTypes) if (byType.containsKey(t)) t];
  final other = byType.keys.where((t) => !essentialTypes.contains(t)).toList()..sort();
  return [for (final t in [...known, ...other]) SpotGroup(t, byType[t]!)];
}
