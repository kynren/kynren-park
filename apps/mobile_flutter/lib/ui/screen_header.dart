import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'managed_image.dart';

/// The top of every screen: a tall band in the feature's colour with the screen's name large beneath the shared top bar
/// (see [KTopBar], which floats over it). [below] (a search pill, usually) sits on the page just under the band.
class ScreenHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? below;
  final List<Color> colors;

  /// The page's name in App Images: the admin's `header.<page>` picture, if set, replaces the plain band.
  final String? page;

  const ScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.below,
    this.colors = const [Tokens.bandFrom, Tokens.bandTo],
    this.page,
  });

  @override
  Widget build(BuildContext context) {
    final slot = page == null ? null : 'header.$page';
    final hasPicture = slot != null && hasSlotImage(context, slot);
    return Column(
      children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(bottom: Radius.circular(36)),
          child: Stack(
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: colors)),
                ),
              ),
              if (hasPicture) ...[
                Positioned.fill(child: ManagedImage(slot: slot, fadeColor: colors.last)),
                // a light veil keeps the title readable whatever the picture is
                const Positioned.fill(child: ColoredBox(color: Color(0x52000000))),
              ] else
                const _SoftShapes(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: MediaQuery.paddingOf(context).top + 60),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 24, 22, 50),
                    child: SizedBox(
                      width: double.infinity,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Semantics(
                            header: true,
                            child: Text(
                              title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontFamily: Tokens.display,
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                height: 26 / 20,
                                letterSpacing: -0.4,
                              ),
                            ),
                          ),
                          if (subtitle != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xCCFFFFFF), fontSize: 15, fontWeight: FontWeight.w500, height: 21 / 15)),
                            ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (below != null) Padding(padding: const EdgeInsets.fromLTRB(20, 18, 20, 6), child: below),
      ],
    );
  }

}

/// Quiet, overlapping circles of light behind the title: depth without a picture.
class _SoftShapes extends StatelessWidget {
  const _SoftShapes();
  @override
  Widget build(BuildContext context) => const Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _ShapesPainter())));
}

class _ShapesPainter extends CustomPainter {
  const _ShapesPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width, h = size.height;
    canvas.drawCircle(Offset(w * 0.92, h * 0.12), h * 0.62, Paint()..color = Colors.white.withValues(alpha: 0.07));
    canvas.drawCircle(Offset(w * 0.78, h * 0.95), h * 0.42, Paint()..color = Colors.white.withValues(alpha: 0.05));
    canvas.drawCircle(Offset(w * 0.02, h * 1.05), h * 0.5, Paint()..color = Colors.black.withValues(alpha: 0.08));
  }

  @override
  bool shouldRepaint(_ShapesPainter old) => false;
}
