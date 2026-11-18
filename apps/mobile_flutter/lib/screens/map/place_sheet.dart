import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../core/api.dart';
import '../../core/auth.dart';
import '../../core/calendar.dart';
import '../../core/eat_logic.dart';
import '../../core/favorites.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/restaurant_favs.dart';
import '../../core/shuttle_logic.dart';
import '../../core/sync.dart';
import '../../core/theme.dart';
import '../../ui/cover.dart';
import '../../ui/tap.dart';
import 'map_logic.dart';
import 'map_widgets.dart';

/// Sessions of other days, fetched once and kept for the rest of the app session.
final _dayCache = <String, List<Session>>{};

/// Which of the guest's "I did it" marks we already know about (shared with the detail page through the server).
Set<String>? _seenIds;

/// What was the number-and-pin callout is now a card that rises from the bottom, as in the big park apps: the place's picture and
/// name, what it is, three quick actions, and for a show its times today, tomorrow and the day after.
class PlaceSheet extends StatefulWidget {
  final Pin pin;

  /// Walking distance in metres when the guest's position is known.
  final double? distance;
  final VoidCallback onClose, onOpen, onGoTo;

  /// Room left at the bottom for the floating tab bar, which sits over the card.
  final double bottomInset;
  const PlaceSheet({super.key, required this.pin, required this.distance, required this.onClose, required this.onOpen, required this.onGoTo, this.bottomInset = 0});

  @override
  State<PlaceSheet> createState() => _PlaceSheetState();
}

class _PlaceSheetState extends State<PlaceSheet> {
  int _day = 0;
  String? _loadingDate;

  bool get _isShow => widget.pin.kind == PinKind.show || widget.pin.kind == PinKind.evening;
  bool get _isCar => widget.pin.id == parkedCarId;

  @override
  void initState() {
    super.initState();
    _loadSeen();
  }

  @override
  void didUpdateWidget(PlaceSheet old) {
    super.didUpdateWidget(old);
    if (old.pin.id != widget.pin.id) _day = 0;
  }

  String _dateOf(int offset) {
    final base = DateTime.parse('${ukTodayStr()}T00:00:00.000Z').add(Duration(days: offset));
    return DateFormat('yyyy-MM-dd').format(base);
  }

  Future<void> _loadSeen() async {
    if (_seenIds != null || context.read<AuthState>().user == null) return;
    try {
      final s = await api('/me/seen') as List;
      _seenIds = {for (final x in s) (x as Map)['attractionId'] as String};
      if (mounted) setState(() {});
    } catch (_) {/* the button just says "I did it" */}
  }

  /// The sessions of this show on day [offset] from today, once known: today's come with the bundle, the others are fetched.
  List<Session>? _sessions(int offset) {
    final date = _dateOf(offset);
    final sync = context.read<SyncState>();
    final id = widget.pin.attractionId;
    List<Session>? all;
    if (sync.date == date && sync.bundle != null) {
      all = sync.bundle!.sessions;
    } else {
      all = _dayCache[date];
      if (all == null && _loadingDate != date) {
        _loadingDate = date;
        api('/schedule?date=$date').then((r) {
          _dayCache[date] = [for (final j in r as List) Session.fromJson(j as Map<String, dynamic>)];
        }).catchError((_) {
          _dayCache[date] = <Session>[]; // offline: say "no times" rather than load forever
        }).whenComplete(() {
          if (mounted) setState(() => _loadingDate = null);
        });
      }
    }
    if (all == null) return null;
    return all.where((s) => s.attractionId == id).toList()..sort((a, b) => (a.revisedStart ?? a.startTime).compareTo(b.revisedStart ?? b.startTime));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final dark = context.isDark;
    final pin = widget.pin;
    final bundle = context.watch<SyncState>().bundle;
    final user = context.watch<AuthState>().user;
    final shows = context.watch<FavoritesState>();
    final eats = context.watch<RestaurantFavs>();
    final attraction = bundle?.attractions.where((a) => a.id == pin.attractionId).firstOrNull;
    final restaurant = pin.kind == PinKind.restaurant ? bundle?.restaurants.where((r) => r.id == pin.id).firstOrNull : null;
    final favorite = _isShow ? shows.ids.contains(pin.id) : eats.ids.contains(pin.id);
    final seen = _seenIds?.contains(pin.id) ?? false;

    final walk = widget.distance != null ? '${fmtDist(widget.distance!)} · ${walkMins(widget.distance!)} min walk' : null;
    final sub = _isShow && attraction != null && attraction.durationMins > 0
        ? '${attraction.durationMins} minutes'
        : _isCar
            ? (pin.subtitle ?? '')
            : (pin.subtitle ?? pin.zone ?? '');

    Future<void> markSeen() async {
      if (user == null) {
        context.push('/auth');
        return;
      }
      setState(() => _seenIds = {...?_seenIds, pin.id});
      try {
        await api('/me/seen', method: 'POST', body: {'attractionId': pin.id});
      } catch (_) {
        if (mounted) setState(() => _seenIds = {...?_seenIds}..remove(pin.id));
      }
    }

    final pills = <Widget>[
      _Pill(icon: Icons.directions_walk_rounded, label: 'Go to', onTap: widget.onGoTo),
      if (_isShow)
        _Pill(
          icon: favorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
          label: favorite ? 'Favourited' : 'Favourite',
          on: favorite,
          onTap: () => user == null ? context.push('/auth') : shows.toggle(pin.id),
        )
      else if (pin.kind == PinKind.restaurant)
        _Pill(icon: favorite ? Icons.favorite_rounded : Icons.favorite_border_rounded, label: favorite ? 'Favourited' : 'Favourite', on: favorite, onTap: () => eats.toggle(pin.id)),
      if (_isShow) _Pill(icon: Icons.check_rounded, label: seen ? 'Done' : 'I did it', on: seen, onTap: markSeen),
      if (pin.kind == PinKind.restaurant) _Pill(icon: Icons.restaurant_menu_rounded, label: 'Menu', onTap: widget.onOpen),
      if (_isCar) _Pill(icon: Icons.delete_outline_rounded, label: 'Forget spot', onTap: widget.onOpen),
    ];

    return GestureDetector(
      // a pull down on the card puts it away
      onVerticalDragEnd: (d) {
        if ((d.primaryVelocity ?? 0) > 280) widget.onClose();
      },
      child: Container(
        decoration: BoxDecoration(
          color: c.card,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: softShadow(dark, level: 2, up: true),
        ),
        child: SafeArea(
          top: false,
          bottom: false,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.52),
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(18, 10, 18, 14 + widget.bottomInset),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: c.line, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 12),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Tap(
                    onTap: widget.onOpen,
                    label: 'More about ${pin.title}',
                    child: Cover(
                      image: pin.image,
                      color: pinTint(pin),
                      icon: pin.kind == PinKind.restaurant ? Icons.restaurant_rounded : Icons.calendar_month_rounded,
                      height: 84,
                      width: 96,
                      radius: 16,
                      // the whole picture, whatever its shape (several are logos): a blurred copy fills what it leaves
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        MiniPin(pin: pin, height: 28),
                        const SizedBox(width: 8),
                        Expanded(child: Text(pin.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 18, height: 22 / 18, fontWeight: FontWeight.w800, color: c.text))),
                      ]),
                      if (sub.isNotEmpty || walk != null) ...[
                        const SizedBox(height: 8),
                        Row(children: [
                          Icon(_isShow ? Icons.schedule_rounded : Icons.place_outlined, size: 17, color: c.sub),
                          const SizedBox(width: 6),
                          Expanded(child: Text([if (sub.isNotEmpty) sub, ?walk].join('  ·  '), maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, height: 18 / 13.5, color: c.sub))),
                        ]),
                      ],
                    ]),
                  ),
                  const SizedBox(width: 4),
                  Tap(
                    onTap: widget.onClose,
                    label: 'Close',
                    child: Container(width: 34, height: 34, decoration: BoxDecoration(color: c.soft, shape: BoxShape.circle), child: Icon(Icons.close_rounded, size: 18, color: c.text)),
                  ),
                ]),
                const SizedBox(height: 14),
                Row(children: [for (var i = 0; i < pills.length; i++) ...[if (i > 0) const SizedBox(width: 8), pills[i]]]),
                if (_isShow) ..._showTimes(c) else if (restaurant != null) ..._eatStatus(c, restaurant) else if (pin.kind == PinKind.facility && !_isCar) ..._facilityInfo(c, bundle),
                if (!_isCar) ...[
                  const SizedBox(height: 6),
                  Tap(
                    onTap: widget.onOpen,
                    label: pin.hint ?? (pin.kind == PinKind.restaurant ? 'See the menu' : 'More information'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(children: [
                        Text(pin.hint ?? (pin.kind == PinKind.restaurant ? 'See the menu' : 'More information'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: c.link)),
                        const SizedBox(width: 4),
                        Icon(Icons.chevron_right_rounded, size: 20, color: c.link),
                      ]),
                    ),
                  ),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }

  // ------------------------------------------------------------ shows

  List<Widget> _showTimes(UIColors c) {
    final labels = ['Today', 'Tomorrow', DateFormat('EEEE').format(DateTime.parse('${_dateOf(2)}T00:00:00.000Z'))];
    final list = _sessions(_day);
    final nowMin = ukNow().hour * 60 + ukNow().minute;

    Widget status() {
      if (list == null) return Text('Loading times…', style: TextStyle(fontSize: 13.5, color: c.sub));
      if (list.isEmpty) return Text(_day == 0 ? 'No shows today' : 'No shows listed', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.sub));
      final live = list.where((s) => s.status != 'CANCELLED').toList();
      if (_day == 0) {
        int start(Session s) => minutesOfDay(fmtTime(s.revisedStart ?? s.startTime)) ?? 0;
        int end(Session s) => minutesOfDay(fmtTime(s.endTime)) ?? start(s);
        final onNow = live.where((s) => start(s) <= nowMin && nowMin < end(s)).firstOrNull;
        if (onNow != null) return _Dot(Tokens.ok, 'On now · started ${fmtTime(onNow.revisedStart ?? onNow.startTime)}');
        final next = live.where((s) => start(s) > nowMin).firstOrNull;
        if (next != null) return _Dot(Tokens.ok, 'Next show ${fmtTime(next.revisedStart ?? next.startTime)} · ${untilText(start(next) - nowMin)}');
        return const _Dot(Tokens.danger, 'Closed');
      }
      return _Dot(live.isEmpty ? Tokens.danger : Tokens.ok, live.isEmpty ? 'Cancelled' : '${live.length} show${live.length == 1 ? '' : 's'}');
    }

    return [
      const SizedBox(height: 14),
      Row(children: [
        for (var i = 0; i < 3; i++)
          Expanded(
            child: Tap(
              onTap: () => setState(() => _day = i),
              label: labels[i],
              child: Container(
                padding: const EdgeInsets.only(top: 6, bottom: 8),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: _day == i ? c.text : c.line, width: _day == i ? 2.5 : 1))),
                child: Text(labels[i], textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: _day == i ? FontWeight.w800 : FontWeight.w600, color: _day == i ? c.text : c.sub)),
              ),
            ),
          ),
      ]),
      const SizedBox(height: 12),
      status(),
      if (list != null && list.isNotEmpty) ...[
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 8, children: [for (final s in list) _TimeChip(session: s)]),
      ],
    ];
  }

  // ------------------------------------------------------- restaurants / places

  List<Widget> _eatStatus(UIColors c, Restaurant r) {
    final nowMin = ukNow().hour * 60 + ukNow().minute;
    final st = restaurantState(r, nowMin);
    final hours = parseHours(r.openingHours);
    return [
      const SizedBox(height: 14),
      if (st != null) _Dot(st.isOpen ? Tokens.ok : Tokens.danger, st.text) else Text('Opening hours not listed', style: TextStyle(fontSize: 13.5, color: c.sub)),
      if (hours != null) Padding(padding: const EdgeInsets.only(top: 4, left: 18), child: Text('Today ${hoursText(hours)}', style: TextStyle(fontSize: 13, color: c.sub))),
    ];
  }

  List<Widget> _facilityInfo(UIColors c, Bundle? bundle) {
    final poi = bundle?.pois.where((p) => p.id == widget.pin.id).firstOrNull;
    final desc = poi?.description ?? '';
    if (desc.isEmpty) return const [];
    return [
      const SizedBox(height: 12),
      Text(desc, maxLines: 4, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
    ];
  }
}

class _Pill extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool on;
  final VoidCallback onTap;
  const _Pill({required this.icon, required this.label, required this.onTap, this.on = false});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Expanded(
      child: Tap(
        onTap: onTap,
        label: label,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
          decoration: BoxDecoration(color: on ? c.tint : c.soft, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 18, color: on ? c.link : c.text),
            const SizedBox(width: 6),
            Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: on ? c.link : c.text))),
          ]),
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  final Color color;
  final String text;
  const _Dot(this.color, this.text);
  @override
  Widget build(BuildContext context) => Row(children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: color))),
      ]);
}

class _TimeChip extends StatelessWidget {
  final Session session;
  const _TimeChip({required this.session});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final cancelled = session.status == 'CANCELLED';
    final time = fmtTime(session.revisedStart ?? session.startTime);
    return Tap(
      label: 'Add $time to your calendar',
      onTap: cancelled ? null : () => addSessionToCalendar(session),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(time, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: cancelled ? Tokens.danger : c.link, decoration: cancelled ? TextDecoration.lineThrough : null)),
          if (session.status != 'SCHEDULED') ...[
            const SizedBox(width: 6),
            Container(width: 8, height: 8, decoration: BoxDecoration(color: statusColor[session.status], shape: BoxShape.circle)),
          ],
        ]),
      ),
    );
  }
}
