import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/cover.dart';
import '../ui/detail_kit.dart';

Widget _hours(BuildContext context, String? hours) {
  final c = context.ui;
  if (hours == null || hours.isEmpty) return const SizedBox.shrink();
  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const SectionLabel('Schedules'),
    Container(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 16),
      decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
      child: Text('From $hours', style: TextStyle(color: c.link, fontWeight: FontWeight.w700, fontSize: 13.5)),
    ),
  ]);
}

Widget _desc(BuildContext context, String? text) => (text == null || text.isEmpty)
    ? const SizedBox.shrink()
    : Padding(padding: const EdgeInsets.only(top: 16), child: Text(text, style: TextStyle(color: context.ui.sub, fontSize: 14.5, height: 21 / 14.5)));

class ShopScreen extends StatefulWidget {
  final String slug;
  const ShopScreen({super.key, required this.slug});
  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  // A GlobalKey must live as long as the screen: made inside build it would be a new key on every rebuild.
  final _productsKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final slug = widget.slug;
    final productsKey = _productsKey;
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final shop = bundle?.shops.where((s) => s.slug == slug).firstOrNull;
    if (shop == null) return NotFound('Shop not found.', loading: bundle == null);
    final images = shop.images.isNotEmpty ? shop.images : (shop.heroImage != null ? [shop.heroImage!] : <String>[]);
    return DetailPage(
      images: images,
      colors: const [Tokens.bandFrom, Tokens.bandTo],
      title: shop.name,
      children: [
        SheetTitle(shop.name),
        _desc(context, shop.description),
        if ((shop.category ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 14), child: Wrap(children: [TagChip(icon: '🛍️', label: shop.category!)])),
        Padding(
          padding: const EdgeInsets.only(top: 18),
          child: Row(children: [
            ActionPill(icon: Icons.map_outlined, label: 'Go to', onTap: () => context.go('/map?focus=${shop.poiId ?? shop.id}')),
            const SizedBox(width: 10),
            ActionPill(icon: Icons.shopping_bag_outlined, label: 'Products', onTap: () {
              final ctx = productsKey.currentContext;
              if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 350), curve: Curves.easeOut);
            }),
          ]),
        ),
        _hours(context, shop.openingHours),
        KeyedSubtree(key: productsKey, child: const SectionLabel('What’s in store')),
        if (shop.items.isEmpty)
          const Muted('Product list coming soon.')
        else
          for (final it in shop.items)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.line, width: 0.5))),
              child: Row(children: [
                Cover(image: it.image, color: const Color(0xFF4B5D73), icon: Icons.storefront_rounded, height: 68, width: 68, radius: 16),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(it.name, style: TextStyle(fontWeight: FontWeight.w700, color: c.text, fontSize: 16)),
                    if ((it.description ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Muted(it.description!)),
                  ]),
                ),
                const SizedBox(width: 14),
                Text(poundsFromCents(it.priceCents), style: TextStyle(fontFamily: Tokens.display, color: c.text, fontWeight: FontWeight.w700, fontSize: 15)),
              ]),
            ),
      ],
    );
  }
}

const _typeLabel = {
  'RESTROOM': 'Restrooms', 'FIRST_AID': 'First aid', 'SHOP': 'Shop', 'PARKING': 'Parking',
  'ACCESSIBILITY': 'Accessibility', 'BABY_CHANGING': 'Baby changing', 'PICNIC': 'Picnic area',
  'ENTRANCE': 'Entrance', 'INFO': 'Information', 'HELP': 'Help point',
};
const _typeEmoji = {
  'RESTROOM': '🚻', 'FIRST_AID': '➕', 'SHOP': '🛍️', 'PARKING': '🅿️', 'ACCESSIBILITY': '♿',
  'BABY_CHANGING': '🍼', 'PICNIC': '🧺', 'ENTRANCE': '🚪', 'INFO': 'ℹ️', 'HELP': '❓',
};

class FacilityScreen extends StatelessWidget {
  final String id;
  const FacilityScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context) {
    final bundle = context.watch<SyncState>().bundle;
    final poi = bundle?.pois.where((p) => p.id == id).firstOrNull;
    if (poi == null) return NotFound('Place not found.', loading: bundle == null);
    final images = poi.images.isNotEmpty ? poi.images : (poi.heroImage != null ? [poi.heroImage!] : <String>[]);
    final label = _typeLabel[poi.type] ?? poi.type.replaceAll('_', ' ');
    final emoji = (poi.icon ?? '').isNotEmpty ? poi.icon! : (_typeEmoji[poi.type] ?? '📍');
    return DetailPage(
      images: images,
      colors: const [Tokens.bandFrom, Tokens.bandTo],
      title: poi.name,
      children: [
        SheetTitle(poi.name),
        _desc(context, poi.description),
        Padding(padding: const EdgeInsets.only(top: 14), child: Wrap(children: [TagChip(icon: emoji, label: label)])),
        Padding(padding: const EdgeInsets.only(top: 18), child: Row(children: [ActionPill(icon: Icons.map_outlined, label: 'Go to', onTap: () => context.go('/map?focus=${poi.id}'))])),
        _hours(context, poi.openingHours),
      ],
    );
  }
}
