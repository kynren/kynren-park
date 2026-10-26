import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../app/shell.dart' show navClearance;
import '../../core/favorites.dart';
import '../../core/format.dart';
import '../../core/location.dart';
import '../../core/models.dart';
import '../../core/sync.dart';
import '../../core/theme.dart';
import '../../ui/controls.dart';
import '../../ui/cover.dart';
import '../../ui/kimage.dart';
import '../../ui/tap.dart';
import 'map_logic.dart';
import 'map_widgets.dart';
import 'rotatable_viewer.dart';

const _grass = Color(0xFFA9C97F);

/// The "tap the map to explore" hint is for first-time visitors: shown once, for a few seconds, then never again.
const _hintSeenKey = 'kynren_map_hint_seen';
const _hintFor = Duration(seconds: 5);

// Module-level so dismissing the "outside the park" banner sticks for the rest of this app session,
// surviving tab switches, and only resets on an actual relaunch.
bool _outsideBannerDismissed = false;

/// The park map: a pan/zoom/rotate basemap with category filters, search, a "near you" list, shield markers that group
/// into areas, a callout for the chosen place and a walking route from the guest's position.
class MapScreen extends StatefulWidget {
  /// Deep links: focus a place by id ("Go to"), or a scanned spot as `type:id`.
  final String? focus, spot;
  const MapScreen({super.key, this.focus, this.spot});
  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with TickerProviderStateMixin {
  final _view = TransformationController();
  late final AnimationController _viewAnim = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
  late final AnimationController _popupIn = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat();
  final _searchCtl = TextEditingController();

  final Set<Cat> _cats = {Cat.shows};
  Pin? _selected, _closing;
  bool _searchOpen = true, _nearOpen = false, _hintDismissed = false, _hintVisible = false;
  Timer? _hintTimer;
  bool _bannerDismissed = _outsideBannerDismissed;
  String? _pendingSelect, _pendingSpot, _appliedFocus;
  double _zoom = 1;
  bool _rotated = false;
  double _imgAspect = 0; // 0 until the basemap image has been measured
  String? _measuredUrl;
  Size _vp = Size.zero;
  bool _appliedInitial = false;
  Matrix4? _from, _to;

  Pin? get _displayPin => _selected ?? _closing;
  double get _scale => _view.value.getMaxScaleOnAxis();

  @override
  void initState() {
    super.initState();
    _view.addListener(_onView);
    _viewAnim.addListener(_tickView);
    _showHintOnce();
    _handleParams();
  }

  Future<void> _showHintOnce() async {
    try {
      final p = await SharedPreferences.getInstance();
      if (p.getBool(_hintSeenKey) ?? false) return;
      await p.setBool(_hintSeenKey, true); // counted as seen as soon as it appears, so it never comes back
    } catch (_) {
      return; // can't remember it, so better not to nag
    }
    if (!mounted) return;
    setState(() => _hintVisible = true);
    _hintTimer = Timer(_hintFor, () => mounted ? setState(() => _hintVisible = false) : null);
  }

  @override
  void didUpdateWidget(MapScreen old) {
    super.didUpdateWidget(old);
    if (old.focus != widget.focus || old.spot != widget.spot) _handleParams();
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _view.dispose();
    _viewAnim.dispose();
    _popupIn.dispose();
    _pulse.dispose();
    _searchCtl.dispose();
    super.dispose();
  }

  void _onView() {
    final z = (_scale * 2).round() / 2;
    final turned = _angle.abs() > 0.005;
    if (z != _zoom || turned != _rotated) {
      setState(() {
        _zoom = z;
        _rotated = turned;
      });
    }
  }

  // ------------------------------------------------------------------ view

  Size get _fit {
    final vw = _vp.width, vh = _vp.height;
    if (_imgAspect <= 0) return Size(vw, vh);
    if (_imgAspect > vw / vh) return Size(vh * _imgAspect, vh);
    return Size(vw, vw / _imgAspect);
  }

  double _clampScale(double s, double max) => s.clamp(minScale, max);

  double get _angle => viewAngle(_view.value);
  Offset _screenOf(Offset content) => viewToScreen(_view.value, content);
  Matrix4 _constrain(Matrix4 view) => clampView(view, _fit, _vp);

  /// Glide to the view that puts [content] at [screen] (the middle of the screen unless given). The map keeps the turn
  /// it has, unless [angle] says otherwise (0 points it north again).
  void _goTo(Offset content, double scale, double maxScale, {Offset? screen, double? angle, bool animate = true, int ms = 220}) {
    final target = _constrain(composeView(scale: _clampScale(scale, maxScale), angle: angle ?? _angle, content: content, screen: screen ?? Offset(_vp.width / 2, _vp.height / 2)));
    if (!animate) {
      _view.value = target;
      return;
    }
    _from = _view.value.clone();
    _to = target;
    _viewAnim.duration = Duration(milliseconds: ms);
    _viewAnim.forward(from: 0);
  }

  void _tickView() {
    final a = _from, b = _to;
    if (a == null || b == null) return;
    final t = Curves.easeInOut.transform(_viewAnim.value);
    final s0 = a.getMaxScaleOnAxis(), s1 = b.getMaxScaleOnAxis(), a0 = viewAngle(a);
    final s = s0 + (s1 - s0) * t;
    final p = Offset.lerp(Offset(a.storage[12], a.storage[13]), Offset(b.storage[12], b.storage[13]), t)!;
    _view.value = Matrix4.identity()
      ..translateByDouble(p.dx, p.dy, 0, 1)
      ..rotateZ(a0 + angleDelta(a0, viewAngle(b)) * t)
      ..scaleByDouble(s, s, 1, 1);
  }

  /// Zoom to an exact target scale while keeping content point (x, y) at its current on-screen position.
  void _zoomKeeping(double x, double y, double target, double maxScale, {int ms = 220}) {
    final at = Offset(x, y);
    _goTo(at, target, maxScale, screen: _screenOf(at), ms: ms);
  }

  /// Bring a pin to the centre of the viewport and zoom in on it, whatever the earlier pan and zoom were.
  void _focusPin(Pin pin, double target, double maxScale) => _goTo(Offset(pin.x, pin.y), target, maxScale);

  // ---------------------------------------------------------------- popup

  void _select(Pin pin) {
    HapticFeedback.selectionClick();
    setState(() {
      _selected = pin;
      _closing = null;
      _hintDismissed = true;
    });
    _popupIn.forward();
  }

  void _dismissPopup() {
    if (_selected == null) return;
    setState(() {
      _closing = _selected;
      _selected = null;
    });
    _popupIn.reverse().whenComplete(() {
      if (mounted && _selected == null) setState(() => _closing = null);
    });
  }

  // ------------------------------------------------------------ deep links

  void _handleParams() {
    final sync = context.read<SyncState>();
    final b = sync.bundle;
    if (widget.focus != null) {
      final isRestaurant = b?.restaurants.any((r) => r.id == widget.focus) ?? false;
      final isFacility = b?.pois.any((p) => p.id == widget.focus && facilityTypes.containsKey(p.type)) ?? false;
      _cats.add(isRestaurant ? Cat.restaurants : isFacility ? Cat.facilities : Cat.shows);
      _appliedFocus = null;
    }
    if (widget.spot != null && b != null) {
      final parts = widget.spot!.split(':');
      final type = parts.first, id = parts.length > 1 ? parts[1] : '';
      var target = id;
      var cat = Cat.shows;
      if (type == 'restaurant') {
        cat = Cat.restaurants;
      } else if (type == 'shop') {
        target = b.shops.where((s) => s.id == id).firstOrNull?.poiId ?? id;
        cat = Cat.facilities;
      } else if (type == 'attraction') {
        cat = Cat.shows;
      } else {
        // A generic "poi" code: the map editor's per-hotspot QR always encodes this, whatever the hotspot is.
        final poi = b.pois.where((p) => p.id == id).firstOrNull;
        if (poi?.type == 'RESTAURANT') {
          target = b.restaurants.where((r) => r.poiId == id).firstOrNull?.id ?? id;
          cat = Cat.restaurants;
        } else if (poi?.type == 'ATTRACTION') {
          target = b.attractions.where((a) => a.poiId == id).firstOrNull?.id ?? id;
          cat = Cat.shows;
        } else {
          cat = Cat.facilities;
        }
      }
      _cats.add(cat);
      _pendingSpot = target;
    }
  }

  void _measureImage(String? url) {
    if (url == _measuredUrl) return;
    _measuredUrl = url;
    if (url == null) {
      _imgAspect = 0;
      return;
    }
    final stream = kImageProvider(url).resolve(const ImageConfiguration());
    late ImageStreamListener l;
    l = ImageStreamListener((info, _) {
      stream.removeListener(l);
      if (mounted && _measuredUrl == url) setState(() => _imgAspect = info.image.width / info.image.height);
    }, onError: (_, _) => stream.removeListener(l));
    stream.addListener(l);
  }

  // ----------------------------------------------------------------- build

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final dark = context.isDark;
    final sync = context.watch<SyncState>();
    final bundle = sync.bundle;
    final favs = context.watch<FavoritesState>().ids;
    final gps = context.watch<LocationState>().gps;
    final top = MediaQuery.paddingOf(context).top;
    final cfg = bundle?.mapConfig;
    final mapImageUrl = (bundle?.defaultMap?.imageUrl?.isNotEmpty ?? false) ? bundle!.defaultMap!.imageUrl : (cfg?.mapImageUrl?.isNotEmpty ?? false) ? cfg!.mapImageUrl : null;
    final mapBg = parseHex(bundle?.defaultMap?.bgColor, _grass);
    final maxScale = math.min(maxScaleCeiling, cfg?.maxZoom ?? 8);
    final markerColor = parseHex(cfg?.markerColor, const Color(0xFF1A73E8));
    final popupAnim = cfg?.popupAnimation ?? 'scale';
    final cpal = dark ? (card: c.card, ink: Colors.white, muted: const Color(0xFFCFD8EA)) : (card: c.card, ink: c.text, muted: c.sub);

    return LayoutBuilder(builder: (context, box) {
      final vp = Size(box.maxWidth, box.maxHeight);
      if (vp != _vp) {
        _vp = vp;
        WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? setState(() {}) : null);
      }
      _measureImage(mapImageUrl);
      final fit = _fit;
      final pois = bundle?.pois ?? <Poi>[];
      final poiById = {for (final p in pois) p.id: p};

      Offset toXY(double lat, double lng) => Offset(
            (lng - parkBounds.minLng) / (parkBounds.maxLng - parkBounds.minLng) * fit.width,
            (parkBounds.maxLat - lat) / (parkBounds.maxLat - parkBounds.minLat) * fit.height,
          );
      bool inBounds(double lat, double lng) => lat >= parkBounds.minLat && lat <= parkBounds.maxLat && lng >= parkBounds.minLng && lng <= parkBounds.maxLng;

      // The soonest still-to-come session per attraction.
      final ref = (sync.date == ukTodayStr() ? ukNow() : DateTime.parse('${sync.date}T00:00:00.000Z')).millisecondsSinceEpoch;
      final nextBy = <String, String>{};
      for (final s in bundle?.sessions ?? <Session>[]) {
        if (DateTime.parse(s.endTime).millisecondsSinceEpoch <= ref) continue;
        final t = s.revisedStart ?? s.startTime;
        final cur = nextBy[s.attractionId];
        if (cur == null || DateTime.parse(t).isBefore(DateTime.parse(cur))) nextBy[s.attractionId] = t;
      }

      // ---- pins
      final pins = <Pin>[];
      if (_cats.contains(Cat.restaurants)) {
        for (final r in bundle?.restaurants ?? <Restaurant>[]) {
          final poi = r.poiId == null ? null : poiById[r.poiId];
          if (poi == null) continue;
          final p = toXY(poi.lat, poi.lng);
          pins.add(Pin(id: r.id, x: p.dx, y: p.dy, lat: poi.lat, lng: poi.lng, slug: r.slug, image: poi.image, kind: PinKind.restaurant, emoji: '🍴', title: r.name, subtitle: r.cuisine, zone: poi.mapZone));
        }
      }
      if (_cats.contains(Cat.facilities)) {
        for (final poi in pois) {
          final def = facilityTypes[poi.type];
          if (def == null) continue; // attractions and restaurants have their own filters
          final p = toXY(poi.lat, poi.lng);
          pins.add(Pin(id: poi.id, x: p.dx, y: p.dy, lat: poi.lat, lng: poi.lng, image: poi.image, kind: PinKind.facility, emoji: (poi.icon ?? '').isNotEmpty ? poi.icon : def.emoji, color: parseHex(poi.color, Color(def.color)), title: poi.name, subtitle: poi.type.replaceAll('_', ' ').toLowerCase(), zone: poi.mapZone));
        }
      }
      final showAll = _cats.contains(Cat.shows), showFavs = _cats.contains(Cat.favorites);
      if (showAll || showFavs) {
        final day = (bundle?.attractions ?? <Attraction>[]).where((a) => a.category != 'EVENING_SHOW').toList();
        for (var i = 0; i < day.length; i++) {
          final a = day[i];
          if (a.poiId == null) continue;
          if (!showAll && showFavs && !favs.contains(a.id)) continue; // favourites-only filter
          final poi = poiById[a.poiId];
          if (poi == null) continue;
          final p = toXY(poi.lat, poi.lng);
          // Prefer the attraction's featured image so the admin's hero image drives the map pin.
          pins.add(Pin(id: a.id, attractionId: a.id, x: p.dx, y: p.dy, lat: poi.lat, lng: poi.lng, slug: a.slug, image: (a.heroImage ?? '').isNotEmpty ? a.heroImage : poi.image, kind: PinKind.show, number: i + 1, title: a.name, subtitle: a.tagline, nextTime: nextBy[a.id], zone: poi.mapZone));
        }
        final evening = (bundle?.attractions ?? <Attraction>[]).where((a) => a.category == 'EVENING_SHOW').firstOrNull;
        if (evening != null && evening.poiId != null && (showAll || favs.contains(evening.id))) {
          final poi = poiById[evening.poiId];
          if (poi != null) {
            final p = toXY(poi.lat, poi.lng);
            pins.add(Pin(id: evening.id, attractionId: evening.id, x: p.dx, y: p.dy, lat: poi.lat, lng: poi.lng, slug: evening.slug, image: (evening.heroImage ?? '').isNotEmpty ? evening.heroImage : poi.image, kind: PinKind.evening, emoji: '🌙', title: evening.name, subtitle: evening.tagline, nextTime: nextBy[evening.id], zone: poi.mapZone));
          }
        }
      }

      // The selected pin's current position (it re-projects when the map changes).
      final dp = _displayPin;
      final selPin = dp == null ? null : (pins.where((p) => p.id == dp.id).firstOrNull ?? dp);

      // ---- clustering: pins group into their area (mapZone) and open into single pins as the guest zooms in.
      final zones = <String, List<Pin>>{};
      final loose = <Pin>[];
      for (final p in pins) {
        if (p.zone != null && p.zone!.isNotEmpty && p.id != dp?.id) {
          (zones[p.zone!] ??= []).add(p);
        } else {
          loose.add(p);
        }
      }
      final clusters = <Cluster>[];
      for (final e in zones.entries) {
        final zp = e.value;
        if (zp.length < 2) {
          loose.addAll(zp);
          continue;
        }
        final cx = zp.fold(0.0, (s, p) => s + p.x) / zp.length, cy = zp.fold(0.0, (s, p) => s + p.y) / zp.length;
        final r = zp.map((p) => math.sqrt(math.pow(p.x - cx, 2) + math.pow(p.y - cy, 2))).reduce(math.max);
        if (r * _zoom <= areaOpenPx) {
          clusters.add(Cluster(cx, cy, zp, zone: e.key, r: r)); // closed: an area bubble
        } else {
          loose.addAll(zp); // opened: individual pins
        }
      }
      final thr = 44 / math.max(_zoom, 0.001);
      for (final p in loose) {
        var placed = false;
        if (p.id != dp?.id) {
          for (final cl in clusters) {
            if (cl.zone != null || (cl.pins.length == 1 && cl.pins.first.id == dp?.id)) continue;
            final dx = cl.x - p.x, dy = cl.y - p.y;
            if (dx * dx + dy * dy <= thr * thr) {
              cl.pins.add(p);
              cl.x += (p.x - cl.x) / cl.pins.length;
              cl.y += (p.y - cl.y) / cl.pins.length;
              placed = true;
              break;
            }
          }
        }
        if (!placed) clusters.add(Cluster(p.x, p.y, [p]));
      }

      void zoomToCluster(Cluster cl) {
        HapticFeedback.selectionClick();
        final need = cl.r != null ? (areaOpenPx / cl.r!) * 1.15 : 0.0;
        final s = math.min(maxScale, math.max(math.max(_zoom * 1.9, 2.4), need));
        _goTo(Offset(cl.x, cl.y), s, maxScale);
      }

      // ---- location
      final locationReal = gps != null && inBounds(gps.lat, gps.lng);
      final entrance = pois.where((p) => p.type == 'ENTRANCE').firstOrNull;
      Geo? parkCenter;
      if (pois.isNotEmpty) parkCenter = Geo(pois.fold(0.0, (s, p) => s + p.lat) / pois.length, pois.fold(0.0, (s, p) => s + p.lng) / pois.length);
      final distToPark = gps != null && parkCenter != null ? distMeters(gps, parkCenter) : null;
      final showMe = distToPark != null && distToPark <= halfMileM;
      final Offset youAreHere = locationReal ? toXY(gps.lat, gps.lng) : entrance != null ? toXY(entrance.lat, entrance.lng) : Offset(_vp.width / 2, _vp.height * 0.7);

      // ---- route: the guest → nearest spot → … → destination, following the path network (not a straight line)
      final routeNodes = [for (final p in pois) Geo(p.lat, p.lng)];
      List<Offset>? routePoints;
      double? routeMeters;
      final sel = _selected;
      if (sel != null && sel.lat != null && locationReal && routeNodes.length >= 2) {
        final target = Geo(sel.lat!, sel.lng!);
        final s = nearestNode(routeNodes, gps), g = nearestNode(routeNodes, target);
        final nodePath = s == g ? [g] : dijkstra(buildPoiGraph(routeNodes), routeNodes, s, g);
        if (s >= 0 && g >= 0 && nodePath != null) {
          final pts = [youAreHere, for (final i in nodePath) toXY(routeNodes[i].lat, routeNodes[i].lng)];
          if ((pts.last - Offset(sel.x, sel.y)).distance > 2) pts.add(Offset(sel.x, sel.y));
          var meters = distMeters(gps, routeNodes[s]);
          for (var i = 0; i < nodePath.length - 1; i++) {
            meters += distMeters(routeNodes[nodePath[i]], routeNodes[nodePath[i + 1]]);
          }
          meters += distMeters(routeNodes[g], target);
          routePoints = pts;
          routeMeters = meters;
        }
      }
      final selectedDist = routeMeters;

      // ---- search + near you
      final searchIndex = [
        for (final a in bundle?.attractions ?? <Attraction>[]) (id: a.id, name: a.name, kind: Cat.shows, sub: a.category == 'EVENING_SHOW' ? 'Evening show' : 'Show'),
        for (final r in bundle?.restaurants ?? <Restaurant>[]) (id: r.id, name: r.name, kind: Cat.restaurants, sub: r.cuisine ?? 'Restaurant'),
        for (final p in pois) if (facilityTypes.containsKey(p.type)) (id: p.id, name: p.name, kind: Cat.facilities, sub: p.type.replaceAll('_', ' ').toLowerCase()),
      ];
      final q = _searchCtl.text.trim().toLowerCase();
      final searchResults = q.isEmpty ? [] : searchIndex.where((s) => s.name.toLowerCase().contains(q)).take(6).toList();

      final nearby = <({String id, Cat kind, String title, String? zone, double? dist})>[];
      void addNear(String id, Cat kind, String title, String? poiId) {
        final p = poiId == null ? null : poiById[poiId];
        if (p == null) return;
        nearby.add((id: id, kind: kind, title: title, zone: p.mapZone, dist: locationReal ? distMeters(gps, Geo(p.lat, p.lng)) : null));
      }
      for (final a in bundle?.attractions ?? <Attraction>[]) {
        addNear(a.id, Cat.shows, a.name, a.poiId);
      }
      for (final r in bundle?.restaurants ?? <Restaurant>[]) {
        addNear(r.id, Cat.restaurants, r.name, r.poiId);
      }
      nearby.sort((a, b) => a.dist != null && b.dist != null ? a.dist!.compareTo(b.dist!) : 0);
      final nearList = nearby.take(12).toList();

      void goToResult(String id, Cat kind) {
        setState(() {
          _cats.add(kind);
          _pendingSelect = id;
          _searchCtl.clear();
        });
        FocusScope.of(context).unfocus();
      }

      // ---- post-frame work: the opening view, and pending selections once the pins exist
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _vp.isEmpty) return;
        final ready = mapImageUrl == null || _imgAspect > 0;
        if (!_appliedInitial && cfg != null && ready) {
          _appliedInitial = true;
          // A deep link owns the opening view, so the initial view never overrides the focus.
          if (widget.focus == null && widget.spot == null) {
            final z = _clampScale(cfg.initialZoom ?? 2, maxScale);
            final cp = cfg.centerLat != null && cfg.centerLng != null ? toXY(cfg.centerLat!, cfg.centerLng!) : Offset(fit.width / 2, fit.height / 2);
            _goTo(cp, z, maxScale, angle: 0, animate: false);
          }
        }
        if (!ready) return;
        if (_pendingSelect != null) {
          final pin = pins.where((p) => p.id == _pendingSelect).firstOrNull;
          if (pin != null) {
            _pendingSelect = null;
            _select(pin);
            _focusPin(pin, 3.4, maxScale);
          }
        }
        if (_pendingSpot != null) {
          final pin = pins.where((p) => p.id == _pendingSpot || p.attractionId == _pendingSpot).firstOrNull;
          if (pin != null) {
            _pendingSpot = null;
            _select(pin);
            _focusPin(pin, 3.4, maxScale);
          }
        }
        if (widget.focus != null && _appliedFocus != widget.focus) {
          final pin = pins.where((p) => p.id == widget.focus).firstOrNull;
          if (pin != null) {
            _appliedFocus = widget.focus;
            _select(pin);
            _focusPin(pin, 3.4, maxScale);
          }
        }
      });

      void openDetail() {
        final s = _selected;
        if (s == null) return;
        if (s.kind == PinKind.restaurant && s.slug != null) {
          context.push('/restaurant/${s.slug}');
          return;
        }
        if ((s.kind == PinKind.show || s.kind == PinKind.evening) && s.slug != null) {
          context.push('/attraction/${s.slug}');
          return;
        }
        if (s.kind == PinKind.facility) {
          // A shop placed on the map opens its shop page; other facilities open the facility page.
          final shop = bundle?.shops.where((x) => x.poiId == s.id).firstOrNull;
          context.push(shop != null ? '/shop/${shop.slug}' : '/facility/${s.id}');
        }
      }

      void zoomBy(double next) {
        final s = _clampScale(double.parse(next.toStringAsFixed(2)), maxScale);
        // With a place selected, the buttons zoom around ITS spot so the pin (and its popup) never appears to jump.
        if (selPin != null) {
          _zoomKeeping(selPin.x, selPin.y, s, maxScale, ms: 160);
        } else {
          // otherwise around the centre of the screen
          final mid = Offset(_vp.width / 2, _vp.height / 2);
          _goTo(viewToContent(_view.value, mid), s, maxScale, screen: mid, ms: 160);
        }
      }

      // ----------------------------------------------------------- widgets

      Widget markers() {
        final items = <Widget>[];
        for (final cl in clusters) {
          if (cl.zone != null) {
            items.add(Anchored(controller: _view, x: cl.x, y: cl.y, width: 130, height: 76, anchorX: 65, anchorY: 23, child: Align(alignment: Alignment.topCenter, child: AreaBubble(count: cl.pins.length, zone: cl.zone!, onTap: () => zoomToCluster(cl)))));
          } else if (cl.pins.length == 1) {
            final pin = cl.pins.first;
            items.add(Anchored(controller: _view, x: pin.x, y: pin.y, width: 60, height: 66, anchorX: 30, anchorY: 44, child: PinMarker(pin: pin, selected: _selected?.id == pin.id, onTap: () => _select(pin))));
          } else {
            items.add(Anchored(controller: _view, x: cl.x, y: cl.y, width: 40, height: 40, anchorX: 20, anchorY: 20, child: CountBubble(count: cl.pins.length, onTap: () => zoomToCluster(cl))));
          }
        }
        return Stack(clipBehavior: Clip.none, children: items);
      }

      Widget callout() {
        final pin = selPin!;
        final flipDown = _screenOf(Offset(pin.x, pin.y)).dy < 210; // not enough room above: flip below the pin
        const h = calloutH + 11;
        return AnimatedBuilder(
          animation: Listenable.merge([_view, _popupIn]),
          builder: (_, _) {
            final t = Curves.easeOut.transform(_popupIn.value);
            final scaleEntrance = popupAnim == 'scale' || popupAnim == 'bounce';
            final pop = _selected != null ? (scaleEntrance ? (popupAnim == 'bounce' ? Curves.easeOutBack.transform(_popupIn.value) : t) : 1.0) : t; // exit always shrinks back into the pin
            final s = math.max(0.001, pop) / _scale;
            final anchorY = flipDown ? -50.0 : h + 50;
            final opacity = popupAnim == 'none' ? 1.0 : popupAnim == 'fade' ? t : math.min(1.0, t * 1.6);
            final dy = popupAnim == 'slide' ? (1 - t) * 20 : 0.0;
            return Positioned(
              left: pin.x - calloutW / 2,
              top: pin.y - anchorY,
              width: calloutW,
              height: h,
              child: Transform(
                // upright and at a steady size, however the map is turned or zoomed
                transform: Matrix4.identity()
                  ..scaleByDouble(s, s, 1, 1)
                  ..rotateZ(-_angle),
                alignment: Alignment(0, anchorY / h * 2 - 1),
                child: Opacity(opacity: opacity.clamp(0.0, 1.0), child: Transform.translate(offset: Offset(0, dy), child: Callout(pin: pin, distance: selectedDist, flipDown: flipDown, card: cpal.card, ink: cpal.ink, muted: cpal.muted, onOpen: openDetail, onClose: _dismissPopup))),
              ),
            );
          },
        );
      }

      final canvas = SizedBox(
        width: fit.width,
        height: fit.height,
        child: Stack(clipBehavior: Clip.none, children: [
          if (mapImageUrl != null) Positioned.fill(child: KImage(mapImageUrl, fit: BoxFit.fill, cacheWidth: 3072)),
          // Tapping the map background (not a pin) dismisses the popup and closes lists.
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: () {
                _dismissPopup();
                FocusScope.of(context).unfocus();
              },
              onDoubleTapDown: (d) => _lastDoubleTap = d.localPosition,
              onDoubleTap: () {
                final p = _lastDoubleTap;
                if (p == null) return;
                final target = math.min(maxScale, _scale * 1.8);
                if (target > _scale + 0.001) _zoomKeeping(p.dx, p.dy, target, maxScale, ms: 180);
              },
            ),
          ),
          if (_selected != null && routePoints != null) Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: RoutePainter(routePoints)))),
          markers(),
          if (selPin != null) callout(),
          if (showMe) Anchored(controller: _view, x: youAreHere.dx, y: youAreHere.dy, width: 60, height: 60, anchorX: 30, anchorY: 30, child: IgnorePointer(child: Beacon(pulse: _pulse, color: markerColor))),
        ]),
      );

      final fade = math.min(_vp.width, _vp.height) * 0.16;
      Widget edgeFade(bool topEdge) => Positioned(
            top: topEdge ? 0 : null,
            bottom: topEdge ? null : 0,
            left: 0,
            right: 0,
            height: fade,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(gradient: LinearGradient(begin: topEdge ? Alignment.topCenter : Alignment.bottomCenter, end: topEdge ? Alignment.bottomCenter : Alignment.topCenter, colors: [mapBg, mapBg.withValues(alpha: 0)])),
              ),
            ),
          );

      Widget roundBtn(Widget icon, String label, VoidCallback onTap, {double size = 44}) => Tap(
            onTap: onTap,
            label: label,
            child: Container(width: size, height: size, decoration: BoxDecoration(color: c.card, shape: BoxShape.circle, boxShadow: softShadow(dark)), child: Center(child: icon)),
          );

      Widget listCard(List<Widget> rows) => Container(
            margin: const EdgeInsets.only(top: 8),
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(20), boxShadow: const [BoxShadow(color: Color(0x293B2A14), blurRadius: 18, offset: Offset(0, 8))]),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
          );

      Widget listRow(String name, String sub, VoidCallback onTap) => Tap(
            onTap: onTap,
            label: name,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: c.line, width: 0.5))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.text)),
                Padding(padding: const EdgeInsets.only(top: 1), child: Text(sub, style: TextStyle(fontSize: 12, color: c.sub))),
              ]),
            ),
          );

      final listOpen = _nearOpen || (_searchOpen && q.isNotEmpty);
      final locationBanner = !locationReal && !_bannerDismissed;

      return Container(
        clipBehavior: Clip.hardEdge,
        decoration: BoxDecoration(color: mapBg),
        child: Stack(fit: StackFit.expand, children: [
          RotatableViewer(
            controller: _view,
            constrain: _constrain,
            minScale: minScale,
            maxScale: maxScale,
            onInteract: () => _viewAnim.stop(),
            child: canvas,
          ),
          // Edge-fade vignette, only at the default view (hidden once the guest zooms in or turns the map).
          if (mapImageUrl != null && !_rotated && _zoom <= (cfg?.initialZoom ?? 2) + 0.001) ...[edgeFade(true), edgeFade(false)],
          if (locationBanner)
            Positioned(
              top: top + 78,
              left: 14,
              right: 66,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                decoration: BoxDecoration(color: const Color(0xEB0F0F0F), borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  const Text('📱', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 12),
                  Expanded(child: Text(gps != null ? 'You seem to be outside the park' : 'Turn on location to see where you are and how far things are', style: const TextStyle(color: Color(0xFFF0A8A8), fontSize: 14, fontWeight: FontWeight.w600))),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: () => setState(() {
                      _outsideBannerDismissed = true;
                      _bannerDismissed = true;
                    }),
                    child: const Text('✕', style: TextStyle(color: Color(0xFFF0A8A8), fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
            ),
          if (_cats.contains(Cat.favorites) && pins.isEmpty)
            Positioned(
              bottom: 300,
              left: 24,
              right: 24,
              child: IgnorePointer(
                child: Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xF7FFFFFF), borderRadius: BorderRadius.circular(12), boxShadow: const [BoxShadow(color: Color(0x2E000000), blurRadius: 8, offset: Offset(0, 3))]), child: const Text('No favourites yet — open a show and tap ♡ to add it here.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF2B2118), fontWeight: FontWeight.w600, fontSize: 13))),
              ),
            ),
          // While a list is open, a tap anywhere outside it closes it.
          if (listOpen)
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() {
                  _nearOpen = false;
                  _searchOpen = false;
                }),
                child: Semantics(label: 'Close the list', button: true, child: const SizedBox.expand()),
              ),
            ),
          // Floating controls: menu, search and scan sit straight on the map, so nothing covers it.
          Positioned(
            top: top + 10,
            left: 12,
            right: 12,
            child: Column(children: [
              Row(children: [
                roundBtn(Icon(Icons.menu_rounded, color: c.text, size: 24), 'Open menu', () => context.push('/menu'), size: 54),
                const SizedBox(width: 10),
                Expanded(
                  child: SearchPill(
                    placeholder: 'Find attractions',
                    controller: _searchCtl,
                    onChanged: (t) => setState(() {
                      _searchOpen = true;
                      if (t.isNotEmpty) _nearOpen = false;
                    }),
                    onFilter: () => setState(() {
                      _searchCtl.clear();
                      _nearOpen = !_nearOpen;
                    }),
                    filterIcon: Icons.explore_outlined,
                    filterLabel: _nearOpen ? 'Hide places near you' : 'Show places near you',
                  ),
                ),
                const SizedBox(width: 10),
                roundBtn(Icon(Icons.qr_code_scanner_rounded, color: c.text, size: 22), 'Scan a QR code', () => context.push('/scan'), size: 54),
              ]),
              if (_nearOpen && q.isEmpty)
                listCard([
                  Padding(padding: const EdgeInsets.fromLTRB(18, 14, 18, 4), child: Text(locationReal ? 'NEAR YOU' : 'AROUND THE PARK', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: c.sub))),
                  if (nearList.isEmpty)
                    Padding(padding: const EdgeInsets.all(16), child: Text('Nothing to show yet', style: TextStyle(fontSize: 13, color: c.sub)))
                  else
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 330),
                      child: ListView(
                        shrinkWrap: true,
                        padding: EdgeInsets.zero,
                        children: [
                          for (final n in nearList)
                            listRow(n.title, n.dist != null ? fmtDist(n.dist!) : (n.zone ?? 'Kynren'), () {
                              setState(() => _nearOpen = false);
                              goToResult(n.id, n.kind);
                            }),
                        ],
                      ),
                    ),
                ]),
              if (_searchOpen && q.isNotEmpty)
                listCard([
                  if (searchResults.isEmpty)
                    Padding(padding: const EdgeInsets.all(16), child: Text('No matches', style: TextStyle(fontSize: 13, color: c.sub)))
                  else
                    for (final r in searchResults) listRow(r.name, r.sub, () => goToResult(r.id, r.kind)),
                ]),
            ]),
          ),
          // Zoom + locate controls
          Positioned(
            top: top + 150,
            right: 16,
            child: Column(children: [
              // appears once the map is turned; tap to point it north again
              AnimatedBuilder(
                animation: _view,
                builder: (_, _) {
                  final a = _angle;
                  if (a.abs() < 0.005) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: roundBtn(Transform.rotate(angle: a, child: const Icon(Icons.navigation_rounded, color: Tokens.accent, size: 22)), 'Point the map north', () => _goTo(viewToContent(_view.value, Offset(_vp.width / 2, _vp.height / 2)), _scale, maxScale, angle: 0)),
                  );
                },
              ),
              roundBtn(Text('＋', style: TextStyle(fontFamily: Tokens.display, fontSize: 17.5, fontWeight: FontWeight.w700, color: c.text)), 'Zoom in', () => zoomBy(_scale + 0.4)),
              const SizedBox(height: 10),
              roundBtn(Text('－', style: TextStyle(fontFamily: Tokens.display, fontSize: 17.5, fontWeight: FontWeight.w700, color: c.text)), 'Zoom out', () => zoomBy(_scale - 0.4)),
              const SizedBox(height: 10),
              roundBtn(Icon(Icons.map_outlined, color: c.link, size: 20), 'Show the whole park', () => _goTo(Offset(fit.width / 2, fit.height / 2), 1, maxScale, angle: 0)),
              const SizedBox(height: 10),
              roundBtn(Icon(Icons.my_location_rounded, color: c.link, size: 20), 'Centre on my location', () => _goTo(youAreHere, 2, maxScale)),
            ]),
          ),
          // "Tap the map to explore" hint, until the guest opens something
          if (_selected == null && !_hintDismissed && _hintVisible)
            Positioned(
              top: top + 78,
              left: 0,
              right: 0,
              child: Center(
                child: Tap(
                  onTap: () => setState(() => _hintDismissed = true),
                  child: Container(padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 16), decoration: BoxDecoration(color: const Color(0xE6111111), borderRadius: BorderRadius.circular(8)), child: const Text('TAP THE MAP TO EXPLORE', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 0.6))),
                ),
              ),
            ),
          // Walk-time pill when a destination is selected
          if (_selected != null && selectedDist != null)
            Positioned(
              left: 14,
              bottom: navClearance + 38,
              child: IgnorePointer(
                child: Container(padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 16), decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(999), boxShadow: const [BoxShadow(color: Color(0x2E000000), blurRadius: 5, offset: Offset(0, 2))]), child: Text('🚶 ${walkMins(selectedDist)} min walk', style: TextStyle(color: c.text, fontWeight: FontWeight.w800, fontSize: 13))),
              ),
            ),
          // Bottom: the layer filters
          Positioned(
            left: 0,
            right: 0,
            bottom: navClearance - 16,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                for (final p in pills)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Tap(
                      onTap: () {
                        HapticFeedback.selectionClick();
                        setState(() => _cats.contains(p.key) ? _cats.remove(p.key) : _cats.add(p.key));
                        _dismissPopup();
                      },
                      label: p.label,
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 16),
                        decoration: BoxDecoration(color: _cats.contains(p.key) ? c.primary : c.card, borderRadius: BorderRadius.circular(999), boxShadow: softShadow(dark)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Text(p.emoji, style: TextStyle(fontSize: 15, color: _cats.contains(p.key) ? Colors.white : c.text)),
                          const SizedBox(width: 6),
                          Text(p.label, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: _cats.contains(p.key) ? Colors.white : c.text)),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ),
          ),
        ]),
      );
    });
  }

  Offset? _lastDoubleTap;
}
