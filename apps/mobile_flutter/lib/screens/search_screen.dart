import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/cover.dart';
import '../ui/reveal.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

enum Kind { show, food, shop, facility }

class _Result {
  final String key, title, subtitle, to, haystack;
  final Kind kind;
  final String? image;
  _Result(this.key, this.kind, this.title, this.subtitle, this.image, this.to, this.haystack);
}

const _recentKey = 'kynren_recent_searches';
const _filters = <(String, String)>[('all', 'All'), ('show', 'Shows'), ('food', 'Food'), ('shop', 'Shops'), ('facility', 'Facilities')];
const _kindIcon = {Kind.show: Icons.calendar_month_rounded, Kind.food: Icons.restaurant_rounded, Kind.shop: Icons.storefront_rounded, Kind.facility: Icons.place_rounded};
const _tileTitle = {Kind.show: 'Shows', Kind.food: 'Food & drink', Kind.shop: 'Shops', Kind.facility: 'Facilities'};
const _kindTitle = {Kind.show: 'Shows & attractions', Kind.food: 'Food & drink', Kind.shop: 'Shops', Kind.facility: 'Facilities'};
final _kindColor = {Kind.show: featureGradient['programme']![0], Kind.food: featureGradient['restaurants']![0], Kind.shop: const Color(0xFF2F5B43), Kind.facility: const Color(0xFF4B5D73)};
const _facilityLabel = {
  'RESTROOM': 'Toilets', 'FIRST_AID': 'First aid', 'PARKING': 'Parking', 'ACCESSIBILITY': 'Accessibility',
  'BABY_CHANGING': 'Baby changing', 'PICNIC': 'Picnic area', 'ENTRANCE': 'Entrance', 'INFO': 'Information',
};
const _quick = [
  (label: 'Programme', hint: 'What is on, and when', icon: Icons.calendar_month_rounded, to: '/shows'),
  (label: 'My tickets', hint: 'Your QR codes', icon: Icons.confirmation_number_rounded, to: '/tickets'),
  (label: 'Shuttle', hint: 'Timetable and stops', icon: Icons.directions_bus_rounded, to: '/shuttle'),
  (label: 'Accessibility', hint: 'Step-free routes and support', icon: Icons.accessible_rounded, to: '/accessibility'),
];

class SearchScreen extends StatefulWidget {
  /// A filter handed in by a link (Home's "Shops") applies until the guest picks another chip.
  final String? linkedFilter;
  const SearchScreen({super.key, this.linkedFilter});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  String _query = '';
  String? _chosen;
  List<String> _recent = [];

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      if (mounted) setState(() => _recent = p.getStringList(_recentKey) ?? []);
    });
  }

  /// Remember a search the guest acted on: newest first, no repeats, six at most.
  void _remember(String q) {
    final t = q.trim();
    if (t.isEmpty) return;
    setState(() => _recent = [t, ..._recent.where((r) => r.toLowerCase() != t.toLowerCase())].take(6).toList());
    SharedPreferences.getInstance().then((p) => p.setStringList(_recentKey, _recent));
  }

  void _clearRecent() {
    setState(() => _recent = []);
    SharedPreferences.getInstance().then((p) => p.remove(_recentKey));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<_Result> _all(SyncState sync) {
    final b = sync.bundle;
    final out = <_Result>[];
    for (final a in b?.attractions ?? []) {
      out.add(_Result('a-${a.id}', Kind.show, a.name, (a.tagline ?? '').isNotEmpty ? a.tagline! : a.category.replaceAll('_', ' ').toLowerCase(), a.heroImage, '/attraction/${a.slug}', '${a.name} ${a.tagline ?? ''} ${a.category} ${a.synopsis}'));
    }
    for (final r in b?.restaurants ?? []) {
      out.add(_Result('r-${r.id}', Kind.food, r.name, (r.cuisine ?? '').isNotEmpty ? r.cuisine! : 'Restaurant', r.heroImage, '/restaurant/${r.slug}', '${r.name} ${r.cuisine ?? ''} ${r.description ?? ''} ${r.menuItems.map((m) => m.name).join(' ')}'));
    }
    for (final s in b?.shops ?? []) {
      out.add(_Result('s-${s.id}', Kind.shop, s.name, (s.category ?? '').isNotEmpty ? s.category! : 'Shop', s.heroImage, '/shop/${s.slug}', '${s.name} ${s.category ?? ''} ${s.description ?? ''} ${s.items.map((i) => i.name).join(' ')}'));
    }
    for (final p in b?.pois ?? []) {
      final label = _facilityLabel[p.type];
      if (label == null) continue;
      out.add(_Result('p-${p.id}', Kind.facility, p.name, label, p.image ?? p.heroImage, '/facility/${p.id}', '${p.name} $label ${p.description ?? ''} ${p.mapZone ?? ''}'));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final sync = context.watch<SyncState>();
    final linked = _filters.any((f) => f.$1 == widget.linkedFilter) ? widget.linkedFilter! : 'all';
    final filter = _chosen ?? linked;
    final all = _all(sync);
    final q = _query.trim().toLowerCase();
    final browsing = q.isEmpty && filter == 'all';
    final words = q.isEmpty ? <String>[] : q.split(RegExp(r'\s+'));
    final results = browsing ? <_Result>[] : all.where((r) => (filter == 'all' || r.kind.name == filter) && words.every((w) => r.haystack.toLowerCase().contains(w))).toList();

    // A real photo for each category tile, and how much is in it.
    final tiles = [
      for (final kind in Kind.values)
        (kind: kind, count: all.where((r) => r.kind == kind).length, image: all.where((r) => r.kind == kind && r.image != null).map((r) => r.image).firstOrNull),
    ];
    final grouped = [for (final kind in Kind.values) (kind: kind, items: results.where((r) => r.kind == kind).toList())].where((g) => g.items.isNotEmpty);

    return KScreen(
      title: 'Search',
      subtitle: 'Shows, food, shops and facilities',
      page: 'search',
      back: false,
      padded: false,
      below: SearchPill(placeholder: 'Find everything here', controller: _controller, onChanged: (t) => setState(() => _query = t), onSubmitted: _remember),
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Row(children: [
            for (final f in _filters) Padding(padding: const EdgeInsets.only(right: 10), child: KChip(f.$2, active: filter == f.$1, onTap: () => setState(() => _chosen = f.$1))),
          ]),
        ),
        if (browsing && _recent.isNotEmpty) ...[
          Padding(padding: const EdgeInsets.only(top: 4, bottom: 12), child: SectionHeader('Recent searches', action: 'Clear', onAction: _clearRecent)),
          Padding(
            padding: const EdgeInsets.only(left: 20, right: 20, bottom: 10),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (final r in _recent)
                KChip(r, onTap: () {
                  _controller.text = r;
                  _controller.selection = TextSelection.collapsed(offset: r.length);
                  setState(() => _query = r);
                }),
            ]),
          ),
        ],
        if (browsing) ...[
          const Padding(padding: EdgeInsets.only(top: 4, bottom: 12), child: SectionHeader('Browse the park')),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: GridView.count(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.0,
              shrinkWrap: true,
              padding: EdgeInsets.zero,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                for (final t in tiles)
                  Tap(
                    onTap: () => setState(() => _chosen = t.kind.name),
                    scaleTo: 1.04,
                    label: '${_kindTitle[t.kind]}, ${t.count}',
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Cover(image: t.image, color: _kindColor[t.kind]!, icon: _kindIcon[t.kind]!, height: 112, radius: 18),
                      const SizedBox(height: 8),
                      Text(_tileTitle[t.kind]!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 16.5, fontWeight: FontWeight.w700, color: c.text)),
                      Text('${t.count} ${t.count == 1 ? 'place' : 'places'}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.sub)),
                    ]),
                  ),
              ],
            ),
          ),
          const Padding(padding: EdgeInsets.only(top: 14, bottom: 12), child: SectionHeader('Quick links')),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(children: [
              for (final item in _quick)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: KCard(
                    onTap: () => context.push(item.to),
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Container(width: 48, height: 48, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(item.icon, color: c.link, size: 22)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(item.label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.text)),
                          Padding(padding: const EdgeInsets.only(top: 2), child: Text(item.hint, style: TextStyle(fontSize: 12.5, color: c.sub))),
                        ]),
                      ),
                      Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
                    ]),
                  ),
                ),
            ]),
          ),
        ] else if (results.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(40, 56, 40, 0),
            child: Column(children: [
              Icon(Icons.search_rounded, color: c.placeholder, size: 34),
              const SizedBox(height: 10),
              Text(q.isNotEmpty ? 'Nothing found for “${_query.trim()}”' : 'Nothing here yet', textAlign: TextAlign.center, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.text)),
              const SizedBox(height: 2),
              Text('Try a different word, or another filter.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: c.sub)),
            ]),
          )
        else
          for (final g in grouped)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Column(children: [
                SectionHeader(_kindTitle[g.kind]!),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(children: [
                    for (var i = 0; i < g.items.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Reveal(
                          index: i,
                          child: KCard(
                            onTap: () {
                              _remember(_query);
                              context.push(g.items[i].to);
                            },
                            padding: const EdgeInsets.all(14),
                            child: Row(children: [
                              Cover(image: g.items[i].image, color: _kindColor[g.items[i].kind]!, icon: _kindIcon[g.items[i].kind]!, height: 64, width: 64, radius: 16),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(g.items[i].title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.text)),
                                  Padding(padding: const EdgeInsets.only(top: 2), child: Text(g.items[i].subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.sub))),
                                ]),
                              ),
                              Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
                            ]),
                          ),
                        ),
                      ),
                  ]),
                ),
              ]),
            ),
      ],
    );
  }
}
