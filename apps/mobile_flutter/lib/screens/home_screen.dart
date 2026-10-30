import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';
import '../app/shell.dart' show navClearance;
import '../core/api.dart';
import '../core/auth.dart';
import '../core/favorites.dart';
import '../core/eat_logic.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/offline.dart';
import '../core/preferences.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/cover.dart';
import '../ui/hero_art.dart';
import '../ui/kimage.dart';
import '../ui/managed_image.dart';
import '../ui/reveal.dart';
import '../ui/skeleton.dart';
import '../ui/status_bar.dart';
import '../ui/screen.dart';
import '../ui/show_widgets.dart';
import '../ui/tap.dart';

// Open-Meteo WMO weather codes, grouped to a small icon set.
const _weatherIcon = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 80: '🌦️', 81: '🌧️', 82: '⛈️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

// What Home shows when no layout has been saved in admin. A saved layout is honoured as it is;
// the sections it does not mention ('info', 'services') are added at the end, since an older layout predates them.
const _defaultSections = ['welcome', 'actions', 'info', 'services', 'announcement', 'alerts', 'visit', 'comingUp', 'favourites'];
const _newSections = ['info', 'services'];

DateTime _start(Session s) => DateTime.parse(s.revisedStart ?? s.startTime);

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _scroll = ScrollController();
  double _barOpacity = 0;
  Map<String, dynamic>? _weather;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final o = ((_scroll.offset - 40) / 100).clamp(0.0, 1.0);
      if (o != _barOpacity) setState(() => _barOpacity = o);
    });
    // Re-check which sessions have finished once a minute, so a show drops off "Coming up" on its own.
    _tick = Timer.periodic(const Duration(minutes: 1), (_) => setState(() {}));
    api('/weather').then((w) {
      if (mounted) setState(() => _weather = w as Map<String, dynamic>?);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _tick?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  DateTime _reference(SyncState sync) =>
      sync.date == ukTodayStr() ? ukNow() : DateTime.parse('${sync.date}T00:00:00.000Z');

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final sync = context.watch<SyncState>();
    final user = context.watch<AuthState>().user;
    final favs = context.watch<FavoritesState>();
    final prefs = context.watch<PreferencesState>();
    final bundle = sync.bundle;
    final width = MediaQuery.sizeOf(context).width;
    final top = MediaQuery.paddingOf(context).top;

    final reference = _reference(sync);
    final sessions = bundle?.sessions ?? const <Session>[];
    final upcoming = (sessions.where((s) => DateTime.parse(s.endTime).isAfter(reference)).toList()..sort((a, b) => _start(a).compareTo(_start(b)))).take(6).toList();
    final alerts = sessions.where((s) => s.status == 'DELAYED' || s.status == 'CANCELLED').toList();

    // "Your favourites": the soonest still-to-come session for each starred show, one row per attraction.
    final soonest = <String, Session>{};
    for (final s in sessions) {
      if (!favs.ids.contains(s.attractionId)) continue;
      if (!DateTime.parse(s.endTime).isAfter(reference)) continue;
      final cur = soonest[s.attractionId];
      if (cur == null || _start(s).isBefore(_start(cur))) soonest[s.attractionId] = s;
    }
    final favouriteUpcoming = soonest.values.toList()..sort((a, b) => _start(a).compareTo(_start(b)));

    String? hoursOpen, hoursClose;
    if (sessions.isNotEmpty) {
      var lo = sessions.first.startTime, hi = sessions.first.endTime;
      for (final s in sessions) {
        if (DateTime.parse(s.startTime).isBefore(DateTime.parse(lo))) lo = s.startTime;
        if (DateTime.parse(s.endTime).isAfter(DateTime.parse(hi))) hi = s.endTime;
      }
      hoursOpen = fmtTime(lo);
      hoursClose = fmtTime(hi);
    }

    final home = bundle?.home;
    final tagline = (home?.tagline?.isNotEmpty ?? false) ? home!.tagline! : 'An epic tale\nof England';
    final greeting = (home?.greeting?.isNotEmpty ?? false) ? home!.greeting! : 'Welcome';
    final saved = (home?.sections.isNotEmpty ?? false) ? home!.sections : null;
    final order = saved != null
        ? [...saved.where((s) => s.visible).map((s) => s.key), ..._newSections.where((k) => !saved.any((s) => s.key == k))]
        : _defaultSections;
    // Quick actions sit right under the search, and the next show right after the welcome, whatever layout admin saved.
    final fullOrder = ['quick', for (final k in order) ...[k, if (k == 'welcome') 'nextUp']];
    if (!order.contains('welcome')) fullOrder.insert(1, 'nextUp');
    fullOrder.insert(1, 'offline');
    // Pictures for the promo cards come from the park's own content, so they stay current.
    String? firstImage(Iterable<String?> xs) => xs.firstWhere((x) => x != null && x.isNotEmpty, orElse: () => null);
    final showImage = firstImage((bundle?.attractions ?? []).where((a) => a.category == 'EVENING_SHOW').map((a) => a.heroImage));
    final foodImage = firstImage((bundle?.restaurants ?? []).map((r) => r.heroImage));
    final attractionImage = firstImage((bundle?.attractions ?? []).where((a) => a.category != 'EVENING_SHOW').map((a) => a.heroImage));
    final shopImage = firstImage((bundle?.shops ?? []).map((x) => x.heroImage));
    final imageById = {for (final a in bundle?.attractions ?? <Attraction>[]) a.id: a.heroImage};
    final promoWidth = (width * 0.72).clamp(0, 268).roundToDouble();

    void go(String to) => context.push(to);

    Widget showList(List<Session> list, HomeView view) => view == HomeView.list
        ? Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(children: [
              for (final s in list) Padding(padding: const EdgeInsets.only(bottom: 10), child: ShowRow(session: s, image: imageById[s.attractionId], onTap: () => go('/attraction/${s.attractionSlug}'))),
            ]),
          )
        : SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(children: [
              for (final s in list) Padding(padding: const EdgeInsets.only(right: 12), child: ShowCard(session: s, image: imageById[s.attractionId], onTap: () => go('/attraction/${s.attractionSlug}'))),
            ]),
          );

    Widget? section(String key) {
      switch (key) {
        case 'quick':
          const actions = [
            (label: 'Tickets', icon: Icons.confirmation_number_rounded, to: '/tickets', tab: false),
            (label: 'Map', icon: Icons.map_rounded, to: '/map', tab: true),
            (label: 'Eat', icon: Icons.restaurant_rounded, to: '/food', tab: true),
            (label: 'My day', icon: Icons.event_available_rounded, to: '/plan', tab: false),
            (label: 'Essentials', icon: Icons.wc_rounded, to: '/essentials', tab: false),
            (label: 'Shuttle', icon: Icons.directions_bus_rounded, to: '/shuttle', tab: false),
            (label: 'Access', icon: Icons.accessible_rounded, to: '/accessibility', tab: false),
          ];
          return Padding(
            padding: EdgeInsets.zero,
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(children: [
                for (final a in actions)
                  Padding(
                    padding: const EdgeInsets.only(right: 18),
                    child: Tap(
                      onTap: () => a.tab ? context.go(a.to) : go(a.to),
                      label: a.label,
                      child: SizedBox(
                        width: 64,
                        child: Column(children: [
                          Container(width: 58, height: 58, decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(20)), child: Icon(a.icon, color: c.link, size: 26)),
                          const SizedBox(height: 8),
                          Text(a.label, maxLines: 1, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.text)),
                        ]),
                      ),
                    ),
                  ),
              ]),
            ),
          );
        case 'offline':
          if (sync.online) return null;
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(16), border: Border.all(color: c.line)),
              child: Row(children: [
                Icon(Icons.cloud_off_rounded, size: 19, color: c.sub),
                const SizedBox(width: 10),
                Expanded(child: Text(offlineNote(sync.lastSynced, DateTime.now())!, style: TextStyle(fontSize: 13, height: 18 / 13, fontWeight: FontWeight.w600, color: c.sub))),
              ]),
            ),
          );
        case 'nextUp':
          if (upcoming.isEmpty) return null;
          final next = upcoming.first;
          final startsIn = _start(next).difference(ukNow()).inMinutes;
          final when = startsIn <= 0 ? 'On now' : startsIn < 60 ? 'In $startsIn min' : 'In ${startsIn ~/ 60}h ${(startsIn % 60).toString().padLeft(2, '0')}m';
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
            child: KCard(
              onTap: () => go('/attraction/${next.attractionSlug}'),
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Cover(image: imageById[next.attractionId], color: categoryColor[next.attractionCategory] ?? Tokens.brand, icon: Icons.calendar_month_rounded, height: 84, width: 84, radius: 18),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(color: startsIn <= 0 ? Tokens.danger : Tokens.ok, shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      Text(startsIn <= 0 ? 'HAPPENING NOW' : 'NEXT UP', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1, color: c.sub)),
                    ]),
                    const SizedBox(height: 4),
                    Text(next.attractionName, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, height: 1.2, letterSpacing: -0.2, color: c.text)),
                    const SizedBox(height: 6),
                    Text('${fmtTime(next.revisedStart ?? next.startTime)}  ·  $when', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: c.link)),
                  ]),
                ),
                Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 22),
              ]),
            ),
          );
        case 'welcome':
          return Padding(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(greeting, style: TextStyle(fontFamily: Tokens.display, fontSize: 21, fontWeight: FontWeight.w800, color: c.text)),
              const SizedBox(height: 6),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(width: 10, height: 10, decoration: BoxDecoration(color: parseHex(home?.accentColor, Tokens.ok), shape: BoxShape.circle)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    (home?.greetingSub?.isNotEmpty ?? false)
                        ? home!.greetingSub!
                        : hoursOpen != null
                            ? 'Today, the park will be open from $hoursOpen to $hoursClose'
                            : 'Plan your day at Kynren – The Storied Lands',
                    style: TextStyle(fontSize: 14.5, height: 21 / 14.5, color: c.sub),
                  ),
                ),
              ]),
            ]),
          );
        case 'actions':
          return Padding(
            padding: const EdgeInsets.only(top: 22),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                user != null
                    ? _PromoCard(width: promoWidth, image: showImage, icon: Icons.confirmation_number_rounded, color: featureGradient['tickets']![1], title: 'My tickets', text: 'Your QR codes and bookings, ready for the gate.', action: 'Open', onTap: () => go('/tickets'))
                    : _PromoCard(width: promoWidth, image: showImage, icon: Icons.person_rounded, color: Tokens.brand, title: 'Your tickets', text: 'Sign in to bring your bookings into the app, with reminders before each show.', action: 'Sign in', onTap: () => go('/auth')),
                const SizedBox(width: 14),
                _PromoCard(width: promoWidth, image: foodImage, icon: Icons.restaurant_rounded, color: featureGradient['restaurants']![0], title: onlineOrderingOpen ? 'Order food' : 'Eat and drink', text: onlineOrderingOpen ? 'Order ahead and collect without the queue.' : 'See the menus, what is open now and the dietary choices.', action: onlineOrderingOpen ? 'Order now' : 'See menus', onTap: () => context.go('/food')),
              ]),
            ),
          );
        case 'info':
          final temp = (_weather?['current'] as Map?)?['temperature_2m'] as num?;
          final code = (_weather?['current'] as Map?)?['weather_code'] as num?;
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: Row(children: [
              Expanded(child: _InfoTile(label: temp != null ? '${temp.round()}°C' : 'Weather', emoji: _weatherIcon[code?.toInt() ?? 0] ?? '🌤️')),
              const SizedBox(width: 12),
              Expanded(child: _InfoTile(label: 'Shuttle', icon: Icons.directions_bus_rounded, onTap: () => go('/shuttle'))),
              const SizedBox(width: 12),
              Expanded(child: _InfoTile(label: 'Access', icon: Icons.accessible_rounded, onTap: () => go('/accessibility'))),
            ]),
          );
        case 'services':
          Widget tile(String title, String text, String? image, Color color, IconData icon, VoidCallback onTap) => Tap(
                onTap: onTap,
                scaleTo: 1.04,
                label: title,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Cover(image: image, color: color, icon: icon, height: 112, radius: 18),
                  const SizedBox(height: 8),
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 15, fontWeight: FontWeight.w700, color: c.text)),
                  const SizedBox(height: 1),
                  Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: c.sub)),
                ]),
              );
          return Padding(
            padding: const EdgeInsets.only(top: 26),
            child: Column(children: [
              const SectionHeader('Theme park services'),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: GridView.count(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 0.98,
                  shrinkWrap: true,
                  padding: EdgeInsets.zero,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    tile('Shows', upcoming.isNotEmpty ? '${upcoming.length} coming up today' : 'The full programme', showImage, featureGradient['programme']![0], Icons.calendar_month_rounded, () => go('/shows')),
                    tile('Attractions', 'Find your way around', attractionImage, Tokens.brand, Icons.place_rounded, () => context.go('/map')),
                    tile('Restaurants', onlineOrderingOpen ? 'Menus and order ahead' : 'Menus and opening times', foodImage, featureGradient['restaurants']![0], Icons.restaurant_rounded, () => context.go('/food')),
                    tile('Shops', 'Gifts and souvenirs', shopImage, const Color(0xFF4B5D73), Icons.storefront_rounded, () => context.push('/shops')),
                  ],
                ),
              ),
            ]),
          );
        case 'visit':
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
            child: KCard(
              onTap: () => go('/plan'),
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                _Round(icon: Icons.calendar_month_rounded, size: 24),
                const SizedBox(width: 14),
                Expanded(child: _TitleSub('Plan your perfect visit', 'Pick the shows you don’t want to miss')),
                Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
              ]),
            ),
          );
        case 'announcement':
          final a = bundle?.announcements.isEmpty ?? true ? null : bundle!.announcements.first;
          if (a == null) return null;
          return Padding(
            padding: const EdgeInsets.fromLTRB(20, 22, 20, 0),
            child: KCard(
              padding: const EdgeInsets.all(16),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const _Round(icon: Icons.notifications_rounded, size: 22),
                const SizedBox(width: 14),
                Expanded(child: _TitleSub(a.title, a.body)),
              ]),
            ),
          );
        case 'alerts':
          if (alerts.isEmpty) return null;
          return Padding(
            padding: const EdgeInsets.only(top: 26),
            child: Column(children: [
              const SectionHeader('Today’s changes'),
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(children: [
                  for (final s in alerts)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: KCard(
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(border: Border(left: BorderSide(color: statusColor[s.status] ?? c.sub, width: 5))),
                          child: SizedBox(
                            width: double.infinity,
                            child: _TitleSub(
                              s.attractionName,
                              '${s.status == 'CANCELLED' ? 'Cancelled' : 'Delayed to ${fmtTime(s.revisedStart ?? s.startTime)}'}${s.note != null ? ' · ${s.note}' : ''}',
                            ),
                          ),
                        ),
                      ),
                    ),
                ]),
              ),
            ]),
          );
        case 'comingUp':
          return Padding(
            padding: const EdgeInsets.only(top: 26),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SectionHeader('Coming up', action: 'See All', onAction: () => go('/shows'), trailing: ViewToggle(view: prefs.views[HomeList.comingUp]!, onChange: (v) => prefs.setView(HomeList.comingUp, v))),
              const SizedBox(height: 12),
              if (bundle == null)
                const Padding(padding: EdgeInsets.symmetric(horizontal: 20), child: Column(children: [SkeletonRow(), SkeletonRow(), SkeletonRow()]))
              else if (upcoming.isEmpty)
                Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Text('No more shows today.', style: TextStyle(color: c.sub, fontSize: 13)))
              else
                showList(upcoming, prefs.views[HomeList.comingUp]!),
            ]),
          );
        case 'favourites':
          // Signed-out guests have no favourites, so the section is hidden rather than an empty state.
          if (favouriteUpcoming.isEmpty) return null;
          return Padding(
            padding: const EdgeInsets.only(top: 26),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SectionHeader('Your favourites', action: 'See All', onAction: () => go('/favorites'), trailing: ViewToggle(view: prefs.views[HomeList.favourites]!, onChange: (v) => prefs.setView(HomeList.favourites, v))),
              const SizedBox(height: 12),
              showList(favouriteUpcoming, prefs.views[HomeList.favourites]!),
            ]),
          );
      }
      return null;
    }

    final bandHeight = top + 270;
    final hasBarPicture = hasSlotImage(context, 'header.home');

    return StatusBarIcons(
      light: true,
      child: Scaffold(
      backgroundColor: c.screen,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const PageBackdrop('home'),
          Positioned.fill(
            child: RefreshIndicator(
              onRefresh: sync.refresh,
              child: ListView(
                controller: _scroll,
                padding: const EdgeInsets.only(bottom: navClearance),
                children: [
                  // The sky band: admin media (image / GIF / video) or the built-in illustration, under the menu bar
                  SizedBox(
                    height: bandHeight,
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
                      child: Stack(fit: StackFit.expand, children: [
                        const ColoredBox(color: Tokens.bandTo),
                        _Hero(home: home),
                        const DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xE61D3A2B), Color(0x001D3A2B), Color(0x00000000), Color(0x991A120A)], stops: [0, 0.5, 0.5, 1]),
                          ),
                        ),
                        Positioned(
                          left: 22,
                          right: 22,
                          bottom: 46,
                          child: Text(tagline, style: const TextStyle(fontFamily: Tokens.display, color: Colors.white, fontSize: 28, fontWeight: FontWeight.w800, height: 32 / 28, shadows: [Shadow(color: Color(0x59000000), blurRadius: 8)])),
                        ),
                      ]),
                    ),
                  ),
                  // The search floats over the foot of the hero.
                  Transform.translate(offset: const Offset(0, -28), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: SearchPill(placeholder: 'Find everything here', onTap: () => context.go('/search')))),
                  for (var i = 0; i < fullOrder.length; i++) ...[
                    if (section(fullOrder[i]) case final w?) Reveal(index: i, child: w),
                  ],
                ],
              ),
            ),
          ),
          // The bar that stays at the top while the page scrolls; its green band fades in once the guest scrolls past the picture.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: top + 56,
            child: Stack(children: [
              Positioned.fill(
                child: IgnorePointer(
                  child: Opacity(
                    opacity: _barOpacity,
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
                      child: Stack(fit: StackFit.expand, children: [
                        const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Tokens.bandFrom, Tokens.bandTo]))),
                        if (hasBarPicture) ...[
                          const ManagedImage(slot: 'header.home', fadeColor: Tokens.bandTo),
                          const ColoredBox(color: Color(0x52000000)),
                        ],
                      ]),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(20, top + 4, 20, 0),
                child: Row(children: [
                  _BarButton(icon: Icons.menu_rounded, size: 26, label: 'Open menu', onTap: () => go('/menu')),
                  const Spacer(),
                  _BarButton(icon: Icons.notifications_none_rounded, size: 24, label: 'Notifications', onTap: () => go('/notifications')),
                ]),
              ),
            ]),
          ),
        ],
      ),
      ),
    );
  }
}

class _BarButton extends StatelessWidget {
  final IconData icon;
  final double size;
  final String label;
  final VoidCallback onTap;
  const _BarButton({required this.icon, required this.size, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => SizedBox(
        width: 48,
        height: 48,
        child: Tap(onTap: onTap, label: label, child: Icon(icon, color: Colors.white, size: size)),
      );
}

/// The hero: admin media (image, GIF or video) when set, otherwise the built-in illustration.
class _Hero extends StatefulWidget {
  final HomeConfig? home;
  const _Hero({required this.home});
  @override
  State<_Hero> createState() => _HeroState();
}

class _HeroState extends State<_Hero> {
  VideoPlayerController? _video;
  String? _videoUrl;

  void _sync() {
    final h = widget.home;
    final url = (h != null && h.heroType == 'video') ? h.heroMediaUrl : null;
    if (url == _videoUrl) return;
    _video?.dispose();
    _video = null;
    _videoUrl = url;
    if (url == null || url.isEmpty) return;
    final v = VideoPlayerController.networkUrl(Uri.parse(url));
    _video = v;
    v.initialize().then((_) {
      if (!mounted || _video != v) return;
      v.setVolume(0);
      v.setLooping(true);
      v.play();
      setState(() {});
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(covariant _Hero old) {
    super.didUpdateWidget(old);
    _sync();
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.home;
    if (h == null || h.heroType == 'none' || (h.heroMediaUrl ?? '').isEmpty) return const HeroArt();
    if (h.heroType == 'video') {
      final v = _video;
      if (v == null || !v.value.isInitialized) return const HeroArt();
      return FittedBox(fit: BoxFit.cover, clipBehavior: Clip.hardEdge, child: SizedBox(width: v.value.size.width, height: v.value.size.height, child: VideoPlayer(v)));
    }
    return KImage(h.heroMediaUrl!, cacheWidth: 1200, placeholder: (_) => const HeroArt(), error: (_) => const HeroArt());
  }
}

class _PromoCard extends StatelessWidget {
  final double width;
  final String? image;
  final IconData icon;
  final Color color;
  final String title, text, action;
  final VoidCallback onTap;
  const _PromoCard({required this.width, required this.image, required this.icon, required this.color, required this.title, required this.text, required this.action, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return SizedBox(
      width: width,
      child: KCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Tap(onTap: onTap, scaleTo: 1.04, label: title, child: Cover(image: image, color: color, icon: icon, height: 168)),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: TextStyle(fontFamily: Tokens.display, fontSize: 19, fontWeight: FontWeight.w700, color: c.text)),
              const SizedBox(height: 3),
              Text(text, maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
              const SizedBox(height: 12),
              KButton(action, small: true, onPressed: onTap),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String label;
  final IconData? icon;
  final String? emoji;
  final VoidCallback? onTap;
  const _InfoTile({required this.label, this.icon, this.emoji, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return KCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(children: [
        SizedBox(height: 28, child: Center(child: emoji != null ? Text(emoji!, style: const TextStyle(fontSize: 22)) : Icon(icon, color: c.link, size: 22))),
        const SizedBox(height: 6),
        Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.text)),
      ]),
    );
  }
}

class _Round extends StatelessWidget {
  final IconData icon;
  final double size;
  const _Round({required this.icon, required this.size});
  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Container(width: 48, height: 48, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(icon, color: c.link, size: size));
  }
}

class _TitleSub extends StatelessWidget {
  final String title, sub;
  const _TitleSub(this.title, this.sub);
  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: c.text)),
      const SizedBox(height: 2),
      Text(sub, style: TextStyle(fontSize: 13, height: 18 / 13, color: c.sub)),
    ]);
  }
}
