import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/api.dart';
import '../core/auth.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/screen.dart';

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
        if (_orders.isEmpty) Text('No orders yet. Order ahead from the Restaurants tab and track it here.', style: TextStyle(fontSize: 14, height: 20 / 14, color: c.sub)),
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
  ('wheelchair', 'Wheelchair user', 'Prioritise step-free routes and wheelchair-accessible attractions.'),
  ('visual', 'Low vision / blind', 'Highlight attractions with audio description.'),
  ('hearing', 'Deaf / hard of hearing', 'Highlight attractions with captioning or BSL.'),
  ('sensory', 'Sensory sensitivities', 'Surface sensory notes (noise, lighting, crowds) for each attraction.'),
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

    Widget stat(String t) => Padding(padding: const EdgeInsets.only(top: 8), child: Text(t, style: TextStyle(fontSize: 14, color: c.sub)));
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
          Text('Sign in to save your accessibility preferences.', style: TextStyle(color: c.sub, fontSize: 14.5)),
        KCard(
          padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            title('Around the park'),
            stat('$accessible wheelchair-accessible attraction${accessible == 1 ? '' : 's'}'),
            stat('$audio with audio description'),
            stat('$captioned with captioning or BSL'),
            stat('${facilities.length} accessibility facilit${facilities.length == 1 ? 'y' : 'ies'} marked on the map'),
          ]),
        ),
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

// --------------------------------------------------------------- Shuttle

class ShuttleScreen extends StatefulWidget {
  const ShuttleScreen({super.key});
  @override
  State<ShuttleScreen> createState() => _ShuttleScreenState();
}

class _ShuttleScreenState extends State<ShuttleScreen> {
  List<_Json>? _routes;

  @override
  void initState() {
    super.initState();
    api('/shuttles').then((r) {
      if (mounted) setState(() => _routes = (r as List).cast<_Json>());
    }).catchError((_) {
      if (mounted) setState(() => _routes = []);
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final routes = _routes;
    return KScreen(
      title: 'Shuttle',
      subtitle: 'Timetable and stops',
      page: 'shuttle',
      children: [
        Text('Scheduled departure times below — this is a fixed timetable, not live GPS tracking.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
        if (routes == null)
          Text('Loading…', style: TextStyle(color: c.sub))
        else if (routes.isEmpty)
          Text('No shuttle routes are set up yet.', style: TextStyle(color: c.sub))
        else
          for (final r in routes)
            KCard(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(r['name'] as String, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.text)),
                if (r['description'] != null) Padding(padding: const EdgeInsets.only(top: 2, bottom: 6), child: Text(r['description'] as String, style: TextStyle(fontSize: 13.5, color: c.sub))),
                for (final s in r['stops'] as List)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: c.line, width: 0.5))),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text((s as _Json)['name'] as String, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.text)),
                      const SizedBox(height: 2),
                      Text(((s['times'] as List?) ?? []).isNotEmpty ? (s['times'] as List).join(' · ') : 'No times set', style: TextStyle(fontSize: 13.5, color: c.sub)),
                    ]),
                  ),
              ]),
            ),
      ],
    );
  }
}
