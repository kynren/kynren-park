import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/models.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import 'kimage.dart';

String? _slotUri(ManagedImageConfig? cfg, bool dark) => dark ? (cfg?.imageUrlDark ?? cfg?.imageUrl) : cfg?.imageUrl;

/// Whether the admin has set a picture for this slot (for the current light/dark theme).
bool hasSlotImage(BuildContext context, String slot) {
  final cfg = context.watch<SyncState>().bundle?.images[slot];
  final uri = _slotUri(cfg, context.isDark);
  return uri != null && uri.isNotEmpty;
}

/// A decorative image the super-admin controls per slot: the picture (light/dark), how it is fitted
/// and positioned, an optional edge fade, and how it enters on mount. Draws nothing when no picture is set.
class ManagedImage extends StatelessWidget {
  final String slot;
  final Color? fadeColor;
  const ManagedImage({super.key, required this.slot, this.fadeColor});

  @override
  Widget build(BuildContext context) {
    final cfg = context.watch<SyncState>().bundle?.images[slot];
    final uri = _slotUri(cfg, context.isDark);
    if (uri == null || uri.isEmpty) return const SizedBox.shrink();

    final contain = cfg?.fit == 'contain';
    final align = switch (cfg?.position) {
      'top' => Alignment.topCenter,
      'bottom' => Alignment.bottomCenter,
      _ => Alignment.center,
    };
    final anim = cfg?.animation ?? 'fade';

    Widget image = Stack(
      fit: StackFit.expand,
      children: [
        KImage(uri, fit: contain ? BoxFit.contain : BoxFit.cover, alignment: align, cacheWidth: 1400),
        if (cfg != null && cfg.fade != 'none')
          IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: cfg.fade == 'down' ? Alignment.topCenter : Alignment.bottomCenter,
                  end: cfg.fade == 'down' ? Alignment.bottomCenter : Alignment.topCenter,
                  colors: [(fadeColor ?? Colors.white).withValues(alpha: 0), (fadeColor ?? Colors.white).withValues(alpha: 0.55), fadeColor ?? Colors.white],
                  stops: const [0, 0.72, 1],
                ),
              ),
            ),
          ),
      ],
    );

    if (anim == 'none') return ClipRect(child: image);
    return ClipRect(
      child: TweenAnimationBuilder<double>(
        key: ValueKey(uri),
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeOutCubic,
        builder: (_, v, child) => Opacity(
          opacity: v,
          child: Transform.translate(
            offset: switch (anim) {
              'slide-up' => Offset(0, (1 - v) * 28),
              'slide-down' => Offset(0, (1 - v) * -28),
              _ => Offset.zero,
            },
            child: anim == 'zoom' ? Transform.scale(scale: 0.9 + v * 0.1, child: child) : child,
          ),
        ),
        child: image,
      ),
    );
  }
}
