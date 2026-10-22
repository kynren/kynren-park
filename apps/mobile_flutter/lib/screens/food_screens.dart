import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../core/restaurant_favs.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/restaurant_card.dart';
import '../ui/reveal.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

const _slots = [
  (slot: 'lunch', label: 'Lunch', icon: Icons.restaurant_rounded),
  (slot: 'dinner', label: 'Dinner', icon: Icons.star_rounded),
  (slot: 'sweet', label: 'Sweet break', icon: Icons.favorite_rounded),
];

class _RestaurantList extends StatelessWidget {
  final List restaurants;
  final String emptyText;
  const _RestaurantList({required this.restaurants, required this.emptyText});

  @override
  Widget build(BuildContext context) {
    final favs = context.watch<RestaurantFavs>();
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: Column(children: [
        if (restaurants.isEmpty) Padding(padding: const EdgeInsets.only(top: 20), child: Text(emptyText, style: TextStyle(color: context.ui.sub))),
        for (var i = 0; i < restaurants.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Reveal(index: i, child: RestaurantCard(r: restaurants[i], faved: favs.ids.contains(restaurants[i].id), onFav: () => favs.toggle(restaurants[i].id))),
          ),
      ]),
    );
  }
}

/// The Restaurants tab.
class FoodScreen extends StatelessWidget {
  const FoodScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final restaurants = context.watch<SyncState>().bundle?.restaurants ?? [];
    final collect = restaurants.where((r) => r.clickCollect != false && r.menuItems.isNotEmpty).length;
    return KScreen(
      title: 'Restaurants',
      subtitle: 'Menus, opening hours and order ahead',
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
        const Padding(padding: EdgeInsets.only(top: 26), child: SectionHeader('Our restaurants')),
        _RestaurantList(restaurants: restaurants, emptyText: 'Loading restaurants…'),
      ],
    );
  }
}

const _slotTitle = {'lunch': 'Lunch', 'dinner': 'Dinner', 'sweet': 'Sweet break', 'collect': 'Click & Collect'};

/// The list of restaurants reached from a meal shortcut or Click & Collect.
class RestaurantsScreen extends StatelessWidget {
  final String? slot;
  const RestaurantsScreen({super.key, this.slot});

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncState>();
    final all = sync.bundle?.restaurants ?? [];
    // Click & Collect lists only the places that can really take an order.
    final restaurants = slot == 'collect' ? all.where((r) => r.clickCollect != false && r.menuItems.isNotEmpty).toList() : all;
    final slotName = _slotTitle[slot];
    final heading = (slot == 'lunch' || slot == 'dinner')
        ? '$slotName of ${DateFormat('d MMMM').format(DateTime.parse('${sync.date}T00:00:00.000Z'))}'
        : slotName ?? 'Our restaurants';
    return KScreen(
      title: heading,
      page: 'restaurants',
      padded: false,
      colors: featureGradient['restaurants'],
      children: [_RestaurantList(restaurants: restaurants, emptyText: all.isEmpty ? 'Loading restaurants…' : 'Nothing to show here yet.')],
    );
  }
}
