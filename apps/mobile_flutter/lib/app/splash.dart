import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';
import '../core/sync.dart';
import '../ui/kimage.dart';

const _gold = Color(0xFFF0D79A);
const _goldDim = Color(0xFFD9A441);
const _cache = 'kynren_splash';
const _minMs = 3400; // long enough for the crest montage and mark reveal to play out
const _maxMs = 6000; // hard cap so a slow video or network never traps the guest

// The five story crests (white artwork over the night sky), in show order.
const _logos = [
  'assets/splash/crest1.png',
  'assets/splash/crest2.png',
  'assets/splash/crest3.png',
  'assets/splash/crest4.png',
  'assets/splash/crest5.png',
];

const _stars = [
  (0.12, 0.09, 1.4), (0.22, 0.15, 1.0), (0.34, 0.07, 1.6), (0.5, 0.12, 1.0), (0.63, 0.06, 1.4),
  (0.74, 0.14, 1.0), (0.9, 0.1, 1.4), (0.08, 0.22, 1.0), (0.42, 0.2, 1.1), (0.83, 0.2, 1.1),
];

/// Full-screen launch overlay: the admin-configured media (photo / GIF / video) from the branding config, cached from
/// the last sync so it shows instantly on a cold start, or the cinematic Kynren sequence by default. It fades out once
/// the app is ready.
class LoadingOverlay extends StatefulWidget {
  const LoadingOverlay({super.key});
  @override
  State<LoadingOverlay> createState() => _LoadingOverlayState();
}

class _LoadingOverlayState extends State<LoadingOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 420), value: 1);
  final _started = DateTime.now();
  ({String type, String? url})? _cfg;
  bool _done = false, _dismissing = false;
  Timer? _tick;
  VideoPlayerController? _video;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      final raw = p.getString(_cache);
      final parts = raw?.split('|');
      if (mounted) setState(() => _cfg = (type: parts != null && parts.isNotEmpty ? parts[0] : 'none', url: parts != null && parts.length > 1 && parts[1].isNotEmpty ? parts[1] : null));
      _maybeStartVideo();
    });
    _tick = Timer.periodic(const Duration(milliseconds: 150), (_) => _check());
  }

  void _maybeStartVideo() {
    final cfg = _cfg;
    if (cfg == null || cfg.type != 'video' || cfg.url == null || _video != null) return;
    final v = VideoPlayerController.networkUrl(Uri.parse(cfg.url!));
    _video = v;
    v.initialize().then((_) {
      if (!mounted) return;
      v.setVolume(0);
      v.setLooping(true);
      v.play();
      setState(() {});
    }).catchError((_) {
      if (mounted) setState(() => _done = true);
    });
  }

  void _check() {
    if (_cfg == null || _dismissing) return;
    final loading = context.read<SyncState>().loading;
    final elapsed = DateTime.now().difference(_started).inMilliseconds;
    if (elapsed >= _maxMs || (elapsed >= _minMs && !loading)) {
      _dismissing = true;
      _fade.reverse().whenComplete(() {
        if (mounted) setState(() => _done = true);
      });
    }
  }

  @override
  void dispose() {
    _tick?.cancel();
    _fade.dispose();
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_done) return const SizedBox.shrink();
    final branding = context.watch<SyncState>().bundle?.branding;
    // Refresh the cache from the live bundle for next launch.
    if (branding != null) {
      SharedPreferences.getInstance().then((p) => p.setString(_cache, '${branding.splashType ?? 'none'}|${branding.splashMediaUrl ?? ''}'));
    }
    final cfg = _cfg;
    final url = cfg?.url;
    final hasMedia = cfg != null && cfg.type != 'none' && url != null;
    Widget content;
    if (cfg == null) {
      content = const SizedBox.shrink();
    } else if (hasMedia && cfg.type == 'video') {
      final v = _video;
      content = v != null && v.value.isInitialized
          ? FittedBox(fit: BoxFit.cover, clipBehavior: Clip.hardEdge, child: SizedBox(width: v.value.size.width, height: v.value.size.height, child: VideoPlayer(v)))
          : const SizedBox.shrink();
    } else if (hasMedia) {
      content = KImage(url, cacheWidth: 1200);
    } else {
      // Default: the cinematic Kynren splash sequence.
      content = const SplashSequence();
    }
    return Positioned.fill(
      child: IgnorePointer(
        child: FadeTransition(opacity: _fade, child: ColoredBox(color: const Color(0xFF0A0616), child: SizedBox.expand(child: content))),
      ),
    );
  }
}

/// Cinematic Kynren splash: night sky + keep, five crests draw in, then the mark.
class SplashSequence extends StatefulWidget {
  const SplashSequence({super.key});
  @override
  State<SplashSequence> createState() => _SplashSequenceState();
}

class _SplashSequenceState extends State<SplashSequence> with SingleTickerProviderStateMixin {
  // One timeline drives everything: milliseconds since the sequence started.
  late final AnimationController _t = AnimationController(vsync: this, duration: const Duration(milliseconds: 9000))..repeat();

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  /// 0..1 progress of an animation that starts at [delay] ms and lasts [dur] ms.
  double _p(double delay, double dur, [Curve curve = Curves.linear]) => curve.transform(((_t.value * 9000 - delay) / dur).clamp(0.0, 1.0));

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final w = size.width, h = size.height;
    final logoW = math.min(w * 0.74, 380.0), logoH = math.min(h * 0.24, 220.0);
    final wmW = math.min(w * 0.82, 440.0), wmH = wmW * 0.46;
    return AnimatedBuilder(
      animation: _t,
      builder: (context, _) {
        final word = _p(2400, 650, Curves.easeOutCubic);
        final cross = _p(2250, 700, Curves.elasticOut);
        final rule = _p(2750, 800);
        final tag = _p(3000, 700);
        return Stack(fit: StackFit.expand, children: [
          CustomPaint(painter: _SkyPainter()),
          for (var s = 0; s < 8; s++) _Ember(w: w, h: h, seed: s + 3, t: _t.value * 9000),
          Center(
            child: Stack(alignment: Alignment.center, children: [
              for (var i = 0; i < _logos.length; i++)
                () {
                  // each crest fades up, holds, and fades out on its cue
                  final start = 500 + i * 300.0;
                  final up = _p(start, 300, Curves.easeOutCubic), down = _p(start + 460, 300, Curves.easeInCubic);
                  final o = up * (1 - down);
                  return Opacity(opacity: o, child: Transform.scale(scale: 0.92 + o * 0.08, child: Image.asset(_logos[i], width: logoW, height: logoH, fit: BoxFit.contain)));
                }(),
            ]),
          ),
          Padding(
            padding: EdgeInsets.only(top: h * 0.06),
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Opacity(opacity: word, child: Transform.translate(offset: Offset(0, (1 - word) * 24), child: Transform.scale(scale: 0.9 + cross * 0.1, child: Image.asset('assets/splash/wordmark.webp', width: wmW, height: wmH, fit: BoxFit.contain)))),
                Container(margin: const EdgeInsets.only(top: 18, bottom: 14), height: 2, width: rule * math.min(w * 0.62, 360.0), color: _gold),
                Opacity(opacity: tag, child: const Padding(padding: EdgeInsets.only(left: 6), child: Text('THE STORIED LANDS', style: TextStyle(fontSize: 13, letterSpacing: 6, color: _gold, fontWeight: FontWeight.w600)))),
                const SizedBox(height: 30),
                Row(mainAxisSize: MainAxisSize.min, children: [
                  for (final d in [0.0, 180.0, 360.0])
                    () {
                      final v = 0.3 + 0.7 * (0.5 - 0.5 * math.cos(((_t.value * 9000 - d) / 1200) * 2 * math.pi)).clamp(0.0, 1.0);
                      return Padding(padding: const EdgeInsets.symmetric(horizontal: 4.5), child: Opacity(opacity: v, child: Transform.scale(scale: 0.8 + v * 0.35, child: Container(width: 7, height: 7, decoration: const BoxDecoration(color: _goldDim, shape: BoxShape.circle)))));
                    }(),
                ]),
              ]),
            ),
          ),
        ]);
      },
    );
  }
}

class _Ember extends StatelessWidget {
  final double w, h, t;
  final int seed;
  const _Ember({required this.w, required this.h, required this.seed, required this.t});
  @override
  Widget build(BuildContext context) {
    final x = (seed * 97) % w;
    final dur = 4200 + (seed * 613) % 3000;
    final phase = ((t % dur) / dur);
    final delay = (seed * 271) % 2500;
    final live = t >= delay;
    final o = !live ? 0.0 : (phase < 0.3 ? phase / 0.3 * 0.7 : (1 - (phase - 0.3) / 0.7) * 0.7);
    return Positioned(left: x, top: (1 - phase) * (h * 0.7) + h * 0.15, child: Opacity(opacity: o.clamp(0.0, 1.0), child: Container(width: 3, height: 3, decoration: const BoxDecoration(color: _gold, shape: BoxShape.circle))));
  }
}

class _SkyPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF2A1846), Color(0xFF1A1030), Color(0xFF0A0616)], stops: [0, 0.5, 1]).createShader(rect));
    canvas.drawRect(rect, Paint()..shader = RadialGradient(center: const Alignment(0, -0.74), radius: 0.9, colors: [const Color(0xFFFBEECB).withValues(alpha: 0.85), const Color(0xFFEFD79A).withValues(alpha: 0.28), const Color(0xFFEFD79A).withValues(alpha: 0)], stops: const [0, 0.5, 1]).createShader(rect));
    canvas.drawRect(rect, Paint()..shader = RadialGradient(center: const Alignment(0, 1.36), radius: 1.3, colors: [const Color(0xFF8F1D21).withValues(alpha: 0.55), const Color(0xFF8F1D21).withValues(alpha: 0)]).createShader(rect));
    for (final s in _stars) {
      canvas.drawCircle(Offset(s.$1 * w, s.$2 * h), s.$3, Paint()..color = Colors.white.withValues(alpha: 0.7));
    }
    final dark = Paint()..color = const Color(0xFF0A0616);
    canvas.drawPath(
      Path()
        ..moveTo(0, h)
        ..lineTo(0, h - 96)
        ..quadraticBezierTo(w * 0.22, h - 140, w * 0.5, h - 116)
        ..quadraticBezierTo(w * 0.75, h - 92, w, h - 124)
        ..lineTo(w, h)
        ..close(),
      Paint()..color = const Color(0xEB0A0616),
    );
    canvas.save();
    canvas.translate(w / 2 - 80, h - 176);
    canvas.drawRect(const Rect.fromLTWH(20, 40, 120, 110), dark);
    canvas.drawRect(const Rect.fromLTWH(0, 58, 26, 92), dark);
    canvas.drawRect(const Rect.fromLTWH(134, 58, 26, 92), dark);
    Path tri(double x, double y, double dx, double dy) => Path()
      ..moveTo(x, y)
      ..relativeLineTo(dx, -dy)
      ..relativeLineTo(dx, dy)
      ..close();
    canvas.drawPath(tri(20, 40, 16, 22), dark);
    canvas.drawPath(tri(108, 40, 16, 22), dark);
    canvas.drawPath(tri(0, 58, 13, 18), dark);
    canvas.drawPath(tri(134, 58, 13, 18), dark);
    canvas.drawRect(const Rect.fromLTWH(72, 96, 16, 54), dark);
    final gold = Paint()..color = _goldDim.withValues(alpha: 0.85);
    canvas.drawPath(tri(11, 20, 5, 12), gold);
    canvas.drawPath(tri(119, 20, 5, 12), gold);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_SkyPainter old) => false;
}
