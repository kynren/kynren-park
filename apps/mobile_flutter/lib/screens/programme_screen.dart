import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../app/shell.dart' show navClearance;
import '../core/auth.dart';
import '../core/calendar.dart';
import '../core/favorites.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/my_day.dart';
import '../core/notifications.dart';
import '../core/programme_logic.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/cover.dart';
import '../ui/reveal.dart';
import '../ui/skeleton.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';
import 'map/map_logic.dart' show walkMinsToPoi;

// Screen edge, then the card's own padding: the ruler and every show's timeline sit inside identical
// cards, so their hours line up.
const _edge = 20.0;
const _cardPad = 14.0;
// Half the tick label's width: the leftmost/rightmost ticks are centred on the very edge of the
// scrollable ruler, so without this lead-in/trail-out room their labels would be clipped.
const _tickPad = 20.0;
const _rulerH = 46.0;

int _mins(String iso) {
  final d = DateTime.parse(iso).toUtc();
  return d.hour * 60 + d.minute;
}

String _fmtDate(String ymd) {
  final p = ymd.split('-').map(int.parse).toList();
  return '${p[2]}/${p[1]}/${p[0]}';
}

class ProgrammeScreen extends StatefulWidget {
  const ProgrammeScreen({super.key});
  @override
  State<ProgrammeScreen> createState() => _ProgrammeScreenState();
}

enum _Filter { all, soon, mine, favourites, day, evening }

const _filterLabels = {
  _Filter.all: 'All',
  _Filter.soon: 'On now & soon',
  _Filter.mine: 'My day',
  _Filter.favourites: 'Favourites',
  _Filter.day: 'Daytime',
  _Filter.evening: 'Evening',
};

class _ProgrammeScreenState extends State<ProgrammeScreen> {
  Timer? _tick;
  _Filter _filter = _Filter.all;
  Set<String> _mine = {}; // the show times this guest picked for today

  @override
  void initState() {
    super.initState();
    // The programme always reflects the current day; the date is not selectable.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sync = context.read<SyncState>();
      final today = ukTodayStr();
      if (sync.date != today) sync.setDate(today);
      context.read<UnreadNotifications>().refresh();
      loadMyDay(today).then((ids) {
        if (mounted && ids.isNotEmpty) setState(() => _mine = {..._mine, ...ids});
      });
    });
    // Re-check which sessions have finished once a minute so a show drops off on its own.
    _tick = Timer.periodic(const Duration(minutes: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _addToCalendar(Session s) async {
    try {
      await addSessionToCalendar(s);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Couldn’t open your calendar. Try again.')));
    }
  }

  void _toggleMine(Session s) {
    setState(() => _mine = _mine.contains(s.id) ? _mine.difference({s.id}) : {..._mine, s.id});
    saveMyDay(ukTodayStr(), _mine);
  }

  void _clearMine() {
    setState(() {
      _mine = {};
      if (_filter == _Filter.mine) _filter = _Filter.all;
    });
    saveMyDay(ukTodayStr(), _mine);
  }

  Future<void> _share(String text) async {
    try {
      await SharePlus.instance.share(ShareParams(text: text));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Couldn’t open sharing. Try again.')));
    }
  }

  Future<void> _addAllToCalendar(List<Session> sessions) async {
    try {
      await addSessionsToCalendar(sessions);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Couldn’t open your calendar. Try again.')));
    }
  }

  int? _walkTo(Attraction a, Geo? from, List<Poi> pois) => walkMinsToPoi(from, a.poiId, pois);

  void _openSession(Session s, Attraction a, {int? walk}) {
    final c = context.ui;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: c.card,
      isScrollControlled: true,
      builder: (sheet) => StatefulBuilder(
        builder: (sheet, setSheet) => _SessionSheet(
          session: s,
          attraction: a,
          walk: walk,
          picked: _mine.contains(s.id),
          onPick: () {
            _toggleMine(s);
            setSheet(() {});
          },
          onCalendar: () {
            Navigator.pop(sheet);
            _addToCalendar(s);
          },
          onMap: () {
            Navigator.pop(sheet);
            context.go('/map?focus=${a.id}');
          },
          onOpen: () {
            Navigator.pop(sheet);
            context.push('/attraction/${a.slug}');
          },
          onShare: () {
            Navigator.pop(sheet);
            _share('${a.name} · ${fmtTime(s.revisedStart ?? s.startTime)} today at Kynren – The Storied Lands');
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final gps = context.watch<LocationState>().gps;
    final user = context.watch<AuthState>().user;
    final unread = context.watch<UnreadNotifications>().count;
    final today = ukTodayStr();
    final trackW = MediaQuery.sizeOf(context).width - (_edge + _cardPad) * 2;

    final attractions = bundle?.attractions ?? <Attraction>[];
    // Once a session has ended for the day it comes off the timeline entirely.
    final nowMs = ukNow().millisecondsSinceEpoch;
    final sessions = (bundle?.sessions ?? <Session>[]).where((s) => DateTime.parse(s.endTime).millisecondsSinceEpoch > nowMs).toList();

    final byAttraction = <String, List<Session>>{};
    for (final s in sessions) {
      (byAttraction[s.attractionId] ??= []).add(s);
    }
    for (final arr in byAttraction.values) {
      arr.sort((a, b) => _mins(a.revisedStart ?? a.startTime).compareTo(_mins(b.revisedStart ?? b.startTime)));
    }

    // The daytime window drives the shared ruler; the late evening show would otherwise stretch the axis.
    ({int start, int end, List<int> hours})? ruler;
    final day = sessions.where((s) => s.attractionCategory != 'EVENING_SHOW').toList();
    final basis = day.isNotEmpty ? day : sessions;
    if (basis.isNotEmpty) {
      var lo = 1 << 30, hi = -1;
      for (final s in basis) {
        lo = math.min(lo, _mins(s.revisedStart ?? s.startTime));
        hi = math.max(hi, _mins(s.endTime));
      }
      final start = (lo ~/ 60) * 60;
      final end = math.max(start + 120, ((hi + 59) ~/ 60) * 60);
      ruler = (start: start, end: end, hours: [for (var h = start; h <= end; h += 60) h]);
    }

    // Spread the day across a wide, horizontally scrollable track so every show time is readable (min 2.4px/min).
    final contentW = (ruler != null ? math.max(trackW, ((ruler.end - ruler.start) * 2.4).roundToDouble()) : trackW) + _tickPad * 2;
    double pos(int min) => ruler == null ? 0 : _tickPad + ((min - ruler.start) / (ruler.end - ruler.start)) * (contentW - _tickPad * 2);

    // Order: day attractions by sortOrder (numbered like the map), then the evening show.
    final dayA = attractions.where((a) => a.category != 'EVENING_SHOW').toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
    final evening = attractions.where((a) => a.category == 'EVENING_SHOW');
    final allRows = [
      for (var i = 0; i < dayA.length; i++) (a: dayA[i], badge: '${i + 1}'),
      for (final a in evening) (a: a, badge: '🌙'),
    ].where((r) => (byAttraction[r.a.id]?.length ?? 0) > 0).toList();

    // Where each show stands right now, the featured "up next", and the filter the guest picked.
    final nowDt = ukNow();
    final nowMin = nowDt.hour * 60 + nowDt.minute;
    final favs = context.watch<FavoritesState>().ids;
    final lines = {for (final r in allRows) r.a.id: runLine(byAttraction[r.a.id] ?? const [], nowDt)};
    final upNext = nextUp(lines);
    final upAttraction = upNext == null ? null : allRows.where((r) => r.a.id == upNext.attractionId).firstOrNull?.a;
    final plan = planMyDay(sessions.where((x) => _mine.contains(x.id)));
    final mineIds = {for (final x in sessions.where((x) => _mine.contains(x.id))) x.attractionId};
    final pois = bundle?.pois ?? const <Poi>[];
    final rows = allRows.where((r) {
      final l = lines[r.a.id];
      return switch (_filter) {
        _Filter.all => true,
        _Filter.soon => l != null && (l.live || l.soon),
        _Filter.mine => mineIds.contains(r.a.id),
        _Filter.favourites => favs.contains(r.a.id),
        _Filter.day => r.a.category != 'EVENING_SHOW',
        _Filter.evening => r.a.category == 'EVENING_SHOW',
      };
    }).toList();

    return KScreen(
      title: 'Programme',
      subtitle: 'Every show today and when it starts',
      page: 'programme',
      colors: featureGradient['programme'],
      padded: false,
      right: Tap(
        onTap: () => context.push('/notifications'),
        label: 'Notifications',
        child: Stack(clipBehavior: Clip.none, children: [
          const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 24),
          if (unread > 0)
            Positioned(
              top: -4,
              right: -4,
              child: Container(
                constraints: const BoxConstraints(minWidth: 16),
                height: 16,
                padding: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(color: const Color(0xFFD9453D), borderRadius: BorderRadius.circular(8), border: Border.all(color: c.screen, width: 1.5)),
                child: Center(child: Text(unread > 9 ? '9+' : '$unread', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800))),
              ),
            ),
        ]),
      ),
      children: [
        if (upNext != null && upAttraction != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(_edge, 20, _edge, 0),
            child: _UpNextCard(
              attraction: upAttraction,
              line: upNext.line,
              onTap: () => context.push('/attraction/${upAttraction.slug}'),
              onMap: () => context.go('/map?focus=${upAttraction.id}'),
              onCalendar: () => _addToCalendar(upNext.line.session),
              walk: _walkTo(upAttraction, gps, pois),
            ),
          ),
        if (plan.ordered.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(_edge, 14, _edge, 0),
            child: _MyDayCard(
              plan: plan,
              onRemove: _toggleMine,
              onCalendar: () => _addAllToCalendar(plan.ordered),
              onShare: () => _share(myDayText('My day at Kynren – The Storied Lands · ${_fmtDate(today)}', plan.ordered)),
              onClear: _clearMine,
            ),
          ),
        if (ruler != null)
          Padding(
            padding: EdgeInsets.fromLTRB(_edge, upNext != null ? 14 : 20, _edge, 14),
            child: KCard(
              padding: const EdgeInsets.all(_cardPad),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(Icons.calendar_month_rounded, color: c.link, size: 18),
                  const SizedBox(width: 8),
                  Text('Today · ${_fmtDate(today)}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text)),
                  const Spacer(),
                  if (nowMin >= ruler.start && nowMin <= ruler.end) ...[
                    Container(width: 8, height: 8, decoration: const BoxDecoration(color: Tokens.danger, shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    Text('Now ${fmtTime(nowDt.toIso8601String())}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.sub)),
                    const SizedBox(width: 10),
                  ],
                  Tap(
                    onTap: () => _share(programmeText('Kynren – The Storied Lands · Today ${_fmtDate(today)}', [for (final r in allRows) (name: r.a.name, sessions: byAttraction[r.a.id] ?? const <Session>[])])),
                    label: 'Share today’s programme',
                    child: Icon(Icons.ios_share_rounded, color: c.link, size: 20),
                  ),
                ]),
                const SizedBox(height: 6),
                SizedBox(
                  height: _rulerH,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    physics: contentW > trackW ? null : const NeverScrollableScrollPhysics(),
                    child: SizedBox(
                      width: contentW,
                      height: _rulerH,
                      child: Stack(children: [
                        Positioned(left: 0, right: 0, top: 22, height: 1, child: ColoredBox(color: c.line)),
                        if (nowMin >= ruler.start && nowMin <= ruler.end)
                          Positioned(
                            left: pos(nowMin) - 1,
                            top: 10,
                            width: 2,
                            height: _rulerH - 10,
                            child: DecoratedBox(decoration: BoxDecoration(color: Tokens.danger, borderRadius: BorderRadius.circular(1))),
                          ),
                        for (final h in ruler.hours)
                          Positioned(
                            left: pos(h) - 20,
                            width: 40,
                            child: Column(children: [
                              Container(margin: const EdgeInsets.only(top: 14), width: 1, height: 8, color: c.line),
                              const SizedBox(height: 2),
                              Text('${h ~/ 60}h', style: TextStyle(fontSize: 11, color: c.sub)),
                            ]),
                          ),
                      ]),
                    ),
                  ),
                ),
              ]),
            ),
          ),
        if (allRows.isNotEmpty)
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: _edge),
              children: [
                for (final f in _Filter.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Tap(
                      onTap: () => setState(() => _filter = f),
                      label: _filterLabels[f],
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: _filter == f ? c.primary : c.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: _filter == f ? c.primary : c.line)),
                        child: Text(f == _Filter.mine && plan.ordered.isNotEmpty ? 'My day (${plan.ordered.length})' : _filterLabels[f]!, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _filter == f ? Colors.white : c.text)),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        if (allRows.isNotEmpty) const SizedBox(height: 14),
        if (bundle == null)
          const Padding(padding: EdgeInsets.all(_edge), child: Column(children: [SkeletonCard(), SizedBox(height: 20), SkeletonCard()]))
        else if (allRows.isNotEmpty && rows.isEmpty)
          Container(
            padding: const EdgeInsets.fromLTRB(40, 40, 40, 60),
            alignment: Alignment.center,
            child: Text(
              switch (_filter) {
                _Filter.favourites => 'No favourites on today. Tap ♡ on a show to keep it here.',
                _Filter.mine => 'Nothing picked yet. Tap a show time and choose “Add to my day”.',
                _Filter.soon => 'Nothing is on or starting within the hour.',
                _ => 'Nothing to show here today.',
              },
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, height: 21 / 15, color: c.sub),
            ),
          )
        else if (rows.isEmpty)
          Container(
            // fills what is left of the screen below the header and above the bottom bar, so the message sits in the middle of it
            constraints: BoxConstraints(minHeight: math.max(240.0, MediaQuery.sizeOf(context).height - MediaQuery.paddingOf(context).top - 190 - navClearance)),
            padding: const EdgeInsets.symmetric(horizontal: 40),
            alignment: Alignment.center,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.calendar_month_rounded, size: 40, color: c.placeholder),
              const SizedBox(height: 14),
              Text(
                // Always a later day than today: an older bundle may still name today, which would read as wrong once the shows are over.
                bundle.nextProgramDate == null
                    ? 'The programme isn’t available yet.'
                    : bundle.nextProgramDate!.compareTo(today) > 0
                        ? 'The programme will be available from ${_fmtDate(bundle.nextProgramDate!)}.'
                        : 'There are no more shows today. The next programme will be available soon.',
                textAlign: TextAlign.center,
                style: TextStyle(fontFamily: Tokens.display, fontSize: 16.5, fontWeight: FontWeight.w800, height: 23 / 16.5, color: c.text),
              ),
            ]),
          ),
        if (bundle != null)
          for (var i = 0; i < rows.length; i++)
            Padding(
              padding: const EdgeInsets.fromLTRB(_edge, 0, _edge, 14),
              child: Reveal(
                index: i,
                child: _ProgramRow(
                  attraction: rows[i].a,
                  badge: rows[i].badge,
                  sessions: byAttraction[rows[i].a.id] ?? const [],
                  line: lines[rows[i].a.id],
                  mine: _mine,
                  walk: _walkTo(rows[i].a, gps, pois),
                  fav: favs.contains(rows[i].a.id),
                  onFav: () => user == null ? context.push('/auth') : context.read<FavoritesState>().toggle(rows[i].a.id),
                  onTime: (s) => _openSession(s, rows[i].a, walk: _walkTo(rows[i].a, gps, pois)),
                  pos: pos,
                  trackW: trackW,
                  contentW: contentW,
                  onTap: () => context.push('/attraction/${rows[i].a.slug}'),
                  onMap: () => context.go('/map?focus=${rows[i].a.id}'),
                ),
              ),
            ),
      ],
    );
  }
}

class _ProgramRow extends StatelessWidget {
  final Attraction attraction;
  final String badge;
  final List<Session> sessions;
  final RunLine? line;
  final Set<String> mine;
  final int? walk;
  final bool fav;
  final VoidCallback onFav;
  final void Function(Session) onTime;
  final double Function(int) pos;
  final double trackW, contentW;
  final VoidCallback onTap, onMap;
  const _ProgramRow({required this.attraction, required this.badge, required this.sessions, required this.line, required this.mine, required this.walk, required this.fav, required this.onFav, required this.onTime, required this.pos, required this.trackW, required this.contentW, required this.onTap, required this.onMap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final continuous = sessions.length > 4;
    final isNew = attraction.sortOrder >= 90; // convention: a high sortOrder flags "new" attractions
    final cancelled = sessions.where((x) => x.status == 'CANCELLED').length;
    final status = sessions.isNotEmpty && cancelled == sessions.length
        ? ('Cancelled', Tokens.danger)
        : cancelled > 0
            ? ('Some times cancelled', Tokens.danger)
            : sessions.any((x) => x.status == 'DELAYED')
                ? ('Delayed', Tokens.warn)
                : null;

    Widget timeLabel(String text, Color color) => Padding(padding: const EdgeInsets.only(bottom: 5), child: Text(text, maxLines: 1, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)));

    Widget track;
    if (continuous) {
      final a = sessions.first, b = sessions.last;
      final left = math.max(0.0, pos(_mins(a.revisedStart ?? a.startTime)));
      final width = math.max(40.0, pos(_mins(b.endTime)) - left);
      track = Stack(children: [
        Positioned(
          left: left,
          child: Tap(
            onTap: () => onTime(line?.session ?? a),
            label: 'Details for ${attraction.name}',
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              timeLabel('From ${fmtTime(a.startTime)} to ${fmtTime(b.endTime)}', c.text),
              Container(width: width, height: 11, decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(6))),
            ]),
          ),
        ),
      ]);
    } else {
      track = Stack(children: [
        for (final s in sessions)
          () {
            final startMin = _mins(s.revisedStart ?? s.startTime);
            final durSpan = math.max(10, _mins(s.endTime) - startMin);
            final x = pos(startMin);
            final pw = math.max(30.0, math.min(pos(startMin + durSpan) - x, 120.0));
            final dead = s.status == 'CANCELLED';
            final picked = mine.contains(s.id);
            return Positioned(
              left: math.max(0.0, x),
              child: Tap(
                onTap: () => onTime(s),
                label: '${fmtTime(s.revisedStart ?? s.startTime)}, ${picked ? 'in your day' : 'details'}',
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  timeLabel('${picked ? '✓ ' : ''}${fmtTime(s.revisedStart ?? s.startTime)}', dead ? Tokens.danger : c.text),
                  Opacity(opacity: dead ? 0.5 : 1, child: Container(width: pw, height: 11, decoration: BoxDecoration(color: dead ? Tokens.danger : picked ? Tokens.gold : c.primary, borderRadius: BorderRadius.circular(6)))),
                ]),
              ),
            );
          }(),
      ]);
    }

    return KCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Tap(onTap: onTap, scaleTo: 1.04, label: attraction.name, child: Cover(image: attraction.heroImage, color: categoryColor[attraction.category] ?? Tokens.brand, icon: Icons.calendar_month_rounded, height: 156)),
        Padding(
          padding: const EdgeInsets.fromLTRB(_cardPad, 12, _cardPad, 0),
          child: Row(children: [
            Container(
              constraints: const BoxConstraints(minWidth: 28),
              height: 28,
              padding: const EdgeInsets.symmetric(horizontal: 4),
              decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(14)),
              child: Center(child: Text(badge, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12))),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Tap(
                onTap: onTap,
                label: attraction.name,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(attraction.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 17, fontWeight: FontWeight.w700, color: c.text))),
                    if (isNew) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Tokens.gold, borderRadius: BorderRadius.circular(4)),
                        child: const Text('NEW', style: TextStyle(color: Color(0xFF3A2C00), fontSize: 10, fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ]),
                  Padding(padding: const EdgeInsets.only(top: 2), child: Text('${attraction.durationMins} mins · ${sessions.length} ${sessions.length == 1 ? 'time' : 'times'}${walk == null ? '' : ' · $walk min walk'}', style: TextStyle(fontSize: 12.5, color: c.sub))),
                  if (status != null)
                    Padding(padding: const EdgeInsets.only(top: 3), child: Text(status.$1, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: status.$2)))
                  else if (line != null && (line!.live || line!.soon))
                    Padding(
                      padding: const EdgeInsets.only(top: 3),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(width: 7, height: 7, decoration: BoxDecoration(color: line!.live ? Tokens.danger : Tokens.warn, shape: BoxShape.circle)),
                        const SizedBox(width: 6),
                        Flexible(child: Text(line!.text, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: line!.live ? Tokens.danger : c.text))),
                      ]),
                    ),
                ]),
              ),
            ),
            const SizedBox(width: 12),
            Tap(
              onTap: onFav,
              label: fav ? 'Remove ${attraction.name} from your favourites' : 'Add ${attraction.name} to your favourites',
              child: Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(fav ? Icons.favorite_rounded : Icons.favorite_border_rounded, color: fav ? Tokens.danger : c.link, size: 19)),
            ),
            const SizedBox(width: 8),
            Tap(
              onTap: onMap,
              label: 'Show ${attraction.name} on the map',
              child: Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.place_outlined, color: c.link, size: 19)),
            ),
          ]),
        ),
        // Timeline track: horizontally scrollable; the show picture above stays put.
        Padding(
          padding: const EdgeInsets.all(_cardPad),
          child: SizedBox(
            height: 40,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              physics: contentW > trackW ? null : const NeverScrollableScrollPhysics(),
              child: SizedBox(width: contentW, height: 40, child: track),
            ),
          ),
        ),
      ]),
    );
  }
}

/// The show that is on now, or the next to start: a one-glance answer to "what should I see?".
class _UpNextCard extends StatelessWidget {
  final Attraction attraction;
  final RunLine line;
  final VoidCallback onTap, onMap, onCalendar;
  final int? walk;
  const _UpNextCard({required this.attraction, required this.line, required this.onTap, required this.onMap, required this.onCalendar, this.walk});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final accent = line.live ? Tokens.danger : c.link;
    Widget action(IconData icon, String label, VoidCallback onTap) => Tap(
          onTap: onTap,
          label: label,
          child: Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(icon, color: c.link, size: 19)),
        );
    return KCard(
      padding: const EdgeInsets.all(_cardPad),
      child: Row(children: [
        Expanded(
          child: Tap(
            onTap: onTap,
            label: attraction.name,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(line.live ? 'ON NOW' : 'UP NEXT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: accent)),
              const SizedBox(height: 3),
              Text(attraction.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 17, fontWeight: FontWeight.w700, color: c.text)),
              const SizedBox(height: 2),
              Text('${line.live || line.soon ? line.text : '${line.text} today'}${walk == null ? '' : ' · $walk min walk'}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.sub)),
            ]),
          ),
        ),
        const SizedBox(width: 12),
        if (!line.live) ...[action(Icons.event_available_outlined, 'Add ${attraction.name} to your calendar', onCalendar), const SizedBox(width: 8)],
        action(Icons.place_outlined, 'Show ${attraction.name} on the map', onMap),
      ]),
    );
  }
}

/// The show times a guest picked for today, in order, with a warning wherever two of them overlap or leave too little
/// time to walk from one to the next.
class _MyDayCard extends StatelessWidget {
  final ({List<Session> ordered, List<DayNote> notes}) plan;
  final void Function(Session) onRemove;
  final VoidCallback onCalendar, onShare, onClear;
  const _MyDayCard({required this.plan, required this.onRemove, required this.onCalendar, required this.onShare, required this.onClear});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final noteFor = {for (final n in plan.notes) n.second.id: n};
    Widget action(IconData icon, String label, VoidCallback onTap) => Tap(
          onTap: onTap,
          label: label,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, color: c.link, size: 16),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: c.link)),
            ]),
          ),
        );
    return KCard(
      padding: const EdgeInsets.all(_cardPad),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.star_rounded, color: Tokens.gold, size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text('My day · ${plan.ordered.length} ${plan.ordered.length == 1 ? 'show' : 'shows'}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text))),
        ]),
        const SizedBox(height: 8),
        for (final s in plan.ordered) ...[
          Row(children: [
            SizedBox(width: 52, child: Text(sessionTimeText(s), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: c.text))),
            Expanded(child: Text(s.attractionName, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.text))),
            Tap(onTap: () => onRemove(s), label: 'Remove ${s.attractionName} from my day', child: Padding(padding: const EdgeInsets.all(6), child: Icon(Icons.close_rounded, size: 18, color: c.sub))),
          ]),
          if (noteFor[s.id] != null)
            Padding(
              padding: const EdgeInsets.only(left: 52, bottom: 4),
              child: Row(children: [
                Icon(Icons.warning_amber_rounded, size: 15, color: noteFor[s.id]!.clash ? Tokens.danger : Tokens.warn),
                const SizedBox(width: 5),
                Expanded(child: Text(dayNoteText(noteFor[s.id]!), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: noteFor[s.id]!.clash ? Tokens.danger : c.sub))),
              ]),
            ),
        ],
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: [
          action(Icons.event_available_outlined, 'Add all to calendar', onCalendar),
          action(Icons.ios_share_rounded, 'Share', onShare),
          action(Icons.delete_outline_rounded, 'Clear', onClear),
        ]),
      ]),
    );
  }
}

/// What a guest can do with one show time.
class _SessionSheet extends StatelessWidget {
  final Session session;
  final Attraction attraction;
  final int? walk;
  final bool picked;
  final VoidCallback onPick, onCalendar, onMap, onOpen, onShare;
  const _SessionSheet({required this.session, required this.attraction, required this.walk, required this.picked, required this.onPick, required this.onCalendar, required this.onMap, required this.onOpen, required this.onShare});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final s = session;
    final moved = s.revisedStart != null && s.revisedStart != s.startTime;
    final dead = s.status == 'CANCELLED';
    Widget item(IconData icon, String label, VoidCallback onTap, {Color? color}) => Tap(
          onTap: onTap,
          label: label,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 11),
            child: Row(children: [
              Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(icon, color: color ?? c.link, size: 19)),
              const SizedBox(width: 14),
              Expanded(child: Text(label, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: c.text))),
            ]),
          ),
        );
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(_edge, 0, _edge, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(attraction.name, style: TextStyle(fontFamily: Tokens.display, fontSize: 20, fontWeight: FontWeight.w700, color: c.text)),
          const SizedBox(height: 4),
          Text('${sessionTimeText(s)} – ${fmtTime(s.endTime)} · ${sessionMins(s)} mins${walk == null ? '' : ' · $walk min walk'}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.sub)),
          if (dead || moved || s.status == 'DELAYED' || (s.note ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            if (dead) const Text('This time is cancelled.', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Tokens.danger)),
            if (!dead && moved) Text('Moved from ${fmtTime(s.startTime)}.', style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Tokens.warn)),
            if (!dead && !moved && s.status == 'DELAYED') const Text('This show is delayed.', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Tokens.warn)),
            if ((s.note ?? '').isNotEmpty) Text(s.note!, style: TextStyle(fontSize: 13.5, color: c.sub)),
          ],
          const SizedBox(height: 6),
          if (!dead) item(picked ? Icons.check_circle_rounded : Icons.star_border_rounded, picked ? 'In my day · tap to remove' : 'Add to my day', onPick, color: picked ? Tokens.gold : null),
          if (!dead) item(Icons.event_available_outlined, 'Add to calendar', onCalendar),
          item(Icons.place_outlined, 'Find it on the map', onMap),
          item(Icons.ios_share_rounded, 'Share this time', onShare),
          item(Icons.info_outline_rounded, 'About the show', onOpen),
        ]),
      ),
    );
  }
}
