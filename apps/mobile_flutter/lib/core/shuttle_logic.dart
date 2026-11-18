/// What a guest wants from a shuttle timetable: when the next bus leaves a stop, and how long that is from now.
class NextDeparture {
  final String time;
  final int minutes;
  final bool tomorrow;
  const NextDeparture(this.time, this.minutes, {this.tomorrow = false});
}

/// Minutes after midnight for "HH:mm" (also "H:mm", "H.mm" and "7pm"-style are not guessed at): null when unreadable.
int? minutesOfDay(String t) {
  final m = RegExp(r'^\s*(\d{1,2})[:.](\d{2})\s*$').firstMatch(t);
  if (m == null) return null;
  final h = int.parse(m.group(1)!), min = int.parse(m.group(2)!);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/// The soonest departure at or after [now]; when today's last one has gone, the first one tomorrow. Null with no readable times.
NextDeparture? nextDeparture(List<String> times, DateTime now) {
  final read = <(String, int)>[
    for (final t in times)
      if (minutesOfDay(t) case final m?) (t.trim(), m),
  ]..sort((a, b) => a.$2.compareTo(b.$2));
  if (read.isEmpty) return null;
  final nowMin = now.hour * 60 + now.minute;
  for (final r in read) {
    if (r.$2 >= nowMin) return NextDeparture(r.$1, r.$2 - nowMin);
  }
  return NextDeparture(read.first.$1, 24 * 60 - nowMin + read.first.$2, tomorrow: true);
}

/// "in 12 min", "in 1 h 5 min", "now".
String untilText(int minutes) {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return 'in $minutes min';
  final h = minutes ~/ 60, m = minutes % 60;
  return m == 0 ? 'in $h h' : 'in $h h $m min';
}
