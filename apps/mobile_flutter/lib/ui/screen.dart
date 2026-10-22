import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'managed_image.dart';
import 'screen_header.dart';

/// The picture the admin has set behind a whole page (System → App Images → Page backgrounds),
/// softened with the page colour so cards and text on top stay easy to read.
class PageBackdrop extends StatelessWidget {
  final String page;
  const PageBackdrop(this.page, {super.key});

  @override
  Widget build(BuildContext context) {
    final slot = 'screen.$page';
    if (!hasSlotImage(context, slot)) return const SizedBox.shrink();
    final c = context.ui;
    return Positioned.fill(
      child: IgnorePointer(
        child: Stack(
          children: [
            Positioned.fill(child: ManagedImage(slot: slot, fadeColor: c.screen)),
            Positioned.fill(child: ColoredBox(color: c.screen.withValues(alpha: 0.86))),
          ],
        ),
      ),
    );
  }
}

/// The frame for every screen opened from the menu or a card: the app's header with a back arrow,
/// then a padded scrolling body. (Home, Search, Map, Restaurants lay out their own headers.)
class KScreen extends StatelessWidget {
  final String title;
  final String? subtitle, page;
  final List<Widget> children;
  final List<Color>? colors;
  final Widget? right;
  final VoidCallback? onBack;
  final Future<void> Function()? onRefresh;
  final bool padded;
  /// false for screens reached from the tab bar, which show the menu button instead of a back arrow.
  final bool back;
  /// Sits on the page just under the header band (a search pill, usually).
  final Widget? below;
  const KScreen({
    super.key,
    required this.title,
    required this.children,
    this.subtitle,
    this.page,
    this.colors,
    this.right,
    this.onBack,
    this.onRefresh,
    this.padded = true,
    this.back = true,
    this.below,
  });

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    Widget list = ListView(
      padding: EdgeInsets.zero,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        ScreenHeader(title: title, subtitle: subtitle, page: page, colors: colors ?? const [Tokens.bandFrom, Tokens.bandTo], back: back, onMenu: onBack, right: right, below: below),
        Padding(
          padding: padded ? const EdgeInsets.fromLTRB(20, 20, 20, 40) : const EdgeInsets.only(bottom: 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0 && padded) const SizedBox(height: 14),
                children[i],
              ],
            ],
          ),
        ),
      ],
    );
    if (onRefresh != null) list = RefreshIndicator(onRefresh: onRefresh!, child: list);
    return Scaffold(
      backgroundColor: c.screen,
      body: Stack(fit: StackFit.expand, children: [if (page != null) PageBackdrop(page!), Positioned.fill(child: list)]),
    );
  }
}
