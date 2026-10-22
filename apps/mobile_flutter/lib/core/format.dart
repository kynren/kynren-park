import 'package:intl/intl.dart';

// Kynren is a single-park, UK-only app: the backend stores show times as the admin's UK
// wall-clock digits with a UTC label (an admin-entered "10:00" is stored as `10:00:00.000Z`,
// not real UTC). Everything here reads and compares them that way. A raw `DateTime.now()` is
// a true instant, an hour ahead of what those stored times mean during BST (the whole season),
// so [ukNow] rebuilds "now" the same way the stored times were built.

/// "10:30" for a stored show time: the UTC digits are the UK wall clock.
String fmtTime(String iso) => DateFormat('HH:mm').format(DateTime.parse(iso).toUtc());

/// "Now" expressed as UK wall-clock digits wearing a UTC label, comparable with stored times.
DateTime ukNow() {
  final london = _londonWallClock(DateTime.now().toUtc());
  return DateTime.utc(london.year, london.month, london.day, london.hour, london.minute, london.second);
}

String ukTodayStr() => DateFormat('yyyy-MM-dd').format(ukNow());

/// UK wall clock for a UTC instant: BST runs from the last Sunday of March 01:00 UTC to the
/// last Sunday of October 01:00 UTC.
DateTime _londonWallClock(DateTime utc) {
  DateTime lastSunday(int year, int month) {
    final last = DateTime.utc(year, month + 1, 0, 1);
    return last.subtract(Duration(days: last.weekday % 7));
  }

  final start = lastSunday(utc.year, 3);
  final end = lastSunday(utc.year, 10);
  final bst = !utc.isBefore(start) && utc.isBefore(end);
  return bst ? utc.add(const Duration(hours: 1)) : utc;
}

/// For a genuine instant (not a stored show time): the UK time of day.
String fmtTimeUK(DateTime date) => DateFormat('HH:mm').format(_londonWallClock(date.toUtc()));

String fmtRelative(DateTime? date) {
  if (date == null) return 'never';
  final secs = DateTime.now().difference(date).inSeconds;
  if (secs < 60) return 'just now';
  if (secs < 3600) return '${secs ~/ 60} min ago';
  return '${secs ~/ 3600} h ago';
}

String poundsFromCents(int cents) => cents == 0 ? 'Free' : '£${(cents / 100).toStringAsFixed(2)}';
