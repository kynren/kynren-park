import 'models.dart';

/// Whether guests can really order food ahead. Off until the park takes online orders: while it is off, no order button,
/// "order ahead" wording or order list is shown anywhere in the app. The ordering screens are kept so this is the only
/// thing to change when it launches.
const onlineOrderingOpen = false;

/// A closing time this close counts as "closing soon".
const closingSoonMins = 45;

/// When a place opens and shuts, in minutes after midnight. [close] is past 24 * 60 for a place that shuts after midnight.
class Hours {
  final int open, close;
  const Hours(this.open, this.close);

  bool isOpenAt(int min) => min >= open && min < close;
}

String _hhmm(int min) {
  final m = min % (24 * 60);
  return '${(m ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
}

final _hoursRe = RegExp(r'(\d{1,2})[:.](\d{2})\D+?(\d{1,2})[:.](\d{2})');

/// Reads opening hours typed as free text ("10:30–18:00", "Daily 11:00 - 17:30"): the first two times in it. Null when
/// there are none, so nothing is claimed about a place whose hours we cannot read.
Hours? parseHours(String? text) {
  if (text == null) return null;
  final m = _hoursRe.firstMatch(text);
  if (m == null) return null;
  final open = int.parse(m[1]!) * 60 + int.parse(m[2]!);
  var close = int.parse(m[3]!) * 60 + int.parse(m[4]!);
  if (int.parse(m[1]!) > 23 || int.parse(m[3]!) > 24 || int.parse(m[2]!) > 59 || int.parse(m[4]!) > 59) return null;
  if (close <= open) close += 24 * 60;
  return Hours(open, close);
}

/// Hours as they read in the app, whatever dash (or broken character) the text had between the times.
String hoursText(Hours h) => '${_hhmm(h.open)} – ${_hhmm(h.close)}';

enum OpenKind { open, closingSoon, opensLater, closed }

class OpenState {
  final OpenKind kind;
  final String text;
  const OpenState(this.kind, this.text);
  bool get isOpen => kind == OpenKind.open || kind == OpenKind.closingSoon;
}

/// Where a place stands at [nowMin] (minutes after midnight, park time): open and until when, closing soon, opening later
/// today, or finished for the day.
OpenState openState(Hours h, int nowMin) {
  if (h.isOpenAt(nowMin)) {
    final left = h.close - nowMin;
    return left <= closingSoonMins
        ? OpenState(OpenKind.closingSoon, 'Closing soon · until ${_hhmm(h.close)}')
        : OpenState(OpenKind.open, 'Open now · until ${_hhmm(h.close)}');
  }
  if (nowMin < h.open) return OpenState(OpenKind.opensLater, 'Opens at ${_hhmm(h.open)}');
  return const OpenState(OpenKind.closed, 'Closed for today');
}

/// A restaurant's state now, or null when its hours are unknown.
OpenState? restaurantState(Restaurant r, int nowMin) {
  final h = parseHours(r.openingHours);
  return h == null ? null : openState(h, nowMin);
}

/// The meals the shortcuts on the Eat screen stand for, and the time of day each is judged at.
const mealMinute = {'lunch': 12 * 60 + 30, 'dinner': 17 * 60};

/// Whether a restaurant is open at [min]. Unknown hours count as open: we would rather show a place than hide it.
bool openAtMinute(Restaurant r, int min) => parseHours(r.openingHours)?.isOpenAt(min) ?? true;

/// A dietary tag as a guest reads it. Unknown tags are tidied rather than dropped.
String dietLabel(String tag) {
  switch (tag.trim().toLowerCase()) {
    case 'veg':
    case 'vegetarian':
      return 'Vegetarian';
    case 'vegan':
      return 'Vegan';
    case 'gf':
    case 'gluten free':
    case 'gluten-free':
      return 'Gluten free';
    case 'df':
    case 'dairy free':
    case 'dairy-free':
      return 'Dairy free';
    case 'nf':
    case 'nut free':
    case 'nut-free':
      return 'Nut free';
    default:
      final t = tag.trim();
      return t.isEmpty ? t : '${t[0].toUpperCase()}${t.substring(1).toLowerCase()}';
  }
}

/// The filters offered for a menu, in this order.
const dietFilters = ['Vegetarian', 'Vegan', 'Gluten free', 'Dairy free', 'Nut free'];

Set<String> dietsOf(MenuItem m) {
  final out = <String>{for (final t in m.dietaryTags) dietLabel(t)};
  if (out.contains('Vegan')) out.add('Vegetarian'); // a vegan dish is a vegetarian one too
  return out;
}

bool itemHasDiet(MenuItem m, String diet) => dietsOf(m).contains(diet);

/// The dietary filters at least one dish on this menu meets, in the usual order.
List<String> dietsOnMenu(Iterable<MenuItem> items) {
  final all = <String>{for (final m in items) ...dietsOf(m)};
  return [...dietFilters.where(all.contains), ...(all.difference(dietFilters.toSet()).toList()..sort())];
}

bool restaurantHasDiet(Restaurant r, String diet) => r.menuItems.any((m) => itemHasDiet(m, diet));

const _sweetWords = [
  'cake', 'cookie', 'brownie', 'ice cream', 'sundae', 'waffle', 'pudding', 'crumble', 'cheesecake', 'scone', 'dessert', 'sweet', 'toffee', 'fudge',
  'chocolate', 'donut', 'doughnut', 'pancake', 'tart', 'trifle', 'sorbet', 'gelato', 'shortbread', 'muffin', 'cupcake', 'pastry', 'candy floss',
];

/// Whether a dish is a sweet treat, from its name and description.
bool isSweet(MenuItem m) {
  final t = '${m.name} ${m.description ?? ''}'.toLowerCase();
  return _sweetWords.any(t.contains);
}

bool restaurantHasSweet(Restaurant r) => r.menuItems.any(isSweet);

/// A price as the shops and menus write it: £15, or £1.50.
String poundsShort(int cents) => cents % 100 == 0 ? '£${cents ~/ 100}' : '£${(cents / 100).toStringAsFixed(2)}';

/// "£5.50 – £14.50" across prices in pence, or just the one price. Null when none is above zero.
String? priceRangeOfCents(Iterable<int> cents) {
  final prices = [for (final p in cents) if (p > 0) p]..sort();
  if (prices.isEmpty) return null;
  return prices.first == prices.last ? poundsShort(prices.first) : '${poundsShort(prices.first)} – ${poundsShort(prices.last)}';
}

/// The same across a menu's priced dishes.
String? priceRange(Iterable<MenuItem> items) => priceRangeOfCents(items.map((m) => m.priceCents));

/// A menu as plain text for sharing.
String menuText(Restaurant r) {
  final h = parseHours(r.openingHours);
  return [
    '${r.name} at Kynren – The Storied Lands',
    if (h != null) 'Open ${hoursText(h)}',
    '',
    for (final m in r.menuItems)
      '${m.name}${m.priceCents > 0 ? ' · ${poundsShort(m.priceCents)}' : ''}${m.dietaryTags.isEmpty ? '' : ' (${m.dietaryTags.map(dietLabel).join(', ')})'}',
  ].join('\n').trim();
}
