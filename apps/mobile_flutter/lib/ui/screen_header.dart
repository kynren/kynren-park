import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import 'header_art.dart';
import 'managed_image.dart';
import 'tap.dart';

/// The top of every screen: a tall band in the feature's colour with the storybook landscape along
/// its foot, a menu (or back) button and an optional slot on the right, and the screen's name large
/// in serif beneath them. [below] (a search pill, usually) sits on the page just under the band.
class ScreenHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? right;
  final VoidCallback? onMenu;
  final bool back;
  final Widget? below;
  final List<Color> colors;

  /// The page's name in App Images: the admin's `header.<page>` picture, if set, replaces the plain band.
  final String? page;

  const ScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.right,
    this.onMenu,
    this.back = false,
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
          borderRadius: const BorderRadius.vertical(bottom: Radius.circular(32)),
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
                const HeaderArt(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: EdgeInsets.fromLTRB(20, MediaQuery.paddingOf(context).top + 8, 20, 0),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 44,
                          height: 44,
                          child: Tap(
                            onTap: onMenu ?? (back ? () => _back(context) : () => context.push('/menu')),
                            label: back ? 'Go back' : 'Open menu',
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: Icon(back ? Icons.arrow_back_rounded : Icons.menu_rounded, color: Colors.white, size: 26),
                            ),
                          ),
                        ),
                        const Spacer(),
                        ?right,
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 4, 22, 50),
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
                                fontFamily: Tokens.serif,
                                color: Colors.white,
                                fontSize: 28,
                                fontWeight: FontWeight.w700,
                                height: 33 / 28,
                                shadows: [Shadow(color: Color(0x40000000), blurRadius: 6, offset: Offset(0, 1))],
                              ),
                            ),
                          ),
                          if (subtitle != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xDBFFFFFF), fontSize: 14.5, height: 20 / 14.5)),
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

  static void _back(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }
}
