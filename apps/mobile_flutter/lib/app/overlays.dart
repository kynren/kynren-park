import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/models.dart';
import 'router.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/tap.dart';

// ---------------------------------------------------------------- Megaphone

const _dismissKey = 'kynren_announce_dismissed';

/// Foreground megaphone that appears when a live announcement is due. Tapping it reads the announcement aloud
/// (text-to-speech) and shows the full text.
class AnnouncementMegaphone extends StatefulWidget {
  const AnnouncementMegaphone({super.key});
  @override
  State<AnnouncementMegaphone> createState() => _AnnouncementMegaphoneState();
}

class _AnnouncementMegaphoneState extends State<AnnouncementMegaphone> with SingleTickerProviderStateMixin {
  late final AnimationController _anim = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000))..repeat();
  final _tts = FlutterTts();
  Set<String> _dismissed = {};
  bool _open = false, _speaking = false;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      final raw = p.getString(_dismissKey);
      if (raw != null && mounted) setState(() => _dismissed = {...(jsonDecode(raw) as List).cast<String>()});
    });
    // Re-evaluate the active window every 30s so it appears and expires on time.
    _tick = Timer.periodic(const Duration(seconds: 30), (_) => mounted ? setState(() {}) : null);
    _tts.setCompletionHandler(() => mounted ? setState(() => _speaking = false) : null);
    _tts.setCancelHandler(() => mounted ? setState(() => _speaking = false) : null);
    _tts.setSpeechRate(0.5).catchError((_) => 0); // read-aloud is best effort: some phones have no speech engine
  }

  @override
  void dispose() {
    _tick?.cancel();
    _anim.dispose();
    _tts.stop().catchError((_) => 0);
    super.dispose();
  }

  Future<void> _speak(Announcement a) async {
    try {
      await _tts.stop();
      setState(() => _speaking = true);
      await _tts.speak('${a.title}. ${a.body}');
    } catch (_) {
      if (mounted) setState(() => _speaking = false);
    }
  }

  void _dismiss(Announcement a) {
    _tts.stop().catchError((_) => 0);
    setState(() {
      _speaking = false;
      _open = false;
      _dismissed = {..._dismissed, a.id};
    });
    SharedPreferences.getInstance().then((p) => p.setString(_dismissKey, jsonEncode(_dismissed.toList())));
  }

  @override
  Widget build(BuildContext context) {
    final bundle = context.watch<SyncState>().bundle;
    final now = DateTime.now();
    final due = (bundle?.announcements ?? <Announcement>[]).where((a) => a.isDue(now) && !_dismissed.contains(a.id)).toList()..sort((a, b) => b.when.compareTo(a.when));
    if (due.isEmpty) return const SizedBox.shrink();
    final a = due.first;
    final c = context.ui;

    return Positioned(
      right: 16,
      bottom: 96,
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
        if (_open)
          Container(
            width: 280,
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(16), boxShadow: const [BoxShadow(color: Color(0x38000000), blurRadius: 12, offset: Offset(0, 4))]),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('📣 ANNOUNCEMENT', style: TextStyle(color: c.link, fontWeight: FontWeight.w800, fontSize: 11, letterSpacing: 0.6))),
                Tap(onTap: () => _dismiss(a), label: 'Dismiss', child: Text('✕', style: TextStyle(color: c.sub, fontSize: 15, fontWeight: FontWeight.w700))),
              ]),
              const SizedBox(height: 6),
              Text(a.title, style: TextStyle(color: c.text, fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 6),
              Text(a.body, style: TextStyle(color: c.sub, fontSize: 14, height: 20 / 14)),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(
                  child: Tap(
                    onTap: () => _speaking ? (_tts.stop().catchError((_) => 0).then((_) => mounted ? setState(() => _speaking = false) : null)) : _speak(a),
                    child: Container(padding: const EdgeInsets.symmetric(vertical: 10), decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(10)), child: Center(child: Text(_speaking ? '■ Stop' : '🔊 Play again', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)))),
                  ),
                ),
                const SizedBox(width: 10),
                Tap(
                  onTap: () => _dismiss(a),
                  child: Container(padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14), decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: c.line)), child: Text('Dismiss', style: TextStyle(color: c.text, fontWeight: FontWeight.w700, fontSize: 13))),
                ),
              ]),
            ]),
          ),
        Tap(
          onTap: () {
            HapticFeedback.mediumImpact();
            setState(() => _open = true);
            _speak(a);
          },
          label: 'Announcement',
          child: SizedBox(
            width: 60,
            height: 60,
            child: AnimatedBuilder(
              animation: _anim,
              builder: (_, _) {
                // an attention-grabbing shake and pulse while a due announcement waits
                final t = _anim.value;
                final shakePhase = t < 0.18 ? t / 0.18 : 1.0;
                final shake = _open ? 0.0 : (shakePhase < 1 ? (shakePhase < 0.33 ? shakePhase * 3 : shakePhase < 0.66 ? 1 - (shakePhase - 0.33) * 6 : -1 + (shakePhase - 0.66) * 3) : 0.0);
                return Stack(alignment: Alignment.center, children: [
                  if (!_open) Transform.scale(scale: 1 + t * 1.1, child: Container(width: 56, height: 56, decoration: BoxDecoration(color: c.primary.withValues(alpha: 0.5 * (1 - t)), shape: BoxShape.circle))),
                  Transform.rotate(
                    angle: shake * 16 * 3.14159 / 180,
                    child: Container(width: 56, height: 56, decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle, boxShadow: const [BoxShadow(color: Color(0x4D000000), blurRadius: 6, offset: Offset(0, 3))]), child: const Center(child: Text('📣', style: TextStyle(fontSize: 26)))),
                  ),
                ]);
              },
            ),
          ),
        ),
      ]),
    );
  }
}

// -------------------------------------------------------------- Walkthrough

const _seenKey = 'kynren_walkthrough_seen';

/// The first path segment matches the tab route name admin picks from (index | map | tickets | shows | food);
/// "/" (Home) resolves to "index".
String _screenOf(String path) {
  final seg = path.split('/').where((s) => s.isNotEmpty).firstOrNull;
  return seg == null ? 'index' : (seg == 'search' ? 'search' : seg);
}

/// Admin-authored, first-time-only onboarding cards. Each step is tied to a tab (screen) and a position on it; the
/// first time a guest reaches that tab, its unseen steps show one at a time until dismissed, never again after that,
/// tracked per device.
class WalkthroughOverlay extends StatefulWidget {
  const WalkthroughOverlay({super.key});
  @override
  State<WalkthroughOverlay> createState() => _WalkthroughOverlayState();
}

class _WalkthroughOverlayState extends State<WalkthroughOverlay> {
  Set<String>? _seen; // null until loaded from storage

  // Rebuild when the guest moves to another screen, but never during a build: the router notifies as it settles.
  void _onRoute() => WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? setState(() {}) : null);

  @override
  void dispose() {
    router.routerDelegate.removeListener(_onRoute);
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    router.routerDelegate.addListener(_onRoute);
    SharedPreferences.getInstance().then((p) {
      final raw = p.getString(_seenKey);
      if (mounted) setState(() => _seen = raw == null ? {} : {...(jsonDecode(raw) as List).cast<String>()});
    });
  }

  void _markSeen(Iterable<String> ids) {
    setState(() => _seen = {...?_seen, ...ids});
    SharedPreferences.getInstance().then((p) => p.setString(_seenKey, jsonEncode(_seen!.toList())));
  }

  @override
  Widget build(BuildContext context) {
    final sync = context.watch<SyncState>();
    final seen = _seen;
    if (sync.loading || seen == null) return const SizedBox.shrink();
    final path = router.routeInformationProvider.value.uri.path;
    final screen = _screenOf(path);
    final steps = (sync.bundle?.walkthrough ?? <WalkthroughStep>[]).where((s) => s.screen == screen).toList()..sort((a, b) => a.order.compareTo(b.order));
    final unseen = steps.where((s) => !seen.contains(s.id)).toList();
    if (unseen.isEmpty) return const SizedBox.shrink();
    final step = unseen.first;
    final isLast = unseen.length == 1;
    final c = context.ui;
    final top = MediaQuery.paddingOf(context).top;
    final h = MediaQuery.sizeOf(context).height;
    final pos = step.position == 'top' ? (top: top + 66, bottom: null) : step.position == 'center' ? (top: h * 0.42, bottom: null) : (top: null, bottom: 96.0);

    return Positioned(
      left: 16,
      right: 16,
      top: pos.top,
      bottom: pos.bottom,
      child: Align(
        alignment: pos.top != null ? Alignment.topCenter : Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(16), boxShadow: const [BoxShadow(color: Color(0x3D000000), blurRadius: 14, offset: Offset(0, 6))]),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(step.title, style: TextStyle(color: c.text, fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 6),
              Text(step.body, style: TextStyle(color: c.sub, fontSize: 14, height: 20 / 14)),
              const SizedBox(height: 16),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Tap(onTap: () => _markSeen((sync.bundle?.walkthrough ?? []).map((s) => s.id)), child: Text('Skip', style: TextStyle(color: c.sub, fontWeight: FontWeight.w700, fontSize: 13))),
                Tap(
                  onTap: () => _markSeen([step.id]),
                  child: Container(padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 22), decoration: BoxDecoration(color: c.primary, borderRadius: BorderRadius.circular(999)), child: Text(isLast ? 'Got it' : 'Next', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13))),
                ),
              ]),
            ]),
          ),
        ),
      ),
    );
  }
}
