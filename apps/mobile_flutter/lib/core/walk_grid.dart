import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui';

/// A way of getting from A to B across the park.
class WalkRoute {
  /// The line to walk, as fractions of the map picture (0 to 1 across and down), from where the guest is to where they
  /// are going.
  final List<Offset> points;
  final double metres;
  const WalkRoute(this.points, this.metres);
}

/// What it costs, per metre, to step onto a cell that is not walkable: a stretch of grass or a hidden bit of path is
/// crossed only when going round would be much longer.
const _offPath = 9.0;

/// The walkable area of the map picture, found by the admin's map editor: a grid of cells, each one path or not. Routes
/// run across it, keeping to the middle of narrow paths, going straight over plazas and crossing a short gap (a tree
/// that hides the path) when that is the shortest way. Cells are fractions of the picture, so the grid lines up with
/// the map rectangle the places are positioned on.
class WalkGrid {
  final int w, h;
  final Uint8List cells;

  /// For a walkable cell, how many cells it is from the nearest one that is not: large in the middle of a wide path.
  final Float32List _inside;

  WalkGrid._(this.w, this.h, this.cells) : _inside = _insideDistances(w, h, cells);

  /// Reads the grid the API sends, or null when it is missing or malformed.
  static WalkGrid? fromJson(Object? raw) {
    if (raw is! Map || raw['v'] != 1) return null;
    final w = raw['w'], h = raw['h'], bits = raw['bits'];
    if (w is! int || h is! int || bits is! String || w < 16 || h < 16 || w > 2048 || h > 2048) return null;
    try {
      final bytes = base64Decode(bits);
      if (bytes.length < (w * h + 7) ~/ 8) return null;
      final cells = Uint8List(w * h);
      var walkable = 0;
      for (var i = 0; i < cells.length; i++) {
        final on = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
        cells[i] = on;
        walkable += on;
      }
      return walkable == 0 ? null : WalkGrid._(w, h, cells);
    } catch (_) {
      return null;
    }
  }

  /// A grid straight from cells (row by row, 1 = walkable): for tests.
  factory WalkGrid.fromCells(int w, int h, List<int> cells) => WalkGrid._(w, h, Uint8List.fromList(cells));

  static Float32List _insideDistances(int w, int h, Uint8List cells) {
    // two passes of a chamfer distance transform: distance to the nearest non-walkable cell (cells off the edge count as walkable)
    const big = 1e6;
    final d = Float32List(w * h);
    for (var i = 0; i < d.length; i++) {
      d[i] = cells[i] == 0 ? 0 : big;
    }
    const side = 1.0, diag = 1.4142;
    double at(int x, int y) => x < 0 || y < 0 || x >= w || y >= h ? big : d[y * w + x];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        final i = y * w + x;
        if (d[i] == 0) continue;
        d[i] = math.min(d[i], math.min(math.min(at(x - 1, y) + side, at(x, y - 1) + side), math.min(at(x - 1, y - 1) + diag, at(x + 1, y - 1) + diag)));
      }
    }
    for (var y = h - 1; y >= 0; y--) {
      for (var x = w - 1; x >= 0; x--) {
        final i = y * w + x;
        if (d[i] == 0) continue;
        d[i] = math.min(d[i], math.min(math.min(at(x + 1, y) + side, at(x, y + 1) + side), math.min(at(x + 1, y + 1) + diag, at(x - 1, y + 1) + diag)));
      }
    }
    for (var i = 0; i < d.length; i++) {
      if (d[i] >= big) d[i] = 50; // a grid with no non-walkable cell at all
    }
    return d;
  }

  bool walkable(int x, int y) => x >= 0 && y >= 0 && x < w && y < h && cells[y * w + x] == 1;

  /// The cell a point (a fraction of the picture) is in.
  int cellOf(Offset p) => (p.dy * h).floor().clamp(0, h - 1) * w + (p.dx * w).floor().clamp(0, w - 1);

  /// The shortest way from [from] to [to], both as fractions of the picture. [metresAcross] and [metresDown] are how
  /// long the picture's width and height are on the ground. Always finds a way: where there is no path it is a straight
  /// walk, and the metres are what that walk really covers.
  WalkRoute route(Offset from, Offset to, {required double metresAcross, required double metresDown}) {
    final cw = metresAcross / w, ch = metresDown / h; // a cell's size on the ground
    final start = cellOf(from), goal = cellOf(to);
    final gx = goal % w, gy = goal ~/ w;

    final g = Float64List(w * h)..fillRange(0, w * h, double.infinity);
    final parent = Int32List(w * h)..fillRange(0, w * h, -1);
    final done = Uint8List(w * h);
    final heap = _Heap()..push(start, 0);
    g[start] = 0;

    double heuristic(int c) {
      final dx = ((c % w) - gx) * cw, dy = ((c ~/ w) - gy) * ch;
      return math.sqrt(dx * dx + dy * dy);
    }

    while (heap.isNotEmpty) {
      final u = heap.pop();
      if (done[u] == 1) continue;
      done[u] = 1;
      if (u == goal) break;
      final ux = u % w, uy = u ~/ w;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          if (dx == 0 && dy == 0) continue;
          final vx = ux + dx, vy = uy + dy;
          if (vx < 0 || vy < 0 || vx >= w || vy >= h) continue;
          final v = vy * w + vx;
          if (done[v] == 1) continue;
          final step = math.sqrt(math.pow(dx * cw, 2) + math.pow(dy * ch, 2));
          // on a path: dearer near its edges so a narrow path is followed down its middle, a plaza crossed straight
          final per = cells[v] == 1 ? 1 + 1.5 / (1 + _inside[v]) : _offPath;
          final nd = g[u] + step * per;
          if (nd < g[v]) {
            g[v] = nd;
            parent[v] = u;
            heap.push(v, nd + heuristic(v));
          }
        }
      }
    }

    final chain = <int>[];
    for (var c = goal; c != -1; c = parent[c]) {
      chain.add(c);
      if (c == start) break;
    }
    final cellsOnRoute = chain.reversed.toList();
    final line = _straighten(cellsOnRoute);
    // the guest and the destination replace the centres of their own first and last cells
    final points = <Offset>[from, for (var i = 1; i < line.length - 1; i++) Offset((line[i] % w + 0.5) / w, (line[i] ~/ w + 0.5) / h), to];

    var metres = 0.0;
    for (var i = 1; i < points.length; i++) {
      final dx = (points[i].dx - points[i - 1].dx) * metresAcross, dy = (points[i].dy - points[i - 1].dy) * metresDown;
      metres += math.sqrt(dx * dx + dy * dy);
    }
    return WalkRoute(points, metres);
  }

  /// Pulls the cell-by-cell route taut: from each point it jumps to the furthest later point it can walk to in a straight
  /// line without crossing more off-path cells than the route itself did between them.
  List<int> _straighten(List<int> path) {
    if (path.length < 3) return path;
    int offCount(int a, int b) {
      final ax = a % w, ay = a ~/ w, bx = b % w, by = b ~/ w;
      final n = math.max(1, (math.max((bx - ax).abs(), (by - ay).abs()) * 2));
      var off = 0, last = -1;
      for (var s = 0; s <= n; s++) {
        final x = (ax + (bx - ax) * s / n).round(), y = (ay + (by - ay) * s / n).round();
        final c = y * w + x;
        if (c == last) continue;
        last = c;
        if (cells[c] == 0) off++;
      }
      return off;
    }

    final prefix = List<int>.filled(path.length + 1, 0); // off-path cells on the route up to each point
    for (var i = 0; i < path.length; i++) {
      prefix[i + 1] = prefix[i] + (cells[path[i]] == 0 ? 1 : 0);
    }
    final out = <int>[path.first];
    var i = 0;
    while (i < path.length - 1) {
      var j = path.length - 1;
      while (j > i + 1) {
        final routeOff = prefix[j + 1] - prefix[i];
        if (offCount(path[i], path[j]) <= routeOff) break;
        j--;
      }
      out.add(path[j]);
      i = j;
    }
    return out;
  }
}

/// Rounds the corners of a polyline (Chaikin's corner cutting), keeping both ends, so footprints follow a gentle curve
/// where the straightened route turns.
List<Offset> smoothLine(List<Offset> pts, {int rounds = 2}) {
  var cur = pts;
  for (var r = 0; r < rounds && cur.length > 2; r++) {
    final next = <Offset>[cur.first];
    for (var i = 0; i < cur.length - 1; i++) {
      final a = cur[i], b = cur[i + 1];
      next.add(Offset.lerp(a, b, 0.25)!);
      next.add(Offset.lerp(a, b, 0.75)!);
    }
    next.add(cur.last);
    cur = next;
  }
  return cur;
}

/// A min-heap of cells ordered by a score, for the shortest-path search.
class _Heap {
  final List<int> _cell = [];
  final List<double> _score = [];
  bool get isNotEmpty => _cell.isNotEmpty;

  void push(int cell, double score) {
    _cell.add(cell);
    _score.add(score);
    var i = _cell.length - 1;
    while (i > 0) {
      final p = (i - 1) >> 1;
      if (_score[p] <= _score[i]) break;
      _swap(p, i);
      i = p;
    }
  }

  int pop() {
    final top = _cell.first;
    final lastCell = _cell.removeLast(), lastScore = _score.removeLast();
    if (_cell.isNotEmpty) {
      _cell[0] = lastCell;
      _score[0] = lastScore;
      var i = 0;
      for (;;) {
        final l = 2 * i + 1, r = l + 1;
        var m = i;
        if (l < _cell.length && _score[l] < _score[m]) m = l;
        if (r < _cell.length && _score[r] < _score[m]) m = r;
        if (m == i) break;
        _swap(m, i);
        i = m;
      }
    }
    return top;
  }

  void _swap(int a, int b) {
    final c = _cell[a], s = _score[a];
    _cell[a] = _cell[b];
    _score[a] = _score[b];
    _cell[b] = c;
    _score[b] = s;
  }
}
