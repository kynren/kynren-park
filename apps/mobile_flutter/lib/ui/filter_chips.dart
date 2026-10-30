import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'tap.dart';

/// A row of filter chips: the chosen one is filled.
class FilterChips extends StatelessWidget {
  final List<String> labels;
  final String chosen;
  final void Function(String) onPick;
  const FilterChips({super.key, required this.labels, required this.chosen, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          for (final l in labels)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Tap(
                onTap: () => onPick(l),
                label: l,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: chosen == l ? c.primary : c.card, borderRadius: BorderRadius.circular(999), border: Border.all(color: chosen == l ? c.primary : c.line)),
                  child: Text(l, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: chosen == l ? Colors.white : c.text)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
