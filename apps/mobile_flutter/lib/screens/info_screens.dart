import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/shuttle_logic.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/empty_state.dart';
import '../ui/minute_tick.dart';
import '../ui/screen.dart';
import '../ui/skeleton.dart';
import '../ui/tap.dart';

typedef _Json = Map<String, dynamic>;

// ---------------------------------------------------------------- Orders

const _statusLabel = {
  'PENDING': 'Order received',
  'PREPARING': 'Being prepared',
  'READY': 'Ready to collect',
  'COLLECTED': 'Collected',
  'CANCELLED': 'Cancelled',
};

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<_Json> _orders = [];
  io.Socket? _socket;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (context.read<AuthState>().user == null) {
        context.replace('/auth');
        return;
      }
      _load();
    });
    // Live status: when the kitchen advances an order, update it.
    // Its own connection: disposing it must not close the app's shared one.
    final socket = io.io(apiUrl, io.OptionBuilder().setTransports(['websocket']).enableForceNew().build());
    _socket = socket;
    socket.onConnect((_) => socket.emit('join', {}));
    socket.on('order.updated', (e) {
      final m = e as Map;
      if (!mounted) return;
      setState(() => _orders = [for (final o in _orders) o['id'] == m['id'] ? {...o, 'status': m['status']} : o]);
    });
  }

  @override
  void dispose() {
    _socket?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await api('/orders') as List;
      if (mounted) setState(() => _orders = list.cast<_Json>());
    } catch (_) {
      // offline: keep what we have
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final colors = {'PENDING': c.sub, 'PREPARING': Tokens.warn, 'READY': Tokens.ok, 'COLLECTED': c.sub, 'CANCELLED': Tokens.danger};
    return KScreen(
      title: 'My orders',
      subtitle: 'Follow your food from kitchen to collection',
      page: 'orders',
      colors: featureGradient['restaurants'],
      onRefresh: _load,
      children: [
        if (_orders.isEmpty)
          const EmptyState(icon: Icons.receipt_long_rounded, title: 'No orders yet', body: 'Order ahead from the Restaurants tab and follow it here, from kitchen to collection.'),
        for (final o in _orders)
          KCard(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text((o['restaurant'] as _Json)['name'] as String, maxLines: 2, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: c.text))),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                  decoration: BoxDecoration(color: colors[o['status']] ?? c.sub, borderRadius: BorderRadius.circular(999)),
                  child: Text(_statusLabel[o['status']] ?? _statusLabel['PENDING']!, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700)),
                ),
              ]),
              const SizedBox(height: 4),
              Text('Pickup at ${fmtTimeUK(DateTime.parse(o['pickupSlot'] as String))}', style: TextStyle(fontSize: 14, color: c.sub)),
              for (final it in o['items'] as List)
                Padding(padding: const EdgeInsets.only(top: 4), child: Text('${(it as _Json)['quantity']}× ${(it['menuItem'] as _Json)['name']}', style: TextStyle(fontSize: 14.5, color: c.text))),
              Padding(padding: const EdgeInsets.only(top: 10), child: Text(poundsFromCents((o['totalCents'] as num).toInt()), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: c.link))),
            ]),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------- Accessibility

const _prefOptions = [
  ('wheelchair', 'Wheelchair user', 'Prioritise step-free routes and wheelchair-accessible attractions.', Icons.accessible_rounded),
  ('visual', 'Low vision / blind', 'Highlight attractions with audio description.', Icons.hearing_rounded),
  ('hearing', 'Deaf / hard of hearing', 'Highlight attractions with captioning or BSL.', Icons.closed_caption_rounded),
  ('sensory', 'Sensory sensitivities', 'Surface sensory notes (noise, lighting, crowds) for each attraction.', Icons.volume_down_rounded),
];

class AccessibilityScreen extends StatefulWidget {
  const AccessibilityScreen({super.key});
  @override
  State<AccessibilityScreen> createState() => _AccessibilityScreenState();
}

class _AccessibilityScreenState extends State<AccessibilityScreen> {
  Map<String, bool> _prefs = {};
  String? _loadedFor;

  void _load(AuthUser? user) {
    if (user == null || _loadedFor == user.id) return;
    _loadedFor = user.id;
    api('/me').then((me) {
      final p = (me as Map)['accessibilityPrefs'] as Map?;
      if (mounted) setState(() => _prefs = {for (final e in (p ?? {}).entries) e.key as String: e.value == true});
    }).catchError((_) {});
  }

  Future<void> _toggle(String key) async {
    final next = !(_prefs[key] ?? false);
    setState(() => _prefs = {..._prefs, key: next});
    try {
      await api('/me/accessibility', method: 'PATCH', body: {key: next});
    } catch (_) {
      if (mounted) setState(() => _prefs = {..._prefs, key: !next}); // revert on failure
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final user = context.watch<AuthState>().user;
    _load(user);
    final attractions = bundle?.attractions ?? <Attraction>[];
    final accessible = attractions.where((a) => a.wheelchairAccessible).length;
    final audio = attractions.where((a) => a.hasAudioDescription).length;
    final captioned = attractions.where((a) => a.hasCaptioning || a.hasBSL).length;
    final facilities = (bundle?.pois ?? <Poi>[]).where((p) => p.type == 'ACCESSIBILITY').toList();

    Widget title(String t) => Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(t, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.text)));

    return KScreen(
      title: 'Accessibility',
      subtitle: 'Your preferences and step-free information',
      page: 'accessibility',
      children: [
        if (user != null)
          KCard(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              title('My preferences'),
              for (final o in _prefOptions)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line, width: 0.5))),
                  child: Row(children: [
                    Container(
                      width: 38,
                      height: 38,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(12)),
                      child: Icon(o.$4, size: 20, color: c.link),
                    ),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(o.$2, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.text)),
                        Padding(padding: const EdgeInsets.only(top: 2), child: Text(o.$3, style: TextStyle(fontSize: 12.5, height: 17 / 12.5, color: c.sub))),
                      ]),
                    ),
                    Switch(value: _prefs[o.$1] ?? false, onChanged: (_) => _toggle(o.$1), activeTrackColor: c.primary, activeThumbColor: Colors.white),
                  ]),
                ),
            ]),
          )
        else
          KCard(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              Icon(Icons.lock_outline_rounded, size: 20, color: c.link),
              const SizedBox(width: 12),
              Expanded(child: Text('Sign in to save your accessibility preferences.', style: TextStyle(fontSize: 14, height: 20 / 14, color: c.sub))),
              Tap(onTap: () => context.push('/auth'), child: Text('Sign in', style: TextStyle(fontWeight: FontWeight.w800, color: c.link))),
            ]),
          ),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          title('Around the park'),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _statTile(c, Icons.accessible_rounded, accessible, 'step-free attraction${accessible == 1 ? '' : 's'}')),
            const SizedBox(width: 10),
            Expanded(child: _statTile(c, Icons.hearing_rounded, audio, 'with audio description')),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _statTile(c, Icons.closed_caption_rounded, captioned, 'with captions or BSL')),
            const SizedBox(width: 10),
            Expanded(child: _statTile(c, Icons.place_rounded, facilities.length, 'facilit${facilities.length == 1 ? 'y' : 'ies'} on the map')),
          ]),
        ]),
        if (facilities.isNotEmpty)
          KCard(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              title('Accessibility facilities'),
              for (final f in facilities)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line, width: 0.5))),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(f.name, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.text)),
                    if ((f.description ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(f.description!, style: TextStyle(fontSize: 12.5, height: 17 / 12.5, color: c.sub))),
                  ]),
                ),
            ]),
          ),
      ],
    );
  }
}

Widget _statTile(UIColors c, IconData icon, int n, String label) => KCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 20, color: c.link),
        const SizedBox(height: 10),
        Text('$n', style: TextStyle(fontSize: 26, height: 1, fontWeight: FontWeight.w800, color: c.text)),
        const SizedBox(height: 4),
        Text(label, style: TextStyle(fontSize: 12.5, height: 16 / 12.5, color: c.sub)),
      ]),
    );

// --------------------------------------------------------------- Shuttle

class ShuttleScreen extends StatefulWidget {
  const ShuttleScreen({super.key});
  @override
  State<ShuttleScreen> createState() => _ShuttleScreenState();
}

class _ShuttleScreenState extends State<ShuttleScreen> with MinuteTick<ShuttleScreen> {
  List<_Json>? _routes;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final r = await api('/shuttles') as List;
      if (mounted) setState(() => _routes = r.cast<_Json>());
    } catch (_) {
      if (mounted) setState(() => _routes ??= []);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final routes = _routes;
    final now = ukNow();
    return KScreen(
      title: 'Shuttle',
      subtitle: 'Timetable and stops',
      page: 'shuttle',
      onRefresh: _load,
      children: [
        if (routes == null) ...const [SkeletonRow(), SkeletonRow()]
        else if (routes.isEmpty)
          const EmptyState(icon: Icons.directions_bus_rounded, title: 'No shuttle routes yet', body: 'When the park sets up a shuttle, its stops and departure times will appear here.')
        else ...[
          Row(children: [
            Icon(Icons.schedule_rounded, size: 16, color: c.sub),
            const SizedBox(width: 8),
            Expanded(child: Text('A fixed timetable, not live bus tracking.', style: TextStyle(fontSize: 13, color: c.sub))),
          ]),
          for (final r in routes)
            KCard(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(12)),
                    child: Icon(Icons.directions_bus_rounded, size: 20, color: c.link),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Text(r['name'] as String, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.text))),
                ]),
                if (r['description'] != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(r['description'] as String, style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub))),
                const SizedBox(height: 6),
                for (final s in r['stops'] as List) _stop(c, s as _Json, now),
              ]),
            ),
        ],
      ],
    );
  }

  Widget _stop(UIColors c, _Json s, DateTime now) {
    final times = ((s['times'] as List?) ?? []).map((e) => '$e').toList();
    final next = nextDeparture(times, now);
    bool isNext(String t) => next != null && !next.tomorrow && t.trim() == next.time;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line, width: 0.5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(s['name'] as String, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.text))),
          if (next != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
              child: Text(next.tomorrow ? 'Next: ${next.time} tomorrow' : 'Next ${next.time} · ${untilText(next.minutes)}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: c.link)),
            ),
        ]),
        const SizedBox(height: 8),
        if (times.isEmpty)
          Text('No times set', style: TextStyle(fontSize: 13.5, color: c.sub))
        else
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final t in times)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: isNext(t) ? c.primary : c.soft, borderRadius: BorderRadius.circular(10)),
                child: Text(t, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: isNext(t) ? Colors.white : c.text)),
              ),
          ]),
      ]),
    );
  }
}
