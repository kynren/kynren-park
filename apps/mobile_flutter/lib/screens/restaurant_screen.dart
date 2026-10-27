import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/eat_logic.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/restaurant_favs.dart';
import '../core/saved_dishes.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/detail_kit.dart';
import '../ui/tap.dart';
import 'map/map_logic.dart' show walkMinsToPoi;

// How far ahead a guest can choose to pick up their order. The API stores whatever pickupSlot it is
// given with no server-side check against opening hours (those are a freeform admin string), so these
// are sensible client-side choices, not a real availability check.
const _pickupOffsetsMin = [15, 30, 45, 60, 90];

class RestaurantScreen extends StatefulWidget {
  final String slug;
  const RestaurantScreen({super.key, required this.slug});
  @override
  State<RestaurantScreen> createState() => _RestaurantScreenState();
}

class _RestaurantScreenState extends State<RestaurantScreen> {
  final Map<String, int> _qty = {};
  int _pickupOffset = 30;
  bool _submitting = false;
  String _diet = ''; // the dietary filter on the menu; empty shows every dish
  bool _byPrice = false;
  final _menuKey = GlobalKey();

  Future<void> _shareMenu(Restaurant r) async {
    try {
      await SharePlus.instance.share(ShareParams(text: menuText(r)));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Couldn’t open sharing. Try again.')));
    }
  }

  void _bump(String id, int delta) => setState(() => _qty[id] = ((_qty[id] ?? 0) + delta).clamp(0, 999));

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    final bundle = context.watch<SyncState>().bundle;
    final restaurant = bundle?.restaurants.where((r) => r.slug == widget.slug).firstOrNull;
    if (restaurant == null) return NotFound('Outlet not found.', loading: bundle == null);

    final images = restaurant.images.isNotEmpty ? restaurant.images : (restaurant.heroImage != null ? [restaurant.heroImage!] : <String>[]);
    final canOrder = onlineOrderingOpen && restaurant.clickCollect != false && restaurant.menuItems.isNotEmpty;
    final favs = context.watch<RestaurantFavs>();
    final saved = context.watch<SavedDishes>();
    final gps = context.watch<LocationState>().gps;
    final walk = walkMinsToPoi(gps, restaurant.poiId, bundle!.pois);
    final hours = parseHours(restaurant.openingHours);
    final ukMin = ukNow();
    final state = hours == null ? null : openState(hours, ukMin.hour * 60 + ukMin.minute);
    final stateColor = switch (state?.kind) {
      OpenKind.open => Tokens.ok,
      OpenKind.closingSoon => Tokens.warn,
      OpenKind.closed => Tokens.danger,
      _ => c.sub,
    };
    final diets = dietsOnMenu(restaurant.menuItems);
    if (_diet.isNotEmpty && !diets.contains(_diet)) _diet = '';
    final items = [for (final m in restaurant.menuItems) if (_diet.isEmpty || itemHasDiet(m, _diet)) m];
    if (_byPrice) items.sort((a, b) => a.priceCents.compareTo(b.priceCents));
    final range = priceRange(restaurant.menuItems);
    final count = _qty.values.fold(0, (a, b) => a + b);
    final total = restaurant.menuItems.fold(0, (sum, m) => sum + (_qty[m.id] ?? 0) * m.priceCents);

    Future<void> placeOrder() async {
      if (user == null) {
        context.push('/auth');
        return;
      }
      final items = [for (final e in _qty.entries) if (e.value > 0) {'menuItemId': e.key, 'quantity': e.value}];
      if (items.isEmpty) return;
      setState(() => _submitting = true);
      final messenger = ScaffoldMessenger.of(context);
      try {
        final pickup = DateTime.now().toUtc().add(Duration(minutes: _pickupOffset));
        await api('/orders', method: 'POST', body: {'restaurantId': restaurant.id, 'pickupSlot': pickup.toIso8601String(), 'items': items});
        setState(_qty.clear);
        if (mounted) {
          messenger.showSnackBar(SnackBar(
            content: Text('Order placed. We\'ll have it ready to collect around ${fmtTimeUK(pickup)}.'),
            action: SnackBarAction(label: 'Track order', onPressed: () => context.push('/orders')),
          ));
        }
      } catch (_) {
        messenger.showSnackBar(const SnackBar(content: Text('Something went wrong. Please try again.')));
      }
      if (mounted) setState(() => _submitting = false);
    }

    Widget stepButton(String label, VoidCallback onTap, {bool on = false}) => Tap(
          onTap: onTap,
          label: label,
          child: Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: on ? c.primary : c.tint, shape: BoxShape.circle),
            child: Center(child: Text(label == 'Remove one' ? '−' : '+', style: TextStyle(color: on ? Colors.white : c.link, fontSize: 16, fontWeight: FontWeight.w700))),
          ),
        );

    return DetailPage(
      images: images,
      colors: featureGradient['restaurants']!,
      title: restaurant.name,
      bottomPadding: count > 0 ? 120 : 40,
      bottom: canOrder && count > 0
          ? Tap(
              onTap: _submitting ? null : placeOrder,
              label: user != null ? 'Order ahead' : 'Sign in to order',
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                decoration: BoxDecoration(
                  color: c.primary,
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: const [BoxShadow(color: Color(0x47000000), blurRadius: 14, offset: Offset(0, 6))],
                ),
                child: _submitting
                    ? const Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)))
                    : Row(children: [
                        Container(
                          constraints: const BoxConstraints(minWidth: 28),
                          height: 28,
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(14)),
                          child: Center(child: Text('$count', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14))),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Text(user != null ? 'Order ahead' : 'Sign in to order', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
                        Text(poundsFromCents(total), style: const TextStyle(fontFamily: Tokens.display, color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                      ]),
              ),
            )
          : null,
      children: [
        SheetTitle(restaurant.name),
        if ((restaurant.description ?? '').isNotEmpty)
          Padding(padding: const EdgeInsets.only(top: 16), child: Text(restaurant.description!, style: TextStyle(color: c.sub, fontSize: 14.5, height: 21 / 14.5))),
        if ((restaurant.cuisine ?? '').isNotEmpty || range != null)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              if ((restaurant.cuisine ?? '').isNotEmpty) TagChip(icon: '🍴', label: restaurant.cuisine!),
              if (range != null) TagChip(icon: '£', label: range),
            ]),
          ),
        if (state != null || walk != null)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Row(children: [
              if (state != null) ...[
                Container(width: 9, height: 9, decoration: BoxDecoration(color: stateColor, shape: BoxShape.circle)),
                const SizedBox(width: 7),
                Flexible(child: Text(state.text, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: stateColor))),
              ],
              if (walk != null) Text('${state != null ? ' · ' : ''}$walk min walk', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.sub)),
            ]),
          ),
        // ActionPill fills its share of a row, so the four actions sit two to a row
        Padding(
          padding: const EdgeInsets.only(top: 18),
          child: Row(children: [
            ActionPill(icon: Icons.map_outlined, label: 'Go to', onTap: () => context.go('/map?focus=${restaurant.id}')),
            const SizedBox(width: 10),
            ActionPill(icon: Icons.restaurant_menu_rounded, label: 'Menu', onTap: () {
              final ctx = _menuKey.currentContext;
              if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
            }),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(children: [
            ActionPill(
              icon: favs.ids.contains(restaurant.id) ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              label: favs.ids.contains(restaurant.id) ? 'Saved' : 'Save',
              onTap: () => favs.toggle(restaurant.id),
            ),
            const SizedBox(width: 10),
            if (restaurant.menuItems.isNotEmpty) ActionPill(icon: Icons.ios_share_rounded, label: 'Share menu', onTap: () => _shareMenu(restaurant)) else const Expanded(child: SizedBox()),
          ]),
        ),
        if ((restaurant.openingHours ?? '').isNotEmpty) ...[
          const SectionLabel('Schedules'),
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 16),
              decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
              // read from the text so the times always have a clean dash between them; text we cannot read is shown as typed
              child: Text(hours != null ? 'Today ${hoursText(hours)}' : 'From ${restaurant.openingHours}', style: TextStyle(color: c.link, fontWeight: FontWeight.w700, fontSize: 13.5)),
            ),
          ),
        ],
        KeyedSubtree(key: _menuKey, child: const SectionLabel('Menu')),
        if (restaurant.menuItems.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (final d in diets)
                Tap(
                  onTap: () => setState(() => _diet = _diet == d ? '' : d),
                  label: _diet == d ? 'Show every dish' : 'Only $d dishes',
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
                    decoration: BoxDecoration(color: _diet == d ? c.primary : c.soft, borderRadius: BorderRadius.circular(999)),
                    child: Text(d, style: TextStyle(color: _diet == d ? Colors.white : c.text, fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                ),
              if (restaurant.menuItems.length > 2)
                Tap(
                  onTap: () => setState(() => _byPrice = !_byPrice),
                  label: _byPrice ? 'Back to menu order' : 'Sort by price',
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
                    decoration: BoxDecoration(color: _byPrice ? c.primary : c.soft, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.swap_vert_rounded, size: 16, color: _byPrice ? Colors.white : c.text),
                      const SizedBox(width: 4),
                      Text('Price: low to high', style: TextStyle(color: _byPrice ? Colors.white : c.text, fontWeight: FontWeight.w700, fontSize: 13)),
                    ]),
                  ),
                ),
            ]),
          ),
        if (restaurant.menuItems.isEmpty)
          const Muted('Menu coming soon.')
        else
          for (var i = 0; i < items.length; i++)
            () {
              final m = items[i];
              final n = _qty[m.id] ?? 0;
              return Container(
                padding: const EdgeInsets.symmetric(vertical: 15),
                decoration: BoxDecoration(border: i == items.length - 1 ? null : Border(bottom: BorderSide(color: c.line, width: 0.5))),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(m.name, style: TextStyle(fontWeight: FontWeight.w700, color: c.text, fontSize: 16)),
                      if ((m.description ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 3), child: Text(m.description!, style: TextStyle(color: c.sub, fontSize: 13.5, height: 19 / 13.5))),
                      Padding(padding: const EdgeInsets.only(top: 6), child: Text(poundsFromCents(m.priceCents), style: TextStyle(fontFamily: Tokens.display, color: c.text, fontWeight: FontWeight.w700, fontSize: 16))),
                      if (m.dietaryTags.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Wrap(spacing: 8, runSpacing: 6, children: [
                            for (final t in dietsOf(m))
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: c.soft, borderRadius: BorderRadius.circular(999)),
                                child: Text(t, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Tokens.ok)),
                              ),
                          ]),
                        ),
                    ]),
                  ),
                  Tap(
                    onTap: () => saved.toggle(m.id),
                    label: saved.ids.contains(m.id) ? 'Remove ${m.name} from saved dishes' : 'Save ${m.name}',
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: Icon(saved.ids.contains(m.id) ? Icons.favorite_rounded : Icons.favorite_border_rounded, size: 21, color: saved.ids.contains(m.id) ? Tokens.danger : c.link),
                    ),
                  ),
                  if (canOrder) ...[
                    const SizedBox(width: 6),
                    if (n == 0)
                      Tap(
                        onTap: () => _bump(m.id, 1),
                        label: 'Add ${m.name}',
                        child: Container(width: 40, height: 40, decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle), child: const Center(child: Text('+', style: TextStyle(color: Colors.white, fontSize: 24)))),
                      )
                    else
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        stepButton('Remove one', () => _bump(m.id, -1)),
                        SizedBox(width: 38, child: Text('$n', textAlign: TextAlign.center, style: TextStyle(color: c.text, fontSize: 16, fontWeight: FontWeight.w800))),
                        stepButton('Add another', () => _bump(m.id, 1), on: true),
                      ]),
                  ],
                ]),
              );
            }(),
        if (restaurant.menuItems.isNotEmpty && items.isEmpty) Muted('No $_diet dishes on this menu.'),
        if (restaurant.menuItems.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Muted('Allergies or intolerances? Please tell a member of the team before you eat. The labels above are a guide.'),
          ),
        if (canOrder) ...[
          const SectionLabel('Order ahead'),
          const Muted('Pick a collection time — pay at the outlet, no card needed now.'),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              for (final min in _pickupOffsetsMin)
                Tap(
                  onTap: () => setState(() => _pickupOffset = min),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 14),
                    decoration: BoxDecoration(color: _pickupOffset == min ? c.primary : c.soft, borderRadius: BorderRadius.circular(999)),
                    child: Text(fmtTimeUK(DateTime.now().toUtc().add(Duration(minutes: min))), style: TextStyle(color: _pickupOffset == min ? Colors.white : c.text, fontWeight: FontWeight.w700, fontSize: 13)),
                  ),
                ),
            ]),
          ),
        ],
      ],
    );
  }
}
