import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'header_art.dart';
import 'kimage.dart';

/// Mix a colour with black (amount < 0) or white (amount > 0).
Color shade(Color c, double amount) => amount < 0 ? Color.lerp(c, Colors.black, -amount)! : Color.lerp(c, Colors.white, amount)!;

/// Parse "#rrggbb"; anything else falls back to [fallback].
Color parseHex(String? hex, Color fallback) {
  if (hex == null) return fallback;
  final m = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(hex);
  return m == null ? fallback : Color(0xFF000000 | int.parse(m.group(1)!, radix: 16));
}

/// The picture at the top of a card or the left of a row: the photo when there is one, otherwise an
/// illustrated panel in the thing's own colour with the park's hills along the bottom.
///
/// The whole picture is shown with nothing cropped: it is fitted inside the box and the space left
/// over is filled with a soft, dimmed copy of the same picture, so there are no bare bars.
class Cover extends StatelessWidget {
  final String? image;
  final Color color;
  final IconData icon;
  final double? height, width;
  final double radius;
  final bool art;
  final Widget? child;
  const Cover({
    super.key,
    this.image,
    this.color = const Color(0xFF2F5B43),
    this.icon = Icons.star_rounded,
    this.height = 150,
    this.width,
    this.radius = 0,
    this.art = true,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    final h = height;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        height: h,
        width: width,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (image != null && image!.isNotEmpty) ...[
              ImageFiltered(
                imageFilter: ui.ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                child: KImage(image!, cacheWidth: 120),
              ),
              const ColoredBox(color: Color(0x47000000)),
              KImage(image!, fit: BoxFit.contain, cacheWidth: 900),
            ] else ...[
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [shade(color, -0.35), shade(color, 0.12)]),
                ),
              ),
              if (art && (h ?? 0) >= 90) const HeaderArt(),
              Padding(
                padding: EdgeInsets.only(bottom: (h ?? 0) >= 160 ? h! * 0.34 : 14),
                child: Center(child: Icon(icon, color: Colors.white.withValues(alpha: 0.55), size: ((h ?? 150) * 0.38).clamp(0, 54).toDouble())),
              ),
            ],
            ?child,
          ],
        ),
      ),
    );
  }
}
