import 'models.dart';

/// How far ahead a show counts as "starting soon".
const soonMins = 60;

/// Where one attraction stands right now: playing, about to start, or just a time later today.
class RunLine {
  final Session session;
  final bool live, soon;
  final String text;
  const RunLine({required this.session, required this.live, required this.soon, required this.text});
}

int _ms(String iso) => DateTime.parse(iso).millisecondsSinceEpoch;
int _startMs(Session s) => _ms(s.revisedStart ?? s.startTime);
String _hhmm(String iso) {
  final d = DateTime.parse(iso).toUtc();
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

/// What an attraction is doing at [now] (UK wall-clock digits wearing a UTC label, as `ukNow()` gives), from its
/// sessions: the one playing, else the next one to start. Cancelled sessions never count. Null when nothing is left.
RunLine? runLine(List<Session> sessions, DateTime now) {
  final t = now.millisecondsSinceEpoch;
  final open = sessions.where((s) => s.status != 'CANCELLED').toList()..sort((a, b) => _startMs(a).compareTo(_startMs(b)));
  for (final s in open) {
    if (_startMs(s) <= t && _ms(s.endTime) > t) {
      return RunLine(session: s, live: true, soon: false, text: 'On now · until ${_hhmm(s.endTime)}');
    }
  }
  for (final s in open) {
    final start = _startMs(s);
    if (start <= t) continue;
    final mins = ((start - t) / 60000).ceil();
    if (mins <= soonMins) {
      return RunLine(session: s, live: false, soon: true, text: mins <= 1 ? 'Starts in a minute' : 'Starts in $mins min');
    }
    return RunLine(session: s, live: false, soon: false, text: 'Next at ${_hhmm(s.revisedStart ?? s.startTime)}');
  }
  return null;
}

/// The line to feature at the top of the programme: whatever is playing, otherwise the soonest to start.
({String attractionId, RunLine line})? nextUp(Map<String, RunLine?> lines) {
  String? bestId;
  RunLine? best;
  for (final e in lines.entries) {
    final l = e.value;
    if (l == null) continue;
    if (best == null || (l.live && !best.live) || (l.live == best.live && _startMs(l.session) < _startMs(best.session))) {
      bestId = e.key;
      best = l;
    }
  }
  return best == null ? null : (attractionId: bestId!, line: best);
}
