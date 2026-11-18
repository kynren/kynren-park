import 'package:flutter/material.dart';
import '../core/theme.dart';

/// A calm "nothing here yet" panel: an icon in a tinted circle, a heading and one line of help.
class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title, body;
  final Widget? action;
  const EmptyState({super.key, required this.icon, required this.title, required this.body, this.action});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 12),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle),
          child: Icon(icon, size: 28, color: c.link),
        ),
        const SizedBox(height: 14),
        Text(title, textAlign: TextAlign.center, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.text)),
        const SizedBox(height: 6),
        Text(body, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: c.sub)),
        if (action != null) ...[const SizedBox(height: 16), action!],
      ]),
    );
  }
}
