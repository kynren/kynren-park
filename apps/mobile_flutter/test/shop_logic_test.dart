import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/models.dart';
import 'package:storiedlands/core/shop_logic.dart';

Map<String, dynamic> _item(String id, String name, int cents, {String? desc, Object? variants, bool available = true}) =>
    {'id': id, 'name': name, 'description': desc, 'priceCents': cents, 'variants': variants ?? {}, 'available': available};

Shop _shop(String slug, String name, List<Map<String, dynamic>> items, {String? hours, String? desc}) =>
    Shop.fromJson({'id': 'id-$slug', 'slug': slug, 'name': name, 'openingHours': hours, 'description': desc, 'items': items});

List<Map<String, dynamic>> get _kynren => [
      _item('h1', 'Kynren Hoodies', 2500, variants: [{'name': 'Adult'}]),
      _item('h2', 'Kynren Hoodies', 2000, variants: [{'name': 'Child'}]),
      _item('cap', 'Kynren Cap', 1500),
      _item('beanie', 'Kynren Beanie', 1000, available: false),
      _item('mug', 'Enamel Mug', 750, desc: 'Camping style'),
      _item('misc', 'Other souvenirs and gifts', 0, desc: 'Magnets and stationery'),
    ];

void main() {
  group('reading what the data holds for a product', () {
    test('a variant is read from the list the shop sends, and ignored when it sends the empty map', () {
      final s = _shop('k', 'Kynren Shop', _kynren);
      expect(s.items[0].variant, 'Adult');
      expect(s.items[2].variant, isNull);
      expect(s.items[3].available, isFalse);
      expect(s.items[2].available, isTrue);
    });

    test('a product the shop sends without the flag counts as in stock', () {
      final i = ShopItem.fromJson({'id': 'x', 'name': 'Thing', 'priceCents': 100});
      expect(i.available, isTrue);
      expect(i.variant, isNull);
    });
  });

  group('one product, however many prices', () {
    final products = productsOf(_shop('k', 'Kynren Shop', _kynren));

    test('the adult and child rows of a hoodie are one product with both prices labelled', () {
      final hoodie = products.firstWhere((p) => p.name == 'Kynren Hoodies');
      expect(hoodie.options.length, 2);
      expect(hoodie.priceText, 'Adult £25 · Child £20');
      expect(hoodie.from, 2000);
    });

    test('a plain product shows its price as the shop writes it, pence only when there are some', () {
      expect(products.firstWhere((p) => p.name == 'Kynren Cap').priceText, '£15');
      expect(products.firstWhere((p) => p.name == 'Enamel Mug').priceText, '£7.50');
    });

    test('a product with no price goes last and is not counted as a product', () {
      expect(products.last.name, 'Other souvenirs and gifts');
      expect(products.last.priceText, isNull);
      expect(productCount(_shop('k', 'Kynren Shop', _kynren)), 4);
    });

    test('unlabelled prices for one product read as a range', () {
      final p = productsOf(_shop('s', 'S', [_item('a', 'Candle', 800), _item('b', 'Candle', 1200)])).single;
      expect(p.priceText, '£8 – £12');
    });

    test('a product is sold out only when every row is', () {
      expect(products.firstWhere((p) => p.name == 'Kynren Beanie').soldOut, isTrue);
      expect(products.firstWhere((p) => p.name == 'Kynren Hoodies').soldOut, isFalse);
      final half = productsOf(_shop('s', 'S', [_item('a', 'Tee', 1000, available: false), _item('b', 'Tee', 900)])).single;
      expect(half.soldOut, isFalse);
    });

    test('a shop is described by the range of its prices', () {
      expect(shopPriceRange(_shop('k', 'K', _kynren)), '£7.50 – £25');
      expect(shopPriceRange(_shop('e', 'E', [_item('x', 'Other', 0)])), isNull);
    });
  });

  group('finding a gift across the shops', () {
    final shops = [
      _shop('k', 'Kynren Shop', _kynren),
      _shop('v', 'Viking Shop', [_item('p1', 'Poncho', 500, variants: [{'name': 'Adult'}]), _item('p2', 'Poncho', 400, variants: [{'name': 'Child'}]), _item('ax', 'Viking Axe', 1500), _item('mug2', 'Viking Mug', 900)]),
      _shop('b', 'The Bird Shop', [_item('p3', 'Poncho', 500, variants: [{'name': 'Adult'}]), _item('owl', 'Barn Owl', 2000, desc: 'Soft toy; includes passport')]),
    ];

    test('a word finds the products with it in their name or description, in every shop that sells them', () {
      final ponchos = findProducts(shops, 'poncho');
      expect(ponchos.map((h) => h.shop.slug), ['v', 'b']);
      expect(findProducts(shops, 'soft toy').map((h) => h.product.name), ['Barn Owl']);
    });

    test('every word typed has to match, and case does not matter', () {
      expect(findProducts(shops, 'VIKING mug').map((h) => h.product.name), ['Viking Mug']);
      expect(findProducts(shops, 'viking cap'), isEmpty);
    });

    test('products that start with what was typed come before those that only contain it', () {
      final names = findProducts(shops, 'mug').map((h) => h.product.name).toList();
      expect(names, ['Enamel Mug', 'Viking Mug'], reason: 'both contain it; the shops list the Kynren one first');
      final lead = findProducts(shops, 'viking').map((h) => h.product.name).toList();
      expect(lead.first, startsWith('Viking'));
    });

    test('nothing typed finds nothing, and a product with no price is never offered as a find', () {
      expect(findProducts(shops, '  '), isEmpty);
      expect(findProducts(shops, 'souvenirs'), isEmpty);
    });

    test('shops are found by their name', () {
      expect(findShops(shops, 'bird').map((s) => s.slug), ['b']);
      expect(findShops(shops, 'shop').length, 3);
    });

    test('a budget lists what can be had for that much, cheapest first, counting a product by its lowest price', () {
      final names = productsUnder(shops, 1000).map((h) => '${h.shop.slug}:${h.product.name}').toList();
      expect(names.first, startsWith('v:Poncho'), reason: 'the child poncho at £4 is the cheapest');
      expect(names, containsAll(['k:Enamel Mug', 'v:Viking Mug', 'k:Kynren Beanie']));
      expect(names, isNot(contains('k:Kynren Cap')));
      expect(productsUnder(shops, 100), isEmpty);
    });
  });

  group('ordering a shop\'s products', () {
    final products = productsOf(_shop('k', 'K', _kynren));
    List<String> names(ProductOrder o) => orderProducts(products, o).map((p) => p.name).toList();

    test('the shop\'s own order is kept unless a price order is asked for', () {
      expect(names(ProductOrder.listed).first, 'Kynren Hoodies');
    });

    test('cheapest and dearest go by lowest price, with the unpriced line still last', () {
      expect(names(ProductOrder.cheapest), ['Enamel Mug', 'Kynren Beanie', 'Kynren Cap', 'Kynren Hoodies', 'Other souvenirs and gifts']);
      expect(names(ProductOrder.dearest), ['Kynren Hoodies', 'Kynren Cap', 'Kynren Beanie', 'Enamel Mug', 'Other souvenirs and gifts']);
    });
  });

  group('open now', () {
    test('a shop with readable hours has a state; one without has none', () {
      expect(shopState(_shop('a', 'A', const [], hours: '10:00-17:00'), 12 * 60)?.isOpen, isTrue);
      expect(shopState(_shop('a', 'A', const [], hours: '10:00-17:00'), 18 * 60)?.isOpen, isFalse);
      expect(shopState(_shop('a', 'A', const []), 12 * 60), isNull);
      expect(shopState(_shop('a', 'A', const [], hours: 'daily'), 12 * 60), isNull);
    });
  });

  group('the saved list', () {
    final shops = [
      _shop('k', 'Kynren Shop', _kynren),
      _shop('v', 'Viking Shop', [_item('p1', 'Poncho', 500, variants: [{'name': 'Adult'}]), _item('p2', 'Poncho', 400, variants: [{'name': 'Child'}])]),
    ];
    final hits = allProducts(shops);
    List<ProductHit> pick(Set<String> names) => [for (final h in hits) if (names.contains(h.product.name)) h];

    test('comes to the lowest price of each product, so it never claims more than it knows', () {
      expect(savedFrom(pick({'Kynren Cap', 'Poncho'})), 1500 + 400);
      expect(savedFrom(const []), 0);
    });

    test('a product with no price adds nothing', () {
      expect(savedFrom(pick({'Other souvenirs and gifts', 'Enamel Mug'})), 750);
    });

    test('reads as a shopping list to send: each product with its shop and price, then the total', () {
      final text = savedListText(pick({'Kynren Cap', 'Poncho'}));
      final lines = text.split(String.fromCharCode(10));
      expect(lines.first, 'My shopping list at Kynren – The Storied Lands');
      expect(text, contains('Kynren Cap · Kynren Shop · £15'));
      expect(text, contains('Poncho · Viking Shop · Adult £5 · Child £4'));
      expect(lines.last, 'From £19 in all');
      expect(savedListText(const []), '');
    });
  });

  test('a shop\'s price list reads as plain text for sharing', () {
    final text = shopText(_shop('k', 'Kynren Shop', _kynren, hours: '10:30-18:00'));
    final lines = text.split('\n');
    expect(lines.first, 'Kynren Shop at Kynren – The Storied Lands');
    expect(lines[1], 'Open 10:30 – 18:00');
    expect(text, contains('Kynren Hoodies · Adult £25 · Child £20'));
    expect(text, contains('Enamel Mug · £7.50'));
    expect(lines.last, 'Other souvenirs and gifts');
  });
}
