import 'eat_logic.dart';
import 'models.dart';
import 'shuttle_logic.dart';

/// The shuttle that leaves soonest, across every route and stop.
class SoonestShuttle {
  final String route, stop, time;
  final int minutes;
  const SoonestShuttle(this.route, this.stop, this.time, this.minutes);
}

/// The soonest departure still to come today from any stop, from the timetables the API returns (`/shuttles`: routes with
/// stops, each with a list of "HH:mm" times). Null when nothing is left today, so Home says nothing rather than "tomorrow".
SoonestShuttle? soonestShuttle(List<dynamic> routes, DateTime now) {
  SoonestShuttle? best;
  for (final r in routes) {
    if (r is! Map) continue;
    for (final s in (r['stops'] as List?) ?? const []) {
      if (s is! Map) continue;
      final times = ((s['times'] as List?) ?? const []).map((e) => '$e').toList();
      final next = nextDeparture(times, now);
      if (next == null || next.tomorrow) continue;
      if (best == null || next.minutes < best.minutes) {
        best = SoonestShuttle('${r['name'] ?? 'Shuttle'}', '${s['name'] ?? ''}', next.time, next.minutes);
      }
    }
  }
  return best;
}

/// How many places have hours we can read and are open at [nowMin] (minutes after midnight, park time). Places whose
/// hours cannot be read are not counted: we only claim "open" where we know it.
int openNowCount(Iterable<Restaurant> restaurants, Iterable<Shop> shops, int nowMin) {
  var n = 0;
  for (final r in restaurants) {
    if (parseHours(r.openingHours)?.isOpenAt(nowMin) ?? false) n++;
  }
  for (final s in shops) {
    if (parseHours(s.openingHours)?.isOpenAt(nowMin) ?? false) n++;
  }
  return n;
}
