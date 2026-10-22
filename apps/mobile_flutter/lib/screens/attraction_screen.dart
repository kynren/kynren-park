import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/favorites.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/detail_kit.dart';
import '../ui/tap.dart';

class AttractionScreen extends StatefulWidget {
  final String slug;
  const AttractionScreen({super.key, required this.slug});
  @override
  State<AttractionScreen> createState() => _AttractionScreenState();
}

class _AttractionScreenState extends State<AttractionScreen> {
  bool _seen = false;
  bool _showAccess = false;
  String? _loadedFor;

  void _loadSeen(Attraction a, AuthUser? user) {
    if (user == null || _loadedFor == a.id) return;
    _loadedFor = a.id;
    api('/me/seen').then((s) {
      if (mounted) setState(() => _seen = (s as List).any((x) => (x as Map)['attractionId'] == a.id));
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final sync = context.watch<SyncState>();
    final user = context.watch<AuthState>().user;
    final favs = context.watch<FavoritesState>();
    final bundle = sync.bundle;
    final attraction = bundle?.attractions.where((a) => a.slug == widget.slug).firstOrNull;
    if (attraction == null) return NotFound('Show not found.', loading: bundle == null);
    _loadSeen(attraction, user);

    final sessions = (bundle?.sessions ?? []).where((s) => s.attractionSlug == widget.slug).toList()
      ..sort((a, b) => DateTime.parse(a.startTime).compareTo(DateTime.parse(b.startTime)));
    final images = attraction.images.isNotEmpty ? attraction.images : (attraction.heroImage != null ? [attraction.heroImage!] : <String>[]);
    final favorite = favs.ids.contains(attraction.id);

    final access = <(String, String)>[
      if (attraction.wheelchairAccessible) ('♿', 'Step-free access'),
      if (attraction.hasAudioDescription) ('🔊', 'Audio described'),
      if (attraction.hasCaptioning) ('💬', 'Captioned performances'),
      if (attraction.hasBSL) ('🤟', 'BSL interpreted'),
    ];

    Future<void> markSeen() async {
      if (user == null) {
        context.push('/auth');
        return;
      }
      setState(() => _seen = true);
      await api('/me/seen', method: 'POST', body: {'attractionId': attraction.id}).catchError((_) {
        if (mounted) setState(() => _seen = false);
        return null;
      });
    }

    final dateLong = DateFormat('EEEE, d MMMM').format(DateTime.parse('${sync.date}T00:00:00.000Z'));

    return DetailPage(
      images: images,
      colors: featureGradient['programme']!,
      children: [
        SheetTitle(attraction.name),
        if ((attraction.tagline ?? '').isNotEmpty || attraction.synopsis.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(
              '${(attraction.tagline ?? '').isNotEmpty ? '${attraction.tagline}\n\n' : ''}${attraction.synopsis}',
              style: TextStyle(color: c.sub, fontSize: 14.5, height: 21 / 14.5),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            TagChip(icon: '🎭', label: attraction.category.replaceAll('_', ' ').toLowerCase()),
            TagChip(icon: '⏱️', label: '${attraction.durationMins} min'),
            for (final a in access) TagChip(icon: a.$1, label: a.$2),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 18),
          child: Row(children: [
            ActionPill(icon: Icons.map_outlined, label: 'Go to', onTap: () => context.go('/map?focus=${attraction.id}')),
            const SizedBox(width: 10),
            ActionPill(
              icon: favorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              label: favorite ? 'Favourited' : 'Favourites',
              onTap: () => user == null ? context.push('/auth') : favs.toggle(attraction.id),
            ),
            const SizedBox(width: 10),
            ActionPill(icon: Icons.check_rounded, label: _seen ? 'Seen it' : 'I did it', onTap: markSeen),
          ]),
        ),
        const SectionLabel('Schedules'),
        Transform.translate(offset: const Offset(0, -4), child: Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(dateLong, style: TextStyle(color: c.sub, fontSize: 12.5)))),
        if (sessions.isEmpty)
          const Muted('No sessions listed for this day.')
        else
          Wrap(spacing: 10, runSpacing: 10, children: [
            for (final s in sessions)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(
                    fmtTime(s.revisedStart ?? s.startTime),
                    style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: s.status == 'CANCELLED' ? const Color(0xFFD64545) : c.link, decoration: s.status == 'CANCELLED' ? TextDecoration.lineThrough : null),
                  ),
                  if (s.status != 'SCHEDULED') ...[
                    const SizedBox(width: 6),
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: statusColor[s.status], shape: BoxShape.circle)),
                  ],
                ]),
              ),
          ]),
        Container(
          margin: const EdgeInsets.only(top: 24),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line))),
          child: Tap(
            onTap: () => setState(() => _showAccess = !_showAccess),
            child: Padding(
              padding: const EdgeInsets.only(top: 18),
              child: Row(children: [
                Expanded(child: Text('Accessibility & Other Information', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: c.link))),
                Icon(_showAccess ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded, color: c.link),
              ]),
            ),
          ),
        ),
        if (_showAccess)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (access.isNotEmpty)
                for (final a in access) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text('${a.$1}  ${a.$2}', style: TextStyle(fontSize: 14.5, color: c.text)))
              else
                const Muted('No specific accessibility features listed.'),
              if (attraction.sensoryNotes != null)
                Padding(padding: const EdgeInsets.only(top: 4), child: Text('Sensory: ${attraction.sensoryNotes}', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub))),
            ]),
          ),
      ],
    );
  }
}
