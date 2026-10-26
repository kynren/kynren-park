import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import 'header_art.dart';
import 'kimage.dart';
import 'tap.dart';
import 'status_bar.dart';
import 'top_bar.dart';

// Shared visual language for the show / restaurant / shop / facility detail pages: a full-bleed photo
// (or the feature's own gradient when there is none) with a rounded sheet rising over it.

const detailHeroHeight = 340.0;

/// A swipeable hero gallery: one image just fills the space; two or more page horizontally with dot indicators.
class ImageCarousel extends StatefulWidget {
  final List<String> images;
  final double height;
  const ImageCarousel({super.key, required this.images, required this.height});
  @override
  State<ImageCarousel> createState() => _ImageCarouselState();
}

class _ImageCarouselState extends State<ImageCarousel> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    Widget img(String url) => KImage(url, cacheWidth: 1200, error: (_) => const ColoredBox(color: Color(0xFF0E1013)));
    if (widget.images.length == 1) return SizedBox(height: widget.height, width: double.infinity, child: img(widget.images.first));
    return SizedBox(
      height: widget.height,
      child: Stack(children: [
        PageView(onPageChanged: (p) => setState(() => _page = p), children: [for (final u in widget.images) img(u)]),
        Positioned(
          left: 0,
          right: 0,
          bottom: 14,
          child: IgnorePointer(
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              for (var i = 0; i < widget.images.length; i++)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 18 : 6,
                  height: 6,
                  decoration: BoxDecoration(color: i == _page ? Colors.white : Colors.white54, borderRadius: BorderRadius.circular(3)),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// The frame of a detail page: the hero, a sheet over it holding [children], the shared top bar (back, the [title] once
/// you scroll, the bell), and an optional bottom bar.
class DetailPage extends StatefulWidget {
  final List<String> images;
  final List<Color> colors;
  final String title;
  final List<Widget> children;
  final Widget? bottom;
  final double bottomPadding;
  final ScrollController? controller;
  const DetailPage({super.key, required this.images, required this.colors, this.title = '', required this.children, this.bottom, this.bottomPadding = 40, this.controller});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  late final ScrollController _scroll = widget.controller ?? ScrollController();
  double _offset = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final o = _scroll.hasClients ? _scroll.offset.clamp(0.0, 600.0) : 0.0;
      if (o != _offset) setState(() => _offset = o);
    });
  }

  @override
  void dispose() {
    if (widget.controller == null) _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final top = MediaQuery.paddingOf(context).top;
    final images = widget.images, colors = widget.colors;
    final hasPhoto = images.isNotEmpty;
    final heroH = hasPhoto ? detailHeroHeight : top + 230;
    return StatusBarIcons(
      light: true,
      child: Scaffold(
      backgroundColor: c.screen,
      body: Stack(fit: StackFit.expand, children: [
        ListView(
          controller: _scroll,
          padding: EdgeInsets.zero,
          children: [
            // The hero drifts at half speed as the sheet slides up over it.
            SizedBox(
              height: heroH,
              child: ClipRect(
                child: Transform.translate(
                  offset: Offset(0, _offset * 0.5),
                  child: Container(
                    height: heroH,
                    color: colors.first,
                    child: hasPhoto
                        ? ImageCarousel(images: images, height: detailHeroHeight)
                        : Stack(fit: StackFit.expand, children: [
                            DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: colors))),
                            const HeaderArt(),
                          ]),
                  ),
                ),
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -32),
              child: Container(
                padding: EdgeInsets.fromLTRB(20, 12, 20, widget.bottomPadding),
                decoration: BoxDecoration(color: c.screen, borderRadius: const BorderRadius.vertical(top: Radius.circular(32))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 18), decoration: BoxDecoration(color: c.line, borderRadius: BorderRadius.circular(2)))),
                  ...widget.children,
                ]),
              ),
            ),
          ],
        ),
        // a soft fade under the status bar, so its white icons read on a bright picture
        Positioned(top: 0, left: 0, right: 0, height: top + 56, child: const IgnorePointer(child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x73000000), Color(0x00000000)]))))),
        // the hero is tall, so the bar only turns solid once the sheet has covered most of it
        KTopBar(title: widget.title, offset: _offset + 140 - (heroH - top - 80), back: true),
        if (widget.bottom != null) Positioned(left: 16, right: 16, bottom: MediaQuery.paddingOf(context).bottom + 12, child: widget.bottom!),
      ]),
      ),
    );
  }
}

class CloseButton extends StatelessWidget {
  const CloseButton({super.key});
  @override
  Widget build(BuildContext context) => Tap(
        label: 'Close',
        onTap: () => context.canPop() ? context.pop() : context.go('/'),
        child: ClipOval(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(
              width: 42,
              height: 42,
              decoration: const BoxDecoration(color: Color(0x55000000), shape: BoxShape.circle),
              child: const Icon(Icons.close_rounded, color: Colors.white, size: 22),
            ),
          ),
        ),
      );
}

/// The name of the place, at the top of the sheet under the picture.
class SheetTitle extends StatelessWidget {
  final String title;
  final String? subtitle;
  const SheetTitle(this.title, {super.key, this.subtitle});
  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Semantics(header: true, child: Text(title, style: TextStyle(fontFamily: Tokens.display, color: c.text, fontSize: 30, fontWeight: FontWeight.w800, height: 35 / 30, letterSpacing: -0.8))),
        if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 3), child: Text(subtitle!, style: TextStyle(color: c.sub, fontSize: 14))),
      ]),
    );
  }
}

class TagChip extends StatelessWidget {
  final String icon, label;
  const TagChip({super.key, required this.icon, required this.label});
  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 13),
      decoration: BoxDecoration(color: c.soft, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(icon, style: const TextStyle(fontSize: 13)),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.sub)),
      ]),
    );
  }
}

class ActionPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const ActionPill({super.key, required this.icon, required this.label, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Expanded(
      child: Tap(
        onTap: onTap,
        label: label,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(20)),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 22, color: c.link),
            const SizedBox(height: 6),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5, color: c.link)),
          ]),
        ),
      ),
    );
  }
}

class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Semantics(header: true, child: Text(text, style: TextStyle(fontFamily: Tokens.display, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.4, color: context.ui.text))),
      );
}

/// A line of quiet body text.
class Muted extends StatelessWidget {
  final String text;
  const Muted(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Text(text, style: TextStyle(color: context.ui.sub, fontSize: 13));
}

/// A screen's "not found" state.
class NotFound extends StatelessWidget {
  final String text;
  /// Show a spinner instead: the park data is still loading, so the place may yet turn up.
  final bool loading;
  const NotFound(this.text, {super.key, this.loading = false});
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: context.ui.screen,
        body: Stack(children: [
          Center(child: loading ? const CircularProgressIndicator() : Muted(text)),
          Positioned(top: MediaQuery.paddingOf(context).top + 8, right: 14, child: const CloseButton()),
        ]),
      );
}
