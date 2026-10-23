import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

class _Stop {
  final String showSessionId, attractionId, attractionName, category, startTime, endTime;
  final int walkSecondsFromPrev, reminderMins;
  _Stop.fromJson(Map<String, dynamic> j)
      : showSessionId = j['showSessionId'] as String,
        attractionId = j['attractionId'] as String,
        attractionName = j['attractionName'] as String,
        category = j['category'] as String? ?? 'OTHER',
        startTime = j['startTime'] as String,
        endTime = j['endTime'] as String,
        walkSecondsFromPrev = (j['walkSecondsFromPrev'] as num?)?.toInt() ?? 0,
        reminderMins = (j['reminderMins'] as num?)?.toInt() ?? 0;
}

class _Plan {
  final List<_Stop> stops;
  final List<String> unschedulable;
  _Plan(this.stops, this.unschedulable);
}

class PlanScreen extends StatefulWidget {
  const PlanScreen({super.key});
  @override
  State<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends State<PlanScreen> {
  final Set<String> _selected = {};
  _Plan? _plan;
  bool _loading = false, _saving = false, _saved = false;

  Future<void> _optimize(String date) async {
    setState(() {
      _loading = true;
      _plan = null;
      _saved = false;
    });
    try {
      final r = await api('/itinerary/optimize', method: 'POST', body: {'date': date, 'attractionIds': _selected.toList(), 'arrival': '10:30', 'departure': '18:00'}) as Map<String, dynamic>;
      _plan = _Plan([for (final s in r['stops'] as List) _Stop.fromJson(s as Map<String, dynamic>)], (r['unschedulable'] as List?)?.cast<String>() ?? []);
    } catch (_) {
      _plan = _Plan([], []);
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _save(String date, AuthUser? user) async {
    final plan = _plan;
    if (plan == null || plan.stops.isEmpty) return;
    if (user == null) {
      context.push('/auth');
      return;
    }
    setState(() => _saving = true);
    try {
      await api('/itinerary', method: 'POST', body: {'date': date, 'showSessionIds': plan.stops.map((s) => s.showSessionId).toList()});
      _saved = true;
    } catch (_) {
      // offline or the request failed: leave the plan on screen so they can retry
    }
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final sync = context.watch<SyncState>();
    final user = context.watch<AuthState>().user;
    final t = context.watch<I18nState>().t;
    final bundle = sync.bundle;
    final attractions = (bundle?.attractions ?? []).where((a) => a.category != 'EVENING_SHOW').toList();
    final durationById = {for (final a in bundle?.attractions ?? []) a.id: a.durationMins};
    final nameById = {for (final a in bundle?.attractions ?? []) a.id: a.name};
    final allOn = attractions.isNotEmpty && _selected.length == attractions.length;
    final plan = _plan;

    String? summaryWindow;
    int? walkMins;
    if (plan != null && plan.stops.isNotEmpty) {
      summaryWindow = '${fmtTime(plan.stops.first.startTime)}–${fmtTime(plan.stops.last.endTime)}';
      walkMins = (plan.stops.fold(0, (s, x) => s + x.walkSecondsFromPrev) / 60).round();
    }

    Widget summaryCell(String n, String label, {bool small = false}) => Expanded(
          child: Column(children: [
            Text(n, style: TextStyle(fontFamily: Tokens.display, fontSize: small ? 14 : 16.5, fontWeight: FontWeight.w800, color: c.link)),
            const SizedBox(height: 2),
            Text(label.toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0.4, color: c.sub)),
          ]),
        );

    return KScreen(
      title: t('plan.title'),
      subtitle: 'Build a walkable, clash-free day',
      page: 'plan',
      colors: featureGradient['programme'],
      children: [
        Text('Pick the shows you don’t want to miss and we’ll fit them into a walkable, clash-free timetable.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              Expanded(child: Text('CHOOSE YOUR SHOWS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: c.sub))),
              Tap(
                onTap: () => setState(() {
                  if (allOn) {
                    _selected.clear();
                  } else {
                    _selected.addAll(attractions.map((a) => a.id));
                  }
                }),
                child: Text(allOn ? 'Clear all' : 'Select all', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: c.link)),
              ),
            ]),
          ),
          if (bundle == null) const LinearProgressIndicator(minHeight: 2),
          for (final a in attractions)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: KCard(
                color: _selected.contains(a.id) ? c.tint : null,
                onTap: () => setState(() => _selected.contains(a.id) ? _selected.remove(a.id) : _selected.add(a.id)),
                padding: const EdgeInsets.all(14),
                child: Row(children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(color: categoryColor[a.category] ?? c.sub, shape: BoxShape.circle)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(a.name, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: c.text)),
                      Padding(padding: const EdgeInsets.only(top: 2), child: Text('${a.category.toLowerCase().replaceAll('_', ' ')} · ${a.durationMins} min', style: TextStyle(fontSize: 12.5, color: c.sub))),
                    ]),
                  ),
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(color: _selected.contains(a.id) ? c.primary : c.tint, shape: BoxShape.circle),
                    child: Icon(_selected.contains(a.id) ? Icons.check_rounded : Icons.star_border_rounded, color: _selected.contains(a.id) ? Colors.white : c.link, size: 16),
                  ),
                ]),
              ),
            ),
        ]),
        KButton('${t('plan.optimise')}${_selected.isNotEmpty ? ' (${_selected.length})' : ''}', full: true, loading: _loading, onPressed: _selected.isEmpty ? null : () => _optimize(sync.date)),
        if (plan != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: Text('Your day, planned', style: TextStyle(fontFamily: Tokens.display, fontSize: 16.5, fontWeight: FontWeight.w800, color: c.text))),
              if (summaryWindow != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: KCard(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(children: [
                      summaryCell('${plan.stops.length}', plan.stops.length == 1 ? 'show' : 'shows'),
                      Container(width: 1, height: 28, color: c.line),
                      summaryCell(summaryWindow, 'your window', small: true),
                      Container(width: 1, height: 28, color: c.line),
                      summaryCell('${walkMins}m', 'walking'),
                    ]),
                  ),
                ),
              if (plan.stops.isEmpty)
                KCard(
                  padding: const EdgeInsets.all(18),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Nothing could be scheduled', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5, color: c.text)),
                    const SizedBox(height: 4),
                    Text('Try selecting fewer shows, or check you’re on an open day.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
                  ]),
                ),
              // Connected timeline
              for (var i = 0; i < plan.stops.length; i++)
                () {
                  final s = plan.stops[i];
                  final color = categoryColor[s.category] ?? c.link;
                  final dur = durationById[s.attractionId];
                  final last = i == plan.stops.length - 1;
                  return Column(children: [
                    if (i > 0 && s.walkSecondsFromPrev > 0)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(children: [
                          const SizedBox(width: 42),
                          Text('🚶 ${(s.walkSecondsFromPrev / 60).round()} min walk', style: TextStyle(fontSize: 12.5, color: c.sub)),
                        ]),
                      ),
                    IntrinsicHeight(
                      child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        SizedBox(
                          width: 30,
                          child: Column(children: [
                            Container(width: 30, height: 30, decoration: BoxDecoration(color: color, shape: BoxShape.circle), child: Center(child: Text('${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)))),
                            if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 2), color: c.line)),
                          ]),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: KCard(
                              child: Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(border: Border(left: BorderSide(color: color, width: 4))),
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Row(children: [
                                    Expanded(child: Text(fmtTime(s.startTime), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: c.text))),
                                    if (dur != null) Text('$dur min', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.sub)),
                                  ]),
                                  Padding(padding: const EdgeInsets.only(top: 4), child: Text(s.attractionName, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: c.text))),
                                  Padding(padding: const EdgeInsets.only(top: 4), child: Text('Ends ${fmtTime(s.endTime)} · ${s.reminderMins} min reminder', style: TextStyle(fontSize: 12.5, color: c.sub))),
                                ]),
                              ),
                            ),
                          ),
                        ),
                      ]),
                    ),
                  ]);
                }(),
              if (plan.unschedulable.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: KCard(
                    color: c.tint,
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Couldn’t fit these in', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: c.text)),
                      const SizedBox(height: 4),
                      Text('${plan.unschedulable.map((id) => nameById[id] ?? id).join(', ')} — they clash with your other picks.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
                    ]),
                  ),
                ),
              if (plan.stops.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 20),
                  child: _saved
                      ? KCard(color: c.tint, padding: const EdgeInsets.all(14), child: Center(child: Text('✓ Saved — we’ll remind you before each show starts.', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Tokens.ok))))
                      : KButton(user != null ? 'Save my day & remind me' : 'Sign in to save & get reminders', full: true, loading: _saving, onPressed: () => _save(sync.date, user)),
                ),
            ]),
          ),
      ],
    );
  }
}
