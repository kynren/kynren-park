import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../core/eat_logic.dart' show poundsShort;
import '../core/location.dart';
import '../core/models.dart';
import '../core/saved_dishes.dart';
import '../core/shop_logic.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/filter_chips.dart';
import '../ui/minute_tick.dart';
import '../ui/reveal.dart';
import '../ui/screen.dart';
import '../ui/shop_widgets.dart';
import '../ui/skeleton.dart';
import 'map/map_logic.dart' show walkMinsToPoi;

/// What a guest can spend, in pence, for the "Under £5" kind of filter.
const _budgets = {'Under £5': 500, 'Under £10': 1000, 'Under £20': 2000};

/// The Shops screen: every shop with whether it is open and how far it is, a way to find a gift across them all by name or by
/// what it costs, and the products a guest has saved.
class ShopsScreen extends StatefulWidget {
  const ShopsScreen({super.key});
  @override
  State<ShopsScreen> createState() => _ShopsScreenState();
}

class _ShopsScreenState extends State<ShopsScreen> with MinuteTick {
  final _search = TextEditingController();
  String _filter = 'All';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Widget _padded(Widget child, {double top = 14}) => Padding(padding: EdgeInsets.fromLTRB(20, top, 20, 0), child: child);

  Widget _hits(BuildContext context, List<ProductHit> hits, Set<String> saved) {
    final toggle = context.read<SavedDishes>().toggle;
    return _padded(DividedCard(rows: [
      for (final h in hits)
        ProductRow(product: h.product, shopName: h.shop.name, saved: saved.contains(h.product.id), onSave: () => toggle(h.product.id), onTap: () => context.push('/shop/${h.shop.slug}')),
    ]));
  }

  Widget _note(BuildContext context, String text) => Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 0), child: Text(text, textAlign: TextAlign.center, style: TextStyle(color: context.ui.sub)));

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final shops = bundle?.shops ?? <Shop>[];
    final saved = context.watch<SavedDishes>().ids;
    final gps = context.watch<LocationState>().gps;
    final pois = bundle?.pois ?? const <Poi>[];
    final nowMin = nowMinute();
    final query = _search.text.trim();

    int? walk(Shop s) => walkMinsToPoi(gps, s.poiId, pois);
    final anyHours = shops.any((s) => shopState(s, nowMin) != null);
    final canSort = shops.any((s) => walk(s) != null);
    final everything = allProducts(shops);
    final savedHits = [for (final h in everything) if (saved.contains(h.product.id)) h];
    final budgets = [for (final b in _budgets.entries) if (productsUnder(shops, b.value).isNotEmpty) b.key];
    final labels = ['All', if (anyHours) 'Open now', if (canSort) 'Nearest', ...budgets, if (savedHits.isNotEmpty) 'Saved'];
    if (!labels.contains(_filter)) _filter = 'All'; // a chip that has gone (the last saved product removed) is not left chosen

    final openCount = shops.where((s) => shopState(s, nowMin)?.isOpen ?? false).length;

    Widget cards(List<Shop> list, String empty) {
      if (list.isEmpty && bundle == null) return _padded(const Column(children: [SkeletonCard(imageHeight: 132), SizedBox(height: 20), SkeletonCard(imageHeight: 132)]));
      if (list.isEmpty) return _note(context, empty);
      return _padded(Column(children: [
        for (var i = 0; i < list.length; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Reveal(index: i, child: ShopCard(shop: list[i], state: shopState(list[i], nowMin), walk: walk(list[i]))),
          ),
      ]));
    }

    final List<Widget> body;
    if (query.isNotEmpty) {
      final foundShops = findShops(shops, query);
      final foundProducts = findProducts(shops, query);
      body = [
        if (foundShops.isNotEmpty) ...[
          const Padding(padding: EdgeInsets.only(top: 18), child: SectionHeader('Shops')),
          cards(foundShops, ''),
        ],
        if (foundProducts.isNotEmpty) ...[
          Padding(padding: const EdgeInsets.only(top: 6), child: SectionHeader(foundProducts.length == 1 ? '1 product' : '${foundProducts.length} products')),
          _hits(context, foundProducts, saved),
        ],
        if (foundShops.isEmpty && foundProducts.isEmpty) _note(context, 'Nothing matches “$query”. Try a shorter word, like “mug” or “cap”.'),
      ];
    } else if (_budgets.containsKey(_filter)) {
      final hits = productsUnder(shops, _budgets[_filter]!);
      body = [
        Padding(padding: const EdgeInsets.only(top: 18), child: SectionHeader('$_filter · ${hits.length} gift${hits.length == 1 ? '' : 's'}')),
        _hits(context, hits, saved),
      ];
    } else if (_filter == 'Saved') {
      body = [
        const Padding(padding: EdgeInsets.only(top: 18), child: SectionHeader('Your saved products')),
        _padded(KCard(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${savedHits.length} product${savedHits.length == 1 ? '' : 's'}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text)),
                const SizedBox(height: 2),
                Text('From ${poundsShort(savedFrom(savedHits))} in all', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.sub)),
              ]),
            ),
            KButton('Share list', small: true, icon: Icons.ios_share_rounded, onPressed: () => SharePlus.instance.share(ShareParams(text: savedListText(savedHits), title: 'My shopping list'))),
          ]),
        )),
        _hits(context, savedHits, saved),
      ];
    } else {
      final shown = shops.where((s) => _filter != 'Open now' || (shopState(s, nowMin)?.isOpen ?? false)).toList();
      if (_filter == 'Nearest') shown.sort((a, b) => (walk(a) ?? 1 << 30).compareTo(walk(b) ?? 1 << 30));
      body = [
        const Padding(padding: EdgeInsets.only(top: 18), child: SectionHeader('Our shops')),
        cards(shown, _filter == 'Open now' ? 'No shop is open right now. Check back when the park opens.' : 'Nothing to show here yet.'),
      ];
    }

    return KScreen(
      title: 'Shops',
      subtitle: anyHours ? 'Gifts, souvenirs and what is open now' : 'Gifts, souvenirs and prices',
      page: 'shops',
      padded: false,
      colors: featureGradient['shops'],
      below: SearchPill(placeholder: 'Find a gift, like a mug or a cap', controller: _search, onChanged: (_) => setState(() {})),
      children: [
        if (query.isEmpty && anyHours)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Row(children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: openCount > 0 ? Tokens.ok : c.sub, shape: BoxShape.circle)),
              const SizedBox(width: 8),
              Text(openCount == 0 ? 'No shop is open right now' : openCount == 1 ? '1 shop is open now' : '$openCount shops are open now', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: c.text)),
            ]),
          ),
        if (query.isEmpty && shops.isNotEmpty) ...[
          const SizedBox(height: 16),
          FilterChips(labels: labels, chosen: _filter, onPick: (l) => setState(() => _filter = l)),
        ],
        ...body,
        const SizedBox(height: 8),
      ],
    );
  }
}
