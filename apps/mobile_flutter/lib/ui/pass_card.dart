import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../core/theme.dart';

const _notch = 20.0;

/// A paper ticket: a parchment top with what it is and when, then the QR on white, big enough to scan from a phone held at the gate.
class PassCard extends StatelessWidget {
  final String title, code;
  final String? subtitle, footer;
  final double qrSize;
  final Widget? child;
  const PassCard({super.key, required this.title, required this.code, this.subtitle, this.footer, this.qrSize = 180, this.child});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(24), boxShadow: softShadow(context.isDark, level: 2)),
      child: Column(children: [
        Container(
          width: double.infinity,
          color: c.soft,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('ENTRANCE TICKET', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 2.5, color: c.accent)),
            const SizedBox(height: 4),
            Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 20, fontWeight: FontWeight.w700, color: c.text)),
            if (subtitle != null && subtitle!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, color: c.sub))),
            Container(margin: const EdgeInsets.only(top: 10), width: 44, height: 2, decoration: BoxDecoration(color: c.accent, borderRadius: BorderRadius.circular(1))),
          ]),
        ),
        SizedBox(
          height: _notch,
          child: Stack(alignment: Alignment.center, clipBehavior: Clip.none, children: [
            Positioned(left: -_notch / 2, child: Container(width: _notch, height: _notch, decoration: BoxDecoration(color: c.screen, shape: BoxShape.circle))),
            Positioned(right: -_notch / 2, child: Container(width: _notch, height: _notch, decoration: BoxDecoration(color: c.screen, shape: BoxShape.circle))),
            Padding(padding: const EdgeInsets.symmetric(horizontal: _notch), child: _Dashes(color: c.line)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(22, 0, 22, 16),
          child: Column(children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(Tokens.radiusCard)),
              child: QrImageView(data: code, size: qrSize, padding: EdgeInsets.zero, backgroundColor: Colors.white),
            ),
            if (footer != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(footer!, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: c.sub))),
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
          final n = (box.maxWidth / 9).floor();
          return Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [for (var i = 0; i < n; i++) Container(width: 5, height: 1.5, color: color)]);
        },
      );
}
