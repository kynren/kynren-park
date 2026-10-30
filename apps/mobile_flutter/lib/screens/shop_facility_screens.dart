import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../core/eat_logic.dart';
import '../core/essentials.dart';
import '../core/location.dart';
import '../core/models.dart';
import '../core/saved_dishes.dart';
import '../core/shop_logic.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/detail_kit.dart';
import '../ui/minute_tick.dart';
import '../ui/shop_widgets.dart';
import '../ui/tap.dart';
import 'map/map_logic.dart' show walkMinsToPoi;

/// "Today 10:30 – 18:00" when the hours can be read, else the text as it was typed.
String _hoursLine(String hours) {
  final h = parseHours(hours);
  return h == null ? hours : 'Today ${hoursText(h)}';
}

Widget _hours(BuildContext context, String? hours) {
  final c = context.ui;
  if (hours == null || hours.isEmpty) return const SizedBox.shrink();
  return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    const SectionLabel('Schedules'),
    Container(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 16),
      decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
      child: Text(_hoursLine(hours), style: TextStyle(color: c.link, fontWeight: FontWeight.w700, fontSize: 13.5)),
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

const _orderLabels = {ProductOrder.listed: 'Shop order', ProductOrder.cheapest: 'Cheapest', ProductOrder.dearest: 'Dearest'};
const _savedLabel = 'Saved';

/// Past this many products the page offers a search box: a short list needs none.
const _searchFrom = 8;

class _ShopScreenState extends State<ShopScreen> with MinuteTick {
  final _search = TextEditingController();
  ProductOrder _order = ProductOrder.listed;
  bool _onlySaved = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Widget _stat(BuildContext context, String value, String label) {
    final c = context.ui;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(16), boxShadow: softShadow(context.isDark)),
        child: Column(children: [
          Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 17, fontWeight: FontWeight.w800, color: c.text)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.sub)),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final shop = bundle?.shops.where((s) => s.slug == widget.slug).firstOrNull;
    if (shop == null) return NotFound('Shop not found.', loading: bundle == null);
    final saved = context.watch<SavedDishes>().ids;
    final gps = context.watch<LocationState>().gps;
    final images = shop.images.isNotEmpty ? shop.images : (shop.heroImage != null ? [shop.heroImage!] : <String>[]);

    final all = productsOf(shop);
    final priced = all.where((p) => p.from != null).toList();
    final notes = all.where((p) => p.from == null).toList();
    final savedHere = priced.where((p) => saved.contains(p.id)).length;
    if (_onlySaved && savedHere == 0) _onlySaved = false; // the last saved product was removed: the filter goes with it
    final words = _search.text.trim().toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    final shown = orderProducts([
      for (final p in priced)
        if ((!_onlySaved || saved.contains(p.id)) && words.every('${p.name} ${p.description ?? ''}'.toLowerCase().contains)) p,
    ], _order);

    final walk = walkMinsToPoi(gps, shop.poiId, bundle?.pois ?? const <Poi>[]);
    final range = shopPriceRange(shop);
    final state = shopState(shop, nowMinute());
    final toggle = context.read<SavedDishes>().toggle;
    final others = (bundle?.shops ?? const <Shop>[]).where((s) => s.slug != shop.slug).toList();
    final chipLabels = [..._orderLabels.values, if (savedHere > 0) _savedLabel];
    final chosen = _onlySaved ? _savedLabel : _orderLabels[_order]!;

    return DetailPage(
      images: images,
      colors: featureGradient['shops']!,
      title: shop.name,
      children: [
        SheetTitle(shop.name),
        _desc(context, shop.description),
        if ((shop.category ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 14), child: Wrap(children: [TagChip(icon: '🛍️', label: shop.category!)])),
        if (state != null || walk != null) Padding(padding: const EdgeInsets.only(top: 12), child: OpenStatus(state: state, walk: walk)),
        if (priced.isNotEmpty || range != null || walk != null)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(children: [
              if (priced.isNotEmpty) _stat(context, '${priced.length}', priced.length == 1 ? 'product' : 'products'),
              if (range != null) ...[if (priced.isNotEmpty) const SizedBox(width: 10), _stat(context, range, 'prices')],
              if (walk != null) ...[const SizedBox(width: 10), _stat(context, '$walk min', 'walk')],
            ]),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Row(children: [
            ActionPill(icon: Icons.map_outlined, label: 'Go to', onTap: () => context.go('/map?focus=${shop.poiId ?? shop.id}')),
            if (priced.isNotEmpty) ...[
              const SizedBox(width: 10),
              ActionPill(icon: Icons.ios_share_rounded, label: 'Share prices', onTap: () => SharePlus.instance.share(ShareParams(text: shopText(shop), title: shop.name))),
            ],
          ]),
        ),
        _hours(context, shop.openingHours),
        const SectionLabel('What’s in store'),
        if (priced.isEmpty && notes.isEmpty)
          const Muted('Product list coming soon.')
        else ...[
          if (priced.length >= _searchFrom) Padding(padding: const EdgeInsets.only(bottom: 12), child: SearchPill(placeholder: 'Search ${shop.name}', controller: _search, onChanged: (_) => setState(() {}))),
          if (priced.length > 2)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _Sorts(
                labels: chipLabels,
                chosen: chosen,
                onPick: (l) => setState(() {
                  _onlySaved = l == _savedLabel;
                  if (!_onlySaved) _order = _orderLabels.entries.firstWhere((e) => e.value == l).key;
                }),
              ),
            ),
          if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Muted(_onlySaved ? 'You have not saved anything here yet.' : words.isNotEmpty ? 'Nothing here matches “${_search.text.trim()}”.' : 'No products listed yet.'),
            )
          else
            DividedCard(rows: [
              for (final p in shown) ProductRow(product: p, saved: saved.contains(p.id), onSave: () => toggle(p.id)),
            ]),
          if (notes.isNotEmpty && !_onlySaved && words.isEmpty) ...[
            const SectionLabel('Also in store'),
            for (final n in notes)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: KCard(
                  padding: const EdgeInsets.all(16),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(width: 36, height: 36, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.card_giftcard_rounded, size: 19, color: c.link)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(n.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.text)),
                        if ((n.description ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(n.description!, style: TextStyle(fontSize: 13, height: 18 / 13, color: c.sub))),
                      ]),
                    ),
                  ]),
                ),
              ),
          ],
        ],
        if (others.isNotEmpty) ...[
          const SectionLabel('More shops'),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final o in others)
              Tap(
                onTap: () => context.push('/shop/${o.slug}'),
                label: o.name,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: c.line)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.storefront_rounded, size: 16, color: c.link),
                    const SizedBox(width: 6),
                    Text(o.name, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: c.text)),
                  ]),
                ),
              ),
          ]),
        ],
      ],
    );
  }
}

/// The ways to order a shop's products, as a row of chips that wraps rather than scrolls: there are only a few.
class _Sorts extends StatelessWidget {
  final List<String> labels;
  final String chosen;
  final void Function(String) onPick;
  const _Sorts({required this.labels, required this.chosen, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Wrap(spacing: 8, runSpacing: 8, children: [
      for (final l in labels)
        Tap(
          onTap: () => onPick(l),
          label: l,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(color: chosen == l ? c.primary : c.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: chosen == l ? c.primary : c.line)),
            child: Text(l, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: chosen == l ? Colors.white : c.text)),
          ),
        ),
    ]);
  }
}

class FacilityScreen extends StatelessWidget {
  final String id;
  const FacilityScreen({super.key, required this.id});

  @override
  Widget build(BuildContext context) {
    final bundle = context.watch<SyncState>().bundle;
    final poi = bundle?.pois.where((p) => p.id == id).firstOrNull;
    if (poi == null) return NotFound('Place not found.', loading: bundle == null);
    final images = poi.images.isNotEmpty ? poi.images : (poi.heroImage != null ? [poi.heroImage!] : <String>[]);
    final label = facilityLabel(poi.type);
    final emoji = (poi.icon ?? '').isNotEmpty ? poi.icon! : facilityEmoji(poi.type);
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
