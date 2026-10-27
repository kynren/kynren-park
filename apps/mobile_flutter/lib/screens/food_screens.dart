import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../core/eat_logic.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/restaurant_favs.dart';
import '../core/saved_dishes.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/restaurant_card.dart';
import '../ui/reveal.dart';
import '../ui/skeleton.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';
import 'map/map_logic.dart' show walkMinsToPoi;

const _slots = [
  (slot: 'lunch', label: 'Lunch', icon: Icons.restaurant_rounded),
  (slot: 'dinner', label: 'Dinner', icon: Icons.star_rounded),
  (slot: 'sweet', label: 'Sweet break', icon: Icons.favorite_rounded),
];

int _nowMinute() {
  final n = ukNow();
  return n.hour * 60 + n.minute;
}

/// Re-reads the clock once a minute so "Open now" and "Closing soon" stay true while the screen is open.
mixin _MinuteTick<T extends StatefulWidget> on State<T> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

class _RestaurantList extends StatelessWidget {
  final List<Restaurant> restaurants;
  final String emptyText;

  /// The park data has not arrived yet, so an empty list means "still loading", not "nothing here".
  final bool loading;
  const _RestaurantList({required this.restaurants, required this.emptyText, this.loading = false});

  @override
  Widget build(BuildContext context) {
    final favs = context.watch<RestaurantFavs>();
    final gps = context.watch<LocationState>().gps;
    final pois = context.watch<SyncState>().bundle?.pois ?? const <Poi>[];
    final nowMin = _nowMinute();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: Column(children: [
        if (restaurants.isEmpty && loading) const Column(children: [SkeletonCard(imageHeight: 176), SizedBox(height: 20), SkeletonCard(imageHeight: 176)])
        else if (restaurants.isEmpty) Padding(padding: const EdgeInsets.only(top: 20), child: Text(emptyText, textAlign: TextAlign.center, style: TextStyle(color: context.ui.sub))),
        for (var i = 0; i < restaurants.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Reveal(
              index: i,
              child: RestaurantCard(
                r: restaurants[i],
                faved: favs.ids.contains(restaurants[i].id),
                onFav: () => favs.toggle(restaurants[i].id),
                state: restaurantState(restaurants[i], nowMin),
                walk: walkMinsToPoi(gps, restaurants[i].poiId, pois),
              ),
            ),
          ),
      ]),
    );
  }
}

/// A row of filter chips: the chosen one is filled.
class _FilterChips extends StatelessWidget {
  final List<String> labels;
  final String chosen;
  final void Function(String) onPick;
  const _FilterChips({required this.labels, required this.chosen, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          for (final l in labels)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Tap(
                onTap: () => onPick(l),
                label: l,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: chosen == l ? c.primary : c.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: chosen == l ? c.primary : c.line)),
                  child: Text(l, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: chosen == l ? Colors.white : c.text)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The dishes a guest saved, each a tap away from its restaurant.
class _SavedDishes extends StatelessWidget {
  final List<({Restaurant r, MenuItem m})> dishes;
  const _SavedDishes({required this.dishes});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final saved = context.read<SavedDishes>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
      child: KCard(
        padding: const EdgeInsets.fromLTRB(16, 14, 8, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.favorite_rounded, color: Tokens.danger, size: 18),
            const SizedBox(width: 8),
            Text('Your saved dishes', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text)),
          ]),
          const SizedBox(height: 4),
          for (final d in dishes)
            Tap(
              onTap: () => context.push('/restaurant/${d.r.slug}'),
              label: '${d.m.name} at ${d.r.name}',
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(d.m.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.text)),
                      Text('${d.r.name}${d.m.priceCents > 0 ? ' · ${poundsFromCents(d.m.priceCents)}' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: c.sub)),
                    ]),
                  ),
                  Tap(
                    onTap: () => saved.toggle(d.m.id),
                    label: 'Remove ${d.m.name} from saved dishes',
                    child: Padding(padding: const EdgeInsets.all(10), child: Icon(Icons.close_rounded, size: 18, color: c.sub)),
                  ),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}

/// The Restaurants tab.
class FoodScreen extends StatefulWidget {
  const FoodScreen({super.key});
  @override
  State<FoodScreen> createState() => _FoodScreenState();
}

class _FoodScreenState extends State<FoodScreen> with _MinuteTick {
  String _filter = 'All';

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final all = bundle?.restaurants ?? <Restaurant>[];
    final favs = context.watch<RestaurantFavs>().ids;
    final savedIds = context.watch<SavedDishes>().ids;
    final gps = context.watch<LocationState>().gps;
    final pois = bundle?.pois ?? const <Poi>[];
    final nowMin = _nowMinute();

    int? walk(Restaurant r) => walkMinsToPoi(gps, r.poiId, pois);
    final diets = dietsOnMenu([for (final r in all) ...r.menuItems]);
    final canSort = all.any((r) => walk(r) != null);
    final labels = ['All', 'Open now', if (canSort) 'Nearest', if (favs.isNotEmpty) 'Favourites', ...diets];
    if (!labels.contains(_filter)) _filter = 'All'; // a chip that has gone (the last favourite removed) is not left chosen

    var shown = all.where((r) {
      return switch (_filter) {
        'All' || 'Nearest' => true,
        'Open now' => restaurantState(r, nowMin)?.isOpen ?? false,
        'Favourites' => favs.contains(r.id),
        _ => restaurantHasDiet(r, _filter),
      };
    }).toList();
    if (_filter == 'Nearest') shown.sort((a, b) => (walk(a) ?? 1 << 30).compareTo(walk(b) ?? 1 << 30));

    final openCount = all.where((r) => restaurantState(r, nowMin)?.isOpen ?? false).length;
    final saved = [
      for (final r in all)
        for (final m in r.menuItems)
          if (savedIds.contains(m.id)) (r: r, m: m),
    ];
    final collect = onlineOrderingOpen ? all.where((r) => r.clickCollect != false && r.menuItems.isNotEmpty).length : 0;
    return KScreen(
      title: 'Restaurants',
      subtitle: onlineOrderingOpen ? 'Menus, opening hours and order ahead' : 'Menus, opening hours and dietary choices',
      page: 'restaurants',
      back: false,
      padded: false,
      colors: featureGradient['restaurants'],
      below: SearchPill(placeholder: 'Find a restaurant or a dish', onTap: () => context.go('/search?filter=food')),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Row(children: [
            for (var i = 0; i < _slots.length; i++) ...[
              if (i > 0) const SizedBox(width: 12),
              Expanded(
                child: Tap(
                  onTap: () => context.push('/restaurants?slot=${_slots[i].slot}'),
                  label: _slots[i].label,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(18)),
                    child: Column(children: [
                      Container(width: 44, height: 44, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(_slots[i].icon, color: c.link, size: 22)),
                      const SizedBox(height: 8),
                      Text(_slots[i].label, maxLines: 1, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.text)),
                    ]),
                  ),
                ),
              ),
            ],
          ]),
        ),
        if (all.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
            child: Row(children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: openCount > 0 ? Tokens.ok : c.sub, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(
                openCount == 0 ? 'Nothing is open right now' : openCount == 1 ? '1 place is open now' : '$openCount places are open now',
                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: c.text),
              ),
            ]),
          ),
        if (collect > 0)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: KCard(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Click & Collect', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.text)),
                const SizedBox(height: 4),
                Text('Order online, pick up on-site. Available only on the day of your visit.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
                const SizedBox(height: 12),
                KButton('Order food', small: true, onPressed: () => context.push('/restaurants?slot=collect')),
              ]),
            ),
          ),
        if (saved.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 16), child: _SavedDishes(dishes: saved)),
        if (all.isNotEmpty) ...[
          const SizedBox(height: 16),
          _FilterChips(labels: labels, chosen: _filter, onPick: (l) => setState(() => _filter = l)),
        ],
        const Padding(padding: EdgeInsets.only(top: 18), child: SectionHeader('Our restaurants')),
        _RestaurantList(
          restaurants: shown,
          emptyText: switch (_filter) {
            'Open now' => 'Nothing is open right now. Check the opening times below.',
            'All' || 'Nearest' => 'Nothing to show here yet.',
            _ => 'No restaurants match this filter.',
          },
          loading: bundle == null,
        ),
      ],
    );
  }
}

const _slotTitle = {'lunch': 'Lunch', 'dinner': 'Dinner', 'sweet': 'Sweet break', 'collect': 'Click & Collect'};

/// The list of restaurants reached from a meal shortcut: those open at the time of day the meal stands for (lunch around
/// half past twelve, dinner at five), or the ones with something sweet on the menu.
class RestaurantsScreen extends StatefulWidget {
  final String? slot;
  const RestaurantsScreen({super.key, this.slot});
  @override
  State<RestaurantsScreen> createState() => _RestaurantsScreenState();
}

class _RestaurantsScreenState extends State<RestaurantsScreen> with _MinuteTick {
  @override
  Widget build(BuildContext context) {
    final slot = widget.slot;
    final sync = context.watch<SyncState>();
    final all = sync.bundle?.restaurants ?? <Restaurant>[];
    final restaurants = switch (slot) {
      'collect' => onlineOrderingOpen ? all.where((r) => r.clickCollect != false && r.menuItems.isNotEmpty).toList() : all,
      'lunch' || 'dinner' => all.where((r) => openAtMinute(r, mealMinute[slot]!)).toList(),
      'sweet' => all.where(restaurantHasSweet).toList(),
      _ => all,
    };
    final slotName = _slotTitle[slot];
    final heading = (slot == 'lunch' || slot == 'dinner')
        ? '$slotName of ${DateFormat('d MMMM').format(DateTime.parse('${sync.date}T00:00:00.000Z'))}'
        : slotName ?? 'Our restaurants';
    final empty = switch (slot) {
      'lunch' => 'Nothing is open for lunch today.',
      'dinner' => 'Nothing is open for dinner today.',
      'sweet' => 'No sweet treats on the menus yet.',
      _ => 'Nothing to show here yet.',
    };
    return KScreen(
      title: heading,
      page: 'restaurants',
      padded: false,
      colors: featureGradient['restaurants'],
      children: [_RestaurantList(restaurants: restaurants, emptyText: empty, loading: sync.bundle == null)],
    );
  }
}
