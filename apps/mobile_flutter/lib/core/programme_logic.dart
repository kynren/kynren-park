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

/// How much time a guest has between two shows they picked, which may be less than none.
class DayNote {
  final Session first, second;

  /// Minutes between the end of [first] and the start of [second]: below zero when they overlap.
  final int gapMins;
  const DayNote(this.first, this.second, this.gapMins);
  bool get clash => gapMins < 0;
}

/// A gap shorter than this between two picked shows is flagged as tight.
const tightMins = 10;

int sessionStartMs(Session s) => _startMs(s);

/// The picks in the order they start, and a note for each pair of neighbours that overlap or leave under [tightMins] to
/// get from one to the next. Cancelled sessions are left out: nobody can go to them.
({List<Session> ordered, List<DayNote> notes}) planMyDay(Iterable<Session> picks) {
  final ordered = picks.where((s) => s.status != 'CANCELLED').toList()..sort((a, b) => _startMs(a).compareTo(_startMs(b)));
  final notes = <DayNote>[];
  for (var i = 0; i + 1 < ordered.length; i++) {
    final gap = ((_startMs(ordered[i + 1]) - _ms(ordered[i].endTime)) / 60000).round();
    if (gap < tightMins) notes.add(DayNote(ordered[i], ordered[i + 1], gap));
  }
  return (ordered: ordered, notes: notes);
}

/// "Overlaps" or "only 5 min to get there" for a note, about the second show.
String dayNoteText(DayNote n) => n.clash
    ? 'Overlaps ${n.first.attractionName}'
    : n.gapMins == 0
        ? 'Starts as ${n.first.attractionName} ends'
        : 'Only ${n.gapMins} min after ${n.first.attractionName}';

/// A show's time as the guest should read it: the revised start if it moved.
String sessionTimeText(Session s) => _hhmm(s.revisedStart ?? s.startTime);

/// Minutes a show runs for, from its own times.
int sessionMins(Session s) => ((_ms(s.endTime) - _startMs(s)) / 60000).round();

/// The programme as plain text for sharing: one line per show, with a continuous attraction (many times) as a range.
String programmeText(String heading, List<({String name, List<Session> sessions})> shows) {
  final lines = <String>[heading];
  for (final show in shows) {
    final open = show.sessions.where((s) => s.status != 'CANCELLED').toList()..sort((a, b) => _startMs(a).compareTo(_startMs(b)));
    if (open.isEmpty) continue;
    if (open.length > 4) {
      lines.add('${_hhmm(open.first.revisedStart ?? open.first.startTime)}–${_hhmm(open.last.endTime)}  ${show.name} (all day)');
    } else {
      lines.add('${open.map(sessionTimeText).join(', ')}  ${show.name}');
    }
  }
  return lines.join('\n');
}

/// A guest's own plan as plain text for sharing, in the order it happens.
String myDayText(String heading, List<Session> ordered) =>
    [heading, for (final s in ordered) '${sessionTimeText(s)}–${_hhmm(s.endTime)}  ${s.attractionName}'].join('\n');
