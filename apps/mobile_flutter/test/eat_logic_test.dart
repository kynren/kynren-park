import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/eat_logic.dart';
import 'package:storiedlands/core/models.dart';

MenuItem dish(String name, int cents, {List<String> tags = const [], String? description}) =>
    MenuItem.fromJson({'id': name, 'name': name, 'priceCents': cents, 'dietaryTags': tags, 'description': description});

Restaurant place({String? hours, List<MenuItem> menu = const []}) => Restaurant.fromJson({
      'id': 'r1',
      'slug': 'r1',
      'name': 'Pie Shop',
      'cuisine': 'Pies',
      'openingHours': hours,
      'menuItems': [
        for (final m in menu) {'id': m.id, 'name': m.name, 'priceCents': m.priceCents, 'dietaryTags': m.dietaryTags, 'description': m.description},
      ],
    });

int at(int h, int m) => h * 60 + m;

void main() {
  test('ordering is off until the park takes online orders', () {
    expect(onlineOrderingOpen, isFalse);
  });

  group('opening hours', () {
    test('are read whatever dash, or broken character, sits between the times', () {
      for (final text in ['10:30–18:00', '10:30-18:00', '10:30\u{FFFD}18:00', 'Daily 10:30 to 18:00', 'Open 10.30 - 18.00']) {
        final h = parseHours(text)!;
        expect((h.open, h.close), (at(10, 30), at(18, 0)), reason: text);
        expect(hoursText(h), '10:30 – 18:00');
      }
    });

    test('are not guessed when the text has no times, and a place that shuts after midnight is still open before it', () {
      expect(parseHours(null), isNull);
      expect(parseHours('Weekends only'), isNull);
      expect(parseHours('Open from 10:30'), isNull);
      expect(parseHours('25:00-26:00'), isNull);
      final late = parseHours('18:00–01:00')!;
      expect(late.isOpenAt(at(23, 0)), isTrue);
      expect(late.isOpenAt(at(12, 0)), isFalse);
      expect(hoursText(late), '18:00 – 01:00');
    });

    test('say whether a place is open, closing soon, opening later or done for the day', () {
      final h = parseHours('11:00–17:30')!;
      expect(openState(h, at(9, 0)).kind, OpenKind.opensLater);
      expect(openState(h, at(9, 0)).text, 'Opens at 11:00');
      final open = openState(h, at(13, 0));
      expect((open.kind, open.text, open.isOpen), (OpenKind.open, 'Open now · until 17:30', true));
      final soon = openState(h, at(17, 0));
      expect((soon.kind, soon.text, soon.isOpen), (OpenKind.closingSoon, 'Closing soon · until 17:30', true));
      expect(openState(h, at(16, 45)).kind, OpenKind.closingSoon, reason: 'exactly 45 minutes to go');
      expect(openState(h, at(16, 44)).kind, OpenKind.open);
      expect(openState(h, at(17, 30)).kind, OpenKind.closed);
      expect(openState(h, at(17, 30)).text, 'Closed for today');
      expect(openState(h, at(11, 0)).isOpen, isTrue, reason: 'open on the minute it opens');
    });

    test('a restaurant with unreadable hours has no state, and still counts for a meal rather than vanishing', () {
      expect(restaurantState(place(hours: 'ask us'), at(12, 0)), isNull);
      expect(openAtMinute(place(hours: 'ask us'), mealMinute['lunch']!), isTrue);
      expect(openAtMinute(place(hours: '13:00–17:00'), mealMinute['lunch']!), isFalse);
      expect(openAtMinute(place(hours: '13:00–17:00'), mealMinute['dinner']!), isFalse);
      expect(openAtMinute(place(hours: '10:30–18:00'), mealMinute['dinner']!), isTrue);
    });
  });

  group('dietary choices', () {
    test('tags read as words, and unknown ones are tidied rather than dropped', () {
      expect(dietLabel('veg'), 'Vegetarian');
      expect(dietLabel('vegan'), 'Vegan');
      expect(dietLabel('GF'), 'Gluten free');
      expect(dietLabel(' gluten-free '), 'Gluten free');
      expect(dietLabel('halal'), 'Halal');
    });

    test('a vegan dish counts as vegetarian too, and the filters come in the usual order', () {
      final v = dish('Wellington', 1350, tags: ['vegan']);
      expect(dietsOf(v), {'Vegan', 'Vegetarian'});
      expect(itemHasDiet(v, 'Vegetarian'), isTrue);
      expect(itemHasDiet(dish('Pizza', 1000, tags: ['veg']), 'Vegan'), isFalse);
      final menu = [dish('Fries', 650, tags: ['gf', 'veg']), v, dish('Pie', 1450), dish('Kebab', 900, tags: ['halal'])];
      expect(dietsOnMenu(menu), ['Vegetarian', 'Vegan', 'Gluten free', 'Halal']);
      expect(dietsOnMenu(const []), isEmpty);
      expect(restaurantHasDiet(place(menu: menu), 'Gluten free'), isTrue);
      expect(restaurantHasDiet(place(menu: [dish('Pie', 1450)]), 'Vegan'), isFalse);
    });
  });

  group('prices and sweet treats', () {
    test('a price range spans the priced dishes, and one price is just that price', () {
      expect(priceRange([dish('a', 650), dish('b', 1450), dish('c', 0)]), '£6.50 – £14.50');
      expect(priceRange([dish('a', 500), dish('b', 1500)]), '£5 – £15');
      expect(priceRange([dish('a', 550), dish('b', 550)]), '£5.50');
      expect(priceRange([dish('a', 0)]), isNull);
      expect(priceRange(const []), isNull);
    });

    test('a sweet treat is spotted from its name or its description', () {
      expect(isSweet(dish('Warm Cookie & Ice Cream', 550)), isTrue);
      expect(isSweet(dish('Fish & Chips', 1550)), isFalse);
      expect(isSweet(dish('Special', 450, description: 'Sticky toffee pudding')), isTrue);
      expect(restaurantHasSweet(place(menu: [dish('Pie', 1450), dish('Chocolate Brownie', 400)])), isTrue);
      expect(restaurantHasSweet(place(menu: [dish('Pie', 1450)])), isFalse);
    });
  });

  test('a menu shares as plain text with hours, prices and dietary labels', () {
    final r = place(hours: '11:00–17:30', menu: [dish('Loaded Fries', 650, tags: ['veg', 'gf']), dish('Pie', 1450)]);
    expect(menuText(r).split('\n'), [
      'Pie Shop at Kynren – The Storied Lands',
      'Open 11:00 – 17:30',
      '',
      'Loaded Fries · £6.50 (Vegetarian, Gluten free)',
      'Pie · £14.50',
    ]);
  });
}
