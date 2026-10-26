import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/favorites.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/programme_logic.dart';
import '../core/restaurant_favs.dart';
import '../core/search_logic.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/cover.dart';
import '../ui/reveal.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';
import 'map/map_logic.dart' show fmtDist, halfMileM;

enum Kind { show, food, shop, facility }

class _Result {
  final String key, title, subtitle, to, haystack;
  final Kind kind;
  final String? image;

  /// The id the map takes to show this place, and the park spot it sits on (null when it has no place on the map).
  final String? focus, poiId;
  final bool saved;

  /// For a show: what it is doing right now.
  final RunLine? line;
  _Result(this.key, this.kind, this.title, this.subtitle, this.image, this.to, this.haystack, {this.focus, this.poiId, this.saved = false, this.line});
}

/// A screen the guest may be looking for by name rather than a place: matched on its keywords.
class _Page {
  final String label, hint, to;
  final IconData icon;
  final List<String> keywords;
  final bool tab; // a tab of the bottom bar is switched to, not pushed over the top
  const _Page(this.label, this.hint, this.icon, this.to, this.keywords, {this.tab = false});
}

const _recentKey = 'kynren_recent_searches';
const _filters = <(String, String)>[('all', 'All'), ('saved', 'Saved'), ('show', 'Shows'), ('food', 'Food'), ('shop', 'Shops'), ('facility', 'Facilities')];
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

// What the search box can take the guest to besides places, found by the words people use for them.
const _pages = [
  _Page('Programme', 'What is on, and when', Icons.calendar_month_rounded, '/shows', ['programme', 'program', 'schedule', 'timetable', 'times', 'showtimes', 'today']),
  _Page('My tickets', 'Your QR codes', Icons.confirmation_number_rounded, '/tickets', ['tickets', 'ticket', 'qr', 'code', 'booking', 'entry']),
  _Page('Shuttle', 'Timetable and stops', Icons.directions_bus_rounded, '/shuttle', ['shuttle', 'bus', 'transport', 'stops', 'travel']),
  _Page('Accessibility', 'Step-free routes and support', Icons.accessible_rounded, '/accessibility', ['accessibility', 'accessible', 'wheelchair', 'disabled', 'stepfree', 'help', 'support']),
  _Page('Plan my day', 'A route through the shows', Icons.route_rounded, '/plan', ['plan', 'itinerary', 'route', 'day', 'schedule']),
  _Page('Park map', 'Find your way around', Icons.map_rounded, '/map', ['map', 'directions', 'navigate', 'find', 'where'], tab: true),
  _Page('My orders', 'Food and shop orders', Icons.receipt_long_rounded, '/orders', ['orders', 'order', 'receipt', 'purchase']),
  _Page('Notifications', 'News from the park', Icons.notifications_none_rounded, '/notifications', ['notifications', 'alerts', 'news', 'messages']),
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
  bool _nearest = false;
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

  void _setQuery(String q) {
    _controller.text = q;
    _controller.selection = TextSelection.collapsed(offset: q.length);
    setState(() => _query = q);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<_Result> _all(SyncState sync, Set<String> favs, Set<String> restFavs) {
    final b = sync.bundle;
    final now = ukNow();
    final sessionsBy = <String, List<Session>>{};
    for (final s in b?.sessions ?? <Session>[]) {
      (sessionsBy[s.attractionId] ??= []).add(s);
    }
    final out = <_Result>[];
    for (final a in b?.attractions ?? []) {
      out.add(_Result('a-${a.id}', Kind.show, a.name, (a.tagline ?? '').isNotEmpty ? a.tagline! : a.category.replaceAll('_', ' ').toLowerCase(), a.heroImage, '/attraction/${a.slug}', '${a.name} ${a.tagline ?? ''} ${a.category} ${a.synopsis}',
          focus: a.poiId == null ? null : a.id, poiId: a.poiId, saved: favs.contains(a.id), line: runLine(sessionsBy[a.id] ?? const [], now)));
    }
    for (final r in b?.restaurants ?? []) {
      out.add(_Result('r-${r.id}', Kind.food, r.name, (r.cuisine ?? '').isNotEmpty ? r.cuisine! : 'Restaurant', r.heroImage, '/restaurant/${r.slug}', '${r.name} ${r.cuisine ?? ''} ${r.description ?? ''} ${r.menuItems.map((m) => m.name).join(' ')}',
          focus: r.poiId == null ? null : r.id, poiId: r.poiId, saved: restFavs.contains(r.id)));
    }
    for (final s in b?.shops ?? []) {
      out.add(_Result('s-${s.id}', Kind.shop, s.name, (s.category ?? '').isNotEmpty ? s.category! : 'Shop', s.heroImage, '/shop/${s.slug}', '${s.name} ${s.category ?? ''} ${s.description ?? ''} ${s.items.map((i) => i.name).join(' ')}', focus: s.poiId, poiId: s.poiId));
    }
    for (final p in b?.pois ?? []) {
      final label = _facilityLabel[p.type];
      if (label == null) continue;
      out.add(_Result('p-${p.id}', Kind.facility, p.name, label, p.image ?? p.heroImage, '/facility/${p.id}', '${p.name} $label ${p.description ?? ''} ${p.mapZone ?? ''}', focus: p.id, poiId: p.id));
    }
    return out;
  }

  /// The text with whatever the guest typed picked out in the link colour.
  Widget _marked(String text, List<String> words, TextStyle style, Color hit, {int maxLines = 1}) {
    final spans = matchSpans(text, words);
    if (spans.isEmpty) return Text(text, maxLines: maxLines, overflow: TextOverflow.ellipsis, style: style);
    final parts = <TextSpan>[];
    var at = 0;
    for (final s in spans) {
      if (s.$1 > at) parts.add(TextSpan(text: text.substring(at, s.$1)));
      parts.add(TextSpan(text: text.substring(s.$1, s.$2), style: TextStyle(color: hit, fontWeight: FontWeight.w800)));
      at = s.$2;
    }
    if (at < text.length) parts.add(TextSpan(text: text.substring(at)));
    return Text.rich(TextSpan(children: parts, style: style), maxLines: maxLines, overflow: TextOverflow.ellipsis);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final sync = context.watch<SyncState>();
    final favIds = context.watch<FavoritesState>().ids;
    final restFavIds = context.watch<RestaurantFavs>().ids;
    final gps = context.watch<LocationState>().gps;
    final linked = _filters.any((f) => f.$1 == widget.linkedFilter) ? widget.linkedFilter! : 'all';
    final filter = _chosen ?? linked;
    final all = _all(sync, favIds, restFavIds);
    final q = _query.trim().toLowerCase();
    final browsing = q.isEmpty && filter == 'all';
    final words = searchWords(q);

    // How far each place is, for a guest who is in the park.
    final pois = {for (final p in sync.bundle?.pois ?? <Poi>[]) p.id: p};
    Geo? centre;
    if (pois.isNotEmpty) centre = Geo(pois.values.fold(0.0, (s, p) => s + p.lat) / pois.length, pois.values.fold(0.0, (s, p) => s + p.lng) / pois.length);
    final inPark = gps != null && centre != null && distMeters(gps, centre) <= halfMileM;
    double? distOf(_Result r) {
      final p = r.poiId == null ? null : pois[r.poiId];
      return inPark && p != null ? distMeters(gps, Geo(p.lat, p.lng)) : null;
    }

    // Best match first; or, when asked, nearest first.
    final scored = <({_Result r, int score, double? dist})>[];
    if (!browsing) {
      for (final r in all) {
        final inFilter = filter == 'all' || (filter == 'saved' ? r.saved : r.kind.name == filter);
        if (!inFilter) continue;
        final score = words.isEmpty ? 1 : matchScore(title: r.title, subtitle: r.subtitle, haystack: r.haystack, words: words);
        if (score > 0) scored.add((r: r, score: score, dist: distOf(r)));
      }
      scored.sort((a, b) {
        if (_nearest && inPark) {
          if (a.dist != null && b.dist != null) return a.dist!.compareTo(b.dist!);
          if (a.dist != null) return -1;
          if (b.dist != null) return 1;
        }
        final bySc = b.score.compareTo(a.score);
        return bySc != 0 ? bySc : a.r.title.compareTo(b.r.title);
      });
    }
    final results = [for (final s in scored) s.r];
    final dists = {for (final s in scored) s.r.key: s.dist};

    final pages = (words.isEmpty || (filter != 'all' && filter != 'saved')) ? <_Page>[] : _pages.where((p) => words.every((w) => p.keywords.any((k) => k.startsWith(w)))).take(3).toList();
    final suggestion = q.isNotEmpty && results.isEmpty && pages.isEmpty ? didYouMean(words, vocabularyOf([for (final r in all) '${r.title} ${r.subtitle}'])) : null;

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
            if (inPark) KChip('Nearest first', active: _nearest, onTap: () => setState(() => _nearest = !_nearest)),
          ]),
        ),
        if (browsing && _recent.isNotEmpty) ...[
          Padding(padding: const EdgeInsets.only(top: 4, bottom: 12), child: SectionHeader('Recent searches', action: 'Clear', onAction: _clearRecent)),
          Padding(
            padding: const EdgeInsets.only(left: 20, right: 20, bottom: 10),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (final r in _recent) KChip(r, onTap: () => _setQuery(r)),
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
        ] else ...[
          if (pages.isNotEmpty) ...[
            const Padding(padding: EdgeInsets.only(top: 4, bottom: 10), child: SectionHeader('Go to')),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(children: [
                for (final p in pages)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: KCard(
                      onTap: () {
                        _remember(_query);
                        p.tab ? context.go(p.to) : context.push(p.to);
                      },
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        Container(width: 40, height: 40, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(p.icon, color: c.link, size: 20)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            _marked(p.label, words, TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.text), c.link),
                            Padding(padding: const EdgeInsets.only(top: 1), child: Text(p.hint, style: TextStyle(fontSize: 12.5, color: c.sub))),
                          ]),
                        ),
                        Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
                      ]),
                    ),
                  ),
              ]),
            ),
          ],
          if (results.isEmpty && pages.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(40, 56, 40, 0),
              child: Column(children: [
                Icon(Icons.search_rounded, color: c.placeholder, size: 34),
                const SizedBox(height: 10),
                Text(
                  q.isNotEmpty
                      ? 'Nothing found for “${_query.trim()}”'
                      : filter == 'saved'
                          ? 'Nothing saved yet'
                          : 'Nothing here yet',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.text),
                ),
                const SizedBox(height: 2),
                Text(filter == 'saved' && q.isEmpty ? 'Tap ♡ on a show or restaurant to keep it here.' : 'Try a different word, or another filter.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: c.sub)),
                if (suggestion != null) ...[
                  const SizedBox(height: 14),
                  KChip('Did you mean “$suggestion”?', active: true, onTap: () => _setQuery(suggestion)),
                ],
              ]),
            ),
          if (results.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Text(
                '${results.length} ${results.length == 1 ? 'result' : 'results'}${_nearest && inPark ? ', nearest first' : ''}',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.sub),
              ),
            ),
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
                          child: _row(context, g.items[i], words, dists[g.items[i].key]),
                        ),
                      ),
                  ]),
                ),
              ]),
            ),
        ],
      ],
    );
  }

  Widget _row(BuildContext context, _Result r, List<String> words, double? dist) {
    final c = context.ui;
    final live = r.line != null && (r.line!.live || r.line!.soon);
    final sub = dist == null ? r.subtitle : '${r.subtitle} · ${fmtDist(dist)}';
    return KCard(
      onTap: () {
        _remember(_query);
        context.push(r.to);
      },
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        Cover(image: r.image, color: _kindColor[r.kind]!, icon: _kindIcon[r.kind]!, height: 64, width: 64, radius: 16),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: _marked(r.title, words, TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.text), c.link)),
              if (r.saved) ...[const SizedBox(width: 6), Icon(Icons.favorite_rounded, size: 14, color: c.link)],
            ]),
            Padding(padding: const EdgeInsets.only(top: 2), child: _marked(sub, words, TextStyle(fontSize: 12.5, color: c.sub), c.link)),
            if (live)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(width: 7, height: 7, decoration: BoxDecoration(color: r.line!.live ? Tokens.danger : Tokens.warn, shape: BoxShape.circle)),
                  const SizedBox(width: 6),
                  Flexible(child: Text(r.line!.text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: r.line!.live ? Tokens.danger : c.text))),
                ]),
              ),
          ]),
        ),
        if (r.focus != null) ...[
          const SizedBox(width: 8),
          Tap(
            onTap: () => context.go('/map?focus=${r.focus}'),
            label: 'Show ${r.title} on the map',
            child: Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.place_outlined, color: c.link, size: 19)),
          ),
        ],
        Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
      ]),
    );
  }
}
