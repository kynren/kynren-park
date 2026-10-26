import 'package:flutter/material.dart';
import '../app/shell.dart' show navClearance;
import '../core/theme.dart';
import 'managed_image.dart';
import 'screen_header.dart';
import 'status_bar.dart';
import 'top_bar.dart';

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
class KScreen extends StatefulWidget {
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
  State<KScreen> createState() => _KScreenState();
}

class _KScreenState extends State<KScreen> {
  final _scroll = ScrollController();
  double _offset = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final o = _scroll.hasClients ? _scroll.offset.clamp(0.0, 400.0) : 0.0;
      if (o != _offset) setState(() => _offset = o);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final w = widget;
    Widget list = ListView(
      controller: _scroll,
      padding: EdgeInsets.zero,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        ScreenHeader(title: w.title, subtitle: w.subtitle, page: w.page, colors: w.colors ?? const [Tokens.bandFrom, Tokens.bandTo], below: w.below),
        Padding(
          padding: w.padded ? EdgeInsets.fromLTRB(20, 20, 20, w.back ? 40 : navClearance) : EdgeInsets.only(bottom: w.back ? 40 : navClearance),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var i = 0; i < w.children.length; i++) ...[
                if (i > 0 && w.padded) const SizedBox(height: 14),
                w.children[i],
              ],
            ],
          ),
        ),
      ],
    );
    if (w.onRefresh != null) list = RefreshIndicator(onRefresh: w.onRefresh!, edgeOffset: MediaQuery.paddingOf(context).top + 60, child: list);
    return StatusBarIcons(
      light: true,
      child: Scaffold(
        backgroundColor: c.screen,
        body: Stack(fit: StackFit.expand, children: [
          if (w.page != null) PageBackdrop(w.page!),
          Positioned.fill(child: list),
          KTopBar(title: w.title, offset: _offset, back: w.back, onBack: w.onBack, right: w.right, showBell: w.page != 'notifications'),
        ]),
      ),
    );
  }
}
