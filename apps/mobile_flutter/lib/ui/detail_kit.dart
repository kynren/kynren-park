import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import 'header_art.dart';
import 'kimage.dart';
import 'tap.dart';

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

/// The frame of a detail page: the hero, a sheet over it holding [children], a close button, and an optional bottom bar.
class DetailPage extends StatelessWidget {
  final List<String> images;
  final List<Color> colors;
  final List<Widget> children;
  final Widget? bottom;
  final double bottomPadding;
  final ScrollController? controller;
  const DetailPage({super.key, required this.images, required this.colors, required this.children, this.bottom, this.bottomPadding = 40, this.controller});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final top = MediaQuery.paddingOf(context).top;
    final hasPhoto = images.isNotEmpty;
    return Scaffold(
      backgroundColor: c.screen,
      body: Stack(fit: StackFit.expand, children: [
        ListView(
          controller: controller,
          padding: EdgeInsets.zero,
          children: [
            Container(
              height: hasPhoto ? detailHeroHeight : top + 230,
              color: colors.first,
              child: hasPhoto
                  ? ImageCarousel(images: images, height: detailHeroHeight)
                  : Stack(fit: StackFit.expand, children: [
                      DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: colors))),
                      const HeaderArt(),
                    ]),
            ),
            Transform.translate(
              offset: const Offset(0, -28),
              child: Container(
                padding: EdgeInsets.fromLTRB(18, 20, 18, bottomPadding),
                decoration: BoxDecoration(color: c.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(28))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
              ),
            ),
          ],
        ),
        Positioned(top: top + 8, right: 14, child: const CloseButton()),
        if (bottom != null) Positioned(left: 16, right: 16, bottom: MediaQuery.paddingOf(context).bottom + 12, child: bottom!),
      ]),
    );
  }
}

class CloseButton extends StatelessWidget {
  const CloseButton({super.key});
  @override
  Widget build(BuildContext context) => Tap(
        label: 'Close',
        onTap: () => context.canPop() ? context.pop() : context.go('/'),
        child: Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(color: Color(0x8C0F1F4B), shape: BoxShape.circle),
          child: const Icon(Icons.close_rounded, color: Colors.white, size: 20),
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
        Semantics(header: true, child: Text(title, style: TextStyle(fontFamily: Tokens.serif, color: c.text, fontSize: 25, fontWeight: FontWeight.w700, height: 31 / 25))),
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
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 17, color: c.link),
            const SizedBox(width: 8),
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: c.link))),
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
        child: Semantics(header: true, child: Text(text, style: TextStyle(fontFamily: Tokens.serif, fontSize: 16.5, fontWeight: FontWeight.w800, color: context.ui.text))),
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
