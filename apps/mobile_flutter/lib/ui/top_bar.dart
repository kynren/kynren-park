import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/notifications.dart';
import '../core/theme.dart';
import 'tap.dart';

/// The notifications bell, with the unread count.
class BellButton extends StatelessWidget {
  final bool onDark;
  const BellButton({super.key, this.onDark = true});

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<UnreadNotifications>().count;
    final c = context.ui;
    return Tap(
      onTap: () => context.push('/notifications'),
      label: unread > 0 ? 'Notifications, $unread unread' : 'Notifications',
      child: _RoundIcon(
        onDark: onDark,
        child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
          const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 23),
          if (unread > 0)
            Positioned(
              top: -2,
              right: -3,
              child: Container(
                constraints: const BoxConstraints(minWidth: 16),
                height: 16,
                padding: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(color: Tokens.accent, borderRadius: BorderRadius.circular(8), border: Border.all(color: c.screen, width: 1.5)),
                child: Center(child: Text(unread > 9 ? '9+' : '$unread', style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800))),
              ),
            ),
        ]),
      ),
    );
  }
}

class _RoundIcon extends StatelessWidget {
  final Widget child;
  final bool onDark;
  const _RoundIcon({required this.child, required this.onDark});
  @override
  Widget build(BuildContext context) => ClipOval(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(width: 42, height: 42, color: const Color(0x38FFFFFF), alignment: Alignment.center, child: child),
        ),
      );
}

/// The one top bar every screen shares: menu or back on the left, the notifications bell (or your own action) on the
/// right, and the screen's name fading in at the centre once you scroll past its header. [offset] is the scroll
/// position; the bar stays see-through over the header and turns into a solid green band as the page moves under it.
class KTopBar extends StatelessWidget {
  final String title;
  final double offset;
  final bool back;
  final VoidCallback? onBack;
  final Widget? right;
  final bool showBell;
  const KTopBar({super.key, required this.title, required this.offset, this.back = false, this.onBack, this.right, this.showBell = true});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final solid = ((offset - 60) / 80).clamp(0.0, 1.0);
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      height: top + 60,
      child: Stack(children: [
        // the band that fades in as content scrolls beneath
        Positioned.fill(
          child: IgnorePointer(
            child: Opacity(
              opacity: solid,
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Tokens.bandFrom, Tokens.bandTo]),
                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(22)),
                  boxShadow: [BoxShadow(color: Color(0x33000000), blurRadius: 14, offset: Offset(0, 4))],
                ),
              ),
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(16, top + 8, 16, 0),
          child: Row(children: [
            Tap(
              onTap: onBack ?? (back ? () => (context.canPop() ? context.pop() : context.go('/')) : () => context.push('/menu')),
              label: back ? 'Go back' : 'Open menu',
              child: _RoundIcon(onDark: true, child: Icon(back ? Icons.arrow_back_rounded : Icons.menu_rounded, color: Colors.white, size: 23)),
            ),
            Expanded(
              child: Opacity(
                opacity: solid,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                ),
              ),
            ),
            if (right != null) right! else if (showBell) const BellButton() else const SizedBox(width: 42),
          ]),
        ),
      ]),
    );
  }
}
