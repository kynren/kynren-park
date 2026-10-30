import 'eat_logic.dart';
import 'models.dart';

/// One thing a shop sells. The data holds a row for each price, so a poncho for adults and one for children are two rows of
/// one product: they are brought together here, with each price labelled by what it is for.
class Product {
  final String name;
  final String? description;
  final List<ShopItem> options;
  const Product(this.name, this.description, this.options);

  /// The id a guest's saved product is remembered by: its first row's.
  String get id => options.first.id;

  /// The prices on offer, cheapest first. Empty for the "other gifts" line, which has none to show.
  List<int> get prices => [for (final o in options) if (o.priceCents > 0) o.priceCents]..sort();

  int? get from => prices.isEmpty ? null : prices.first;

  /// True when every row is out of stock.
  bool get soldOut => options.every((o) => !o.available);

  /// "£15", "Adult £5 · Child £4", or "£10 – £15" for prices nothing labels; null when there is no price.
  String? get priceText {
    final priced = options.where((o) => o.priceCents > 0).toList();
    if (priced.isEmpty) return null;
    if (priced.length == 1) return poundsShort(priced.first.priceCents);
    if (priced.every((o) => (o.variant ?? '').isNotEmpty)) return priced.map((o) => '${o.variant} ${poundsShort(o.priceCents)}').join(' · ');
    return priceRangeOfCents(priced.map((o) => o.priceCents)) ?? '';
  }
}

/// A shop's products in the order the shop lists them, one each however many prices it has. A product with no price (the
/// catch-all "other gifts" line) goes last, as a note on what else is in store.
List<Product> productsOf(Shop shop) {
  final order = <String>[];
  final rows = <String, List<ShopItem>>{};
  for (final item in shop.items) {
    final key = item.name.trim().toLowerCase();
    if (!rows.containsKey(key)) order.add(key);
    rows.putIfAbsent(key, () => []).add(item);
  }
  final products = [
    for (final key in order)
      Product(
        rows[key]!.first.name.trim(),
        rows[key]!.map((i) => i.description).firstWhere((d) => d != null && d.isNotEmpty, orElse: () => null),
        rows[key]!,
      ),
  ];
  return [...products.where((p) => p.from != null), ...products.where((p) => p.from == null)];
}

/// A product and the shop that sells it.
typedef ProductHit = ({Shop shop, Product product});

/// Every product across [shops], for the lists that span the shops.
List<ProductHit> allProducts(Iterable<Shop> shops) => [
      for (final s in shops)
        for (final p in productsOf(s)) (shop: s, product: p),
    ];

List<String> _words(String q) => q.toLowerCase().split(RegExp(r'[^a-z0-9£.]+')).where((w) => w.isNotEmpty).toList();

/// The products whose name or description holds every word typed, those that start with the first word before the rest, in
/// the order the shops list them otherwise. Empty for nothing typed.
List<ProductHit> findProducts(Iterable<Shop> shops, String query) {
  final words = _words(query);
  if (words.isEmpty) return const [];
  final hits = [
    for (final h in allProducts(shops))
      if (h.product.from != null && words.every('${h.product.name} ${h.product.description ?? ''}'.toLowerCase().contains)) h,
  ];
  final lead = [...hits.where((h) => h.product.name.toLowerCase().startsWith(words.first)), ...hits.where((h) => !h.product.name.toLowerCase().startsWith(words.first))];
  return lead;
}

/// The shops whose name or description holds every word typed.
List<Shop> findShops(Iterable<Shop> shops, String query) {
  final words = _words(query);
  if (words.isEmpty) return const [];
  return [for (final s in shops) if (words.every('${s.name} ${s.description ?? ''} ${s.category ?? ''}'.toLowerCase().contains)) s];
}

/// Products with a price at or under [cents], cheapest first, a product at several prices counting by its cheapest.
List<ProductHit> productsUnder(Iterable<Shop> shops, int cents) {
  final hits = [for (final h in allProducts(shops)) if ((h.product.from ?? 1 << 30) <= cents) h];
  hits.sort((a, b) => a.product.from!.compareTo(b.product.from!));
  return hits;
}

enum ProductOrder { listed, cheapest, dearest }

/// Products in the order asked for. "Listed" keeps the shop's own order; the price orders go by the cheapest price and leave
/// products with none at the end.
List<Product> orderProducts(List<Product> products, ProductOrder order) {
  if (order == ProductOrder.listed) return products;
  final priced = products.where((p) => p.from != null).toList()
    ..sort((a, b) => order == ProductOrder.cheapest ? a.from!.compareTo(b.from!) : b.from!.compareTo(a.from!));
  return [...priced, ...products.where((p) => p.from == null)];
}

/// Whether the shop is open at [nowMin] (minutes after midnight, park time), or null when its hours are not in a form we can read.
OpenState? shopState(Shop shop, int nowMin) {
  final h = parseHours(shop.openingHours);
  return h == null ? null : openState(h, nowMin);
}

/// "£1.50 – £25" over a shop's priced products; null when none is priced.
String? shopPriceRange(Shop shop) => priceRangeOfCents([for (final p in productsOf(shop)) ...p.prices]);

/// "14 products", counting a product once however many prices it has; the unpriced "other gifts" line is not a product count.
int productCount(Shop shop) => productsOf(shop).where((p) => p.from != null).length;

/// A shop's price list as plain text for sharing.
String shopText(Shop shop) {
  final h = parseHours(shop.openingHours);
  final products = productsOf(shop);
  return [
    '${shop.name} at Kynren – The Storied Lands',
    if (h != null) 'Open ${hoursText(h)}',
    '',
    for (final p in products) p.priceText == null ? p.name : '${p.name} · ${p.priceText}',
  ].join('\n').trim();
}

/// What the saved products come to at their lowest prices, in pence: a product with an adult and a child price counts as its
/// cheaper one, so the sum is a "from" figure and never claims more than it knows.
int savedFrom(Iterable<ProductHit> hits) => hits.fold(0, (sum, h) => sum + (h.product.from ?? 0));

/// The guest's saved products as a shopping list to send to someone: each with its shop and price, then the total.
String savedListText(Iterable<ProductHit> hits) {
  final list = hits.toList();
  if (list.isEmpty) return '';
  return [
    'My shopping list at Kynren – The Storied Lands',
    '',
    for (final h in list) '${h.product.name} · ${h.shop.name}${h.product.priceText == null ? '' : ' · ${h.product.priceText}'}',
    '',
    'From ${poundsShort(savedFrom(list))} in all',
  ].join('\n');
}
