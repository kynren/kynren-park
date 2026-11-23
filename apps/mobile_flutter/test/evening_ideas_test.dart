import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/models.dart';
import 'package:storiedlands/core/needs_logic.dart';
import 'package:storiedlands/core/right_now_logic.dart';

Attraction _a(String id, {bool step = false, bool audio = false, bool cap = false, bool bsl = false, int order = 0}) => Attraction.fromJson({
      'id': id,
      'slug': id,
      'name': id,
      'sortOrder': order,
      'wheelchairAccessible': step,
      'hasAudioDescription': audio,
      'hasCaptioning': cap,
      'hasBSL': bsl,
    });

Restaurant _r(String id, String? hours) => Restaurant.fromJson({'id': id, 'slug': id, 'name': id, 'openingHours': hours});
Shop _s(String id, String? hours) => Shop.fromJson({'id': id, 'slug': id, 'name': id, 'openingHours': hours});

void main() {
  group('what suits me', () {
    test('with no needs chosen nothing is judged', () {
      final r = fitFor([_a('a'), _a('b', step: true)], {});
      expect(r.map((x) => x.fit), everyElement(Fit.unknown));
    });

    test('full, partial and none are told apart, best first', () {
      final r = fitFor([
        _a('none', order: 1),
        _a('partial', step: true, order: 2),
        _a('full', step: true, cap: true, order: 3),
      ], {Need.stepFree, Need.captions});
      expect(r.map((x) => x.attraction.id), ['full', 'partial', 'none']);
      expect(r.map((x) => x.fit), [Fit.full, Fit.partial, Fit.none]);
      expect(r[1].met, [Need.stepFree]);
      expect(r[1].missing, [Need.captions]);
    });

    test('what the park has not listed counts as not offered', () {
      final r = fitFor([_a('a')], {Need.bsl});
      expect(r.single.fit, Fit.none);
    });

    test('needs are read from, and use the same keys as, the profile Settings saves', () {
      expect(needsFromProfile({'wheelchair': true, 'bsl': true, 'audioDesc': false}), {Need.stepFree, Need.bsl});
      expect(needsFromProfile({}), isEmpty);
    });
  });

  group('right now', () {
    final routes = [
      {
        'name': 'Park and ride',
        'stops': [
          {'name': 'Car park', 'times': ['18:00', '18:30', '19:00']},
          {'name': 'Arena', 'times': ['18:10', '18:40']},
        ],
      },
    ];

    test('picks the soonest departure across every stop', () {
      final s = soonestShuttle(routes, DateTime(2026, 8, 21, 18, 5))!;
      expect(s.stop, 'Arena');
      expect(s.time, '18:10');
      expect(s.minutes, 5);
      expect(s.route, 'Park and ride');
    });

    test('says nothing once the last one has gone, instead of promising tomorrow', () {
      expect(soonestShuttle(routes, DateTime(2026, 8, 21, 23, 0)), isNull);
      expect(soonestShuttle([], DateTime(2026, 8, 21, 12, 0)), isNull);
    });

    test('only counts places whose hours we can read and that are open', () {
      final n = openNowCount(
        [_r('a', '10:00-18:00'), _r('b', '14:00-16:00'), _r('c', null)],
        [_s('d', 'Daily 09:30 - 21:00'), _s('e', 'see the sign')],
        13 * 60,
      );
      expect(n, 2);
    });
  });
}
