import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/auth.dart';
import '../core/eat_logic.dart';
import '../core/profile.dart';
import '../core/tickets.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/header_art.dart';
import '../ui/managed_image.dart';
import '../ui/tap.dart';

class _Entry {
  final String label, to;
  final IconData icon;
  /// Needs an account: only shown once the guest has signed in.
  final bool personal;
  const _Entry(this.label, this.icon, this.to, {this.personal = false});
}

final _groups = [
  (title: 'Your visit', entries: [
    const _Entry('My tickets', Icons.confirmation_number_rounded, '/tickets', personal: true),
    const _Entry('Programme', Icons.calendar_month_rounded, '/shows'),
    const _Entry('My day', Icons.star_rounded, '/plan', personal: true),
    if (onlineOrderingOpen) const _Entry('My orders', Icons.restaurant_rounded, '/orders', personal: true),
  ]),
  (title: 'Around the park', entries: [
    _Entry('Scan a code', Icons.qr_code_scanner_rounded, '/scan'),
    _Entry('Park essentials', Icons.wc_rounded, '/essentials'),
    _Entry('Shuttle', Icons.directions_bus_rounded, '/shuttle'),
    _Entry('Accessibility', Icons.accessible_rounded, '/accessibility'),
    _Entry('Favourites', Icons.favorite_rounded, '/favorites'),
    _Entry('Notifications', Icons.notifications_rounded, '/notifications'),
  ]),
  (title: 'You', entries: [
    _Entry('Find my bookings', Icons.search_rounded, '/find-bookings', personal: true),
    _Entry('Profile', Icons.person_rounded, '/profile'),
    _Entry('Language', Icons.language_rounded, '/language'),
    _Entry('Settings', Icons.tune_rounded, '/settings', personal: true),
  ]),
];

/// The slide-in drawer, shown over the screen it was opened from.
class MenuScreen extends StatefulWidget {
  const MenuScreen({super.key});
  @override
  State<MenuScreen> createState() => _MenuScreenState();
}

class _MenuScreenState extends State<MenuScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 240));
  late final CurvedAnimation _curve = CurvedAnimation(parent: _anim, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);

  @override
  void initState() {
    super.initState();
    _anim.forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  /// Slide shut, then leave and (optionally) go somewhere.
  Future<void> _close([VoidCallback? then]) async {
    final router = GoRouter.of(context);
    await _anim.animateBack(0, duration: const Duration(milliseconds: 200));
    if (!mounted) return;
    router.pop();
    if (then != null) Future.microtask(then);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    final bundle = context.watch<SyncState>().bundle;
    final width = MediaQuery.sizeOf(context).width;
    final panelWidth = (width * 0.86).clamp(0, 340).toDouble();
    final top = MediaQuery.paddingOf(context).top;
    final router = GoRouter.of(context);
    final hasPicture = hasSlotImage(context, 'header.menu');
    final name = user == null ? '' : context.watch<ProfileState>().firstName(user, context.watch<TicketsState>().tickets);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: AnimatedBuilder(
        animation: _curve,
        builder: (context, _) => Stack(children: [
          Positioned.fill(
            child: GestureDetector(
              onTap: () => _close(),
              child: ColoredBox(color: const Color(0x80080F1E).withValues(alpha: 0.5 * _curve.value)),
            ),
          ),
          Positioned(
            top: 0,
            bottom: 0,
            left: -panelWidth * (1 - _curve.value),
            width: panelWidth,
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: c.card,
                borderRadius: const BorderRadius.horizontal(right: Radius.circular(32)),
                boxShadow: softShadow(context.isDark, level: 2),
              ),
              child: Column(children: [
                Stack(children: [
                  Positioned.fill(child: const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Tokens.bandFrom, Tokens.bandTo])))),
                  if (hasPicture) ...[
                    const Positioned.fill(child: ManagedImage(slot: 'header.menu', fadeColor: Tokens.bandTo)),
                    const Positioned.fill(child: ColoredBox(color: Color(0x52000000))),
                  ] else
                    const HeaderArt(),
                  Padding(
                    padding: EdgeInsets.fromLTRB(22, top + 14, 22, 58),
                    child: SizedBox(
                      width: double.infinity,
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text((bundle?.branding?.appName ?? 'Kynren').toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 3))),
                          Tap(onTap: () => _close(), label: 'Close menu', child: const Icon(Icons.close_rounded, color: Colors.white, size: 24)),
                        ]),
                        const SizedBox(height: 18),
                        if (user != null)
                          Text('Hello${name.isNotEmpty ? ', $name' : ''}', style: const TextStyle(fontFamily: Tokens.display, color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800))
                        else ...[
                          const Text('Welcome', style: TextStyle(fontFamily: Tokens.display, color: Colors.white, fontSize: 21, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 12),
                          KButton('Sign in or create account', small: true, onPressed: () => _close(() => router.push('/auth'))),
                        ],
                      ]),
                    ),
                  ),
                ]),
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(0, 6, 0, MediaQuery.paddingOf(context).bottom + 24),
                    children: [
                      for (final g in _groups)
                        if (g.entries.any((e) => !e.personal || user != null))
                        Padding(
                          padding: const EdgeInsets.only(top: 14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Padding(padding: const EdgeInsets.fromLTRB(22, 0, 22, 4), child: Text(g.title.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.5, color: c.sub))),
                            for (final e in g.entries)
                              if (!e.personal || user != null)
                              Tap(
                                onTap: () => _close(() => router.push(e.to)),
                                label: e.label,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
                                  child: Row(children: [
                                    Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(e.icon, color: c.link, size: 20)),
                                    const SizedBox(width: 14),
                                    Expanded(child: Text(e.label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: c.text))),
                                    Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
                                  ]),
                                ),
                              ),
                          ]),
                        ),
                    ],
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}
