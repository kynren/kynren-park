import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../core/theme.dart';
import 'header_art.dart';

const _notch = 22.0;

/// A boarding-pass style ticket: a brand-coloured top with what it is and when, a perforated tear line, then the QR on
/// white, big enough to scan from a phone held at the gate.
class PassCard extends StatelessWidget {
  final String title, code;
  final String? subtitle, footer;
  final double qrSize;
  final Widget? child;
  const PassCard({super.key, required this.title, required this.code, this.subtitle, this.footer, this.qrSize = 180, this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final dark = context.isDark;
    final gradient = featureGradient['tickets']!;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(28), boxShadow: softShadow(dark, level: 2)),
      child: Column(children: [
        Stack(children: [
          Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: gradient)))),
          const HeaderArt(),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 26),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.confirmation_number_rounded, color: Color(0xCCFFFFFF), size: 16),
                const SizedBox(width: 8),
                const Text('ENTRANCE TICKET', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 2, color: Color(0xCCFFFFFF))),
              ]),
              const SizedBox(height: 10),
              Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: Tokens.display, fontSize: 24, fontWeight: FontWeight.w800, height: 1.15, letterSpacing: -0.5, color: Colors.white)),
              if (subtitle != null && subtitle!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Color(0xCCFFFFFF)))),
            ]),
          ),
        ]),
        SizedBox(
          height: _notch,
          child: Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
            Positioned(left: -_notch / 2, child: Container(width: _notch, height: _notch, decoration: BoxDecoration(color: c.screen, shape: BoxShape.circle))),
            Positioned(right: -_notch / 2, child: Container(width: _notch, height: _notch, decoration: BoxDecoration(color: c.screen, shape: BoxShape.circle))),
            Padding(padding: const EdgeInsets.symmetric(horizontal: _notch + 4), child: _Dashes(color: c.line)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 22),
          child: Column(children: [
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: c.line)),
              child: QrImageView(
                data: code,
                size: qrSize,
                padding: EdgeInsets.zero,
                backgroundColor: Colors.white,
                // square modules: the most reliable thing for a gate scanner to read
                eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Colors.black),
                dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.black),
              ),
            ),
            if (footer != null) Padding(padding: const EdgeInsets.only(top: 14), child: Text(footer!, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: c.text))),
            ?child,
          ]),
        ),
      ]),
    );
  }
}

class _Dashes extends StatelessWidget {
  final Color color;
  const _Dashes({required this.color});
  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (_, box) {
          final n = (box.maxWidth / 11).floor();
          return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [for (var i = 0; i < n; i++) Container(width: 6, height: 2, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(1)))]);
        },
      );
}
