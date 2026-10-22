import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/notifications.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/cover.dart';
import '../ui/reveal.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

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

class _ProgrammeScreenState extends State<ProgrammeScreen> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    // The programme always reflects the current day; the date is not selectable.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final sync = context.read<SyncState>();
      final today = ukTodayStr();
      if (sync.date != today) sync.setDate(today);
      context.read<UnreadNotifications>().refresh();
    });
    // Re-check which sessions have finished once a minute so a show drops off on its own.
    _tick = Timer.periodic(const Duration(minutes: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
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
    final rows = [
      for (var i = 0; i < dayA.length; i++) (a: dayA[i], badge: '${i + 1}'),
      for (final a in evening) (a: a, badge: '🌙'),
    ].where((r) => (byAttraction[r.a.id]?.length ?? 0) > 0).toList();

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
        if (ruler != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(_edge, 20, _edge, 14),
            child: KCard(
              padding: const EdgeInsets.all(_cardPad),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(Icons.calendar_month_rounded, color: c.link, size: 18),
                  const SizedBox(width: 8),
                  Text('Today · ${_fmtDate(today)}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text)),
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
        if (bundle == null)
          const Padding(padding: EdgeInsets.all(_edge), child: LinearProgressIndicator(minHeight: 2))
        else if (rows.isEmpty)
          Container(
            constraints: const BoxConstraints(minHeight: 380),
            padding: const EdgeInsets.symmetric(horizontal: 40),
            alignment: Alignment.center,
            child: Text(
              bundle.nextProgramDate != null ? 'The programme will be available from ${_fmtDate(bundle.nextProgramDate!)}.' : 'The programme isn’t available yet.',
              textAlign: TextAlign.center,
              style: TextStyle(fontFamily: Tokens.serif, fontSize: 16.5, fontWeight: FontWeight.w800, height: 23 / 16.5, color: c.text),
            ),
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
  final double Function(int) pos;
  final double trackW, contentW;
  final VoidCallback onTap, onMap;
  const _ProgramRow({required this.attraction, required this.badge, required this.sessions, required this.pos, required this.trackW, required this.contentW, required this.onTap, required this.onMap});

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
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            timeLabel('From ${fmtTime(a.startTime)} to ${fmtTime(b.endTime)}', c.text),
            Container(width: width, height: 11, decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(6))),
          ]),
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
            return Positioned(
              left: math.max(0.0, x),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                timeLabel(fmtTime(s.revisedStart ?? s.startTime), dead ? Tokens.danger : c.text),
                Opacity(opacity: dead ? 0.5 : 1, child: Container(width: pw, height: 11, decoration: BoxDecoration(color: dead ? Tokens.danger : c.primary, borderRadius: BorderRadius.circular(6)))),
              ]),
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
                    Flexible(child: Text(attraction.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.serif, fontSize: 17, fontWeight: FontWeight.w700, color: c.text))),
                    if (isNew) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Tokens.gold, borderRadius: BorderRadius.circular(4)),
                        child: const Text('NEW', style: TextStyle(color: Color(0xFF3A2C00), fontSize: 10, fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ]),
                  Padding(padding: const EdgeInsets.only(top: 2), child: Text('${attraction.durationMins} mins · ${sessions.length} ${sessions.length == 1 ? 'time' : 'times'}', style: TextStyle(fontSize: 12.5, color: c.sub))),
                  if (status != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(status.$1, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: status.$2))),
                ]),
              ),
            ),
            const SizedBox(width: 12),
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
