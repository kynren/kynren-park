import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/walk_grid.dart';
import 'package:storiedlands/screens/map/map_logic.dart';

// A 40 x 20 grid drawn as text: '#' is path, '.' is grass.
WalkGrid draw(List<String> rows) => WalkGrid.fromCells(rows.first.length, rows.length, [for (final r in rows) for (final c in r.split('')) c == '#' ? 1 : 0]);

double along(List<Offset> pts) => [for (var i = 1; i < pts.length; i++) (pts[i] - pts[i - 1]).distance].fold(0.0, (a, b) => a + b);

void main() {
  // 1 cell = 1 m, so fractions of the picture are cells over the size.
  Offset at(WalkGrid g, double x, double y) => Offset(x / g.w, y / g.h);
  WalkRoute go(WalkGrid g, double x0, double y0, double x1, double y1) => g.route(at(g, x0, y0), at(g, x1, y1), metresAcross: g.w.toDouble(), metresDown: g.h.toDouble());

  final corridor = draw([
    '................................',
    '................................',
    '..############################..',
    '..############################..',
    '..##........................##..',
    '..##........................##..',
    '..##........................##..',
    '..##........................##..',
    '..############################..',
    '..############################..',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ]);

  test('a route keeps to the path, going round a patch of grass instead of across it', () {
    final r = go(corridor, 3.5, 5.5, 28.5, 5.5);
    expect(r.points.first, at(corridor, 3.5, 5.5));
    expect(r.points.last, at(corridor, 28.5, 5.5));
    // straight across the grass would be 25 m, but that is 9 times dearer than walking: it goes up into the corridor
    final highest = r.points.map((p) => p.dy * corridor.h).reduce(math.min);
    expect(highest, lessThan(4.6), reason: 'it climbed onto the path (rows 2 to 3) instead of crossing the grass (rows 4 to 7)');
    expect(r.metres, lessThan(40));
  });

  test('over open ground that is all path the walk is a straight line', () {
    final plaza = draw([for (var i = 0; i < 20; i++) '#' * 40]);
    final r = go(plaza, 2.5, 2.5, 35.5, 15.5);
    expect(r.metres, closeTo(math.sqrt(33 * 33 + 13 * 13), 1.5));
    expect(r.points.length, lessThan(5), reason: 'pulled taut, not a staircase of cells');
  });

  test('a short gap in the path (a tree over it) is crossed, a long detour is not made to avoid it', () {
    final gap = draw([
      '........................................',
      '..##########............################',
      '..##########............################',
      '..##########............################',
      '........................................',
    ]);
    final r = go(gap, 4.5, 2.5, 35.5, 2.5);
    expect(r.metres, closeTo(31, 3));
  });

  test('with no path at all, it is still a straight walk', () {
    final none = draw([for (var i = 0; i < 20; i++) '#${'.' * 38}#']);
    final r = go(none, 5.5, 5.5, 30.5, 14.5);
    expect(r.metres, closeTo(math.sqrt(25 * 25 + 9 * 9), 1.5));
  });

  test('a grid is read back from what the API sends, and a bad one is refused', () {
    // 16 x 16 cells, the left half walkable: each row is 0xFF00, so 32 bytes of ff 00
    final bytes = List<int>.generate(32, (i) => i.isEven ? 0xFF : 0);
    final ok = WalkGrid.fromJson({'v': 1, 'w': 16, 'h': 16, 'bits': base64Encode(bytes)});
    expect(ok, isNotNull);
    expect(ok!.walkable(3, 3), isTrue);
    expect(ok.walkable(12, 3), isFalse);
    expect(WalkGrid.fromJson(null), isNull);
    expect(WalkGrid.fromJson({'v': 2, 'w': 16, 'h': 16, 'bits': 'AAAA'}), isNull);
    expect(WalkGrid.fromJson({'v': 1, 'w': 16, 'h': 16, 'bits': 'AAAA'}), isNull, reason: 'too few cells for its size');
    expect(WalkGrid.fromJson({'v': 1, 'w': 16, 'h': 16, 'bits': base64Encode(List.filled(32, 0))}), isNull, reason: 'nothing walkable');
  });

  test('smoothing keeps both ends and rounds the corner', () {
    const a = Offset(0, 0), b = Offset(10, 0), c = Offset(10, 10);
    final s = smoothLine([a, b, c]);
    expect(s.first, a);
    expect(s.last, c);
    expect(s.where((p) => p == b), isEmpty, reason: 'the sharp corner is cut off');
    expect(along(s), lessThan(along([a, b, c])));
  });

  group('on the real park map', () {
    final fixture = jsonDecode(File('test/fixtures/map-walk-grid.json').readAsStringSync()) as Map<String, dynamic>;
    final grid = WalkGrid.fromJson(fixture['grid'])!;
    final places = (fixture['places'] as List).cast<Map<String, dynamic>>();
    Offset where(Map<String, dynamic> p) => Offset((p['x'] as num).toDouble(), (p['y'] as num).toDouble());
    WalkRoute walk(Offset a, Offset b) => grid.route(a, b, metresAcross: parkMetresAcross, metresDown: parkMetresDown);
    double straight(Offset a, Offset b) => math.sqrt(math.pow((a.dx - b.dx) * parkMetresAcross, 2) + math.pow((a.dy - b.dy) * parkMetresDown, 2));

    test('the grid has the park in it', () {
      final walkable = grid.cells.fold(0, (a, b) => a + b);
      expect(grid.w, 512);
      expect(walkable / grid.cells.length, inInclusiveRange(0.08, 0.40));
    });

    test('from the entrance, every place is a sensible walk: never shorter than the crow flies, never wildly longer', () {
      final entrance = places.firstWhere((p) => p['type'] == 'ENTRANCE');
      for (final p in places) {
        final r = walk(where(entrance), where(p));
        final crow = straight(where(entrance), where(p));
        expect(r.metres, greaterThanOrEqualTo(crow - 1), reason: p['name'] as String);
        expect(r.metres, lessThan(crow * 1.9 + 40), reason: '${p['name']}: ${r.metres.round()} m for ${crow.round()} m as the crow flies');
        expect(r.points.first, where(entrance));
        expect(r.points.last, where(p));
      }
    });

    test('a walk is worked out in well under a tenth of a second', () {
      final a = where(places.first), b = where(places.last);
      final sw = Stopwatch()..start();
      for (var i = 0; i < 10; i++) {
        walk(a, b);
      }
      expect(sw.elapsedMilliseconds / 10, lessThan(100));
    });
  });
}
