import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';

const _items = [
  (label: 'Home', icon: Icons.home_outlined, active: Icons.home_rounded),
  (label: 'Search', icon: Icons.search_rounded, active: Icons.search_rounded),
  (label: 'Map', icon: Icons.map_outlined, active: Icons.map_rounded),
  (label: 'Eat', icon: Icons.restaurant_outlined, active: Icons.restaurant_rounded),
];

/// How much room a scrolling screen leaves at its foot so its last item clears the floating bar.
const navClearance = 104.0;

/// The four places guests start from, in a floating frosted bar: the chosen tab grows into a pill with its name.
class AppShell extends StatelessWidget {
  final StatefulNavigationShell shell;
  const AppShell({super.key, required this.shell});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final dark = context.isDark;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      extendBody: true,
      body: shell,
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, bottom + 12),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
            child: Container(
              height: 64,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: c.tabBar.withValues(alpha: dark ? 0.82 : 0.86),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: c.line.withValues(alpha: 0.7)),
                boxShadow: softShadow(dark, level: 2),
              ),
              // The chosen tab opens out to show its name; the others share what is left.
              child: LayoutBuilder(builder: (context, box) {
                const selectedWidth = 124.0;
                final other = (box.maxWidth - selectedWidth) / (_items.length - 1);
                return Row(children: [
                  for (var i = 0; i < _items.length; i++)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 260),
                      curve: Curves.easeOutCubic,
                      width: i == shell.currentIndex ? selectedWidth : other,
                      child: _NavItem(
                        label: _items[i].label,
                        icon: i == shell.currentIndex ? _items[i].active : _items[i].icon,
                        selected: i == shell.currentIndex,
                        onTap: () {
                          if (i != shell.currentIndex) HapticFeedback.selectionClick();
                          shell.goBranch(i, initialLocation: i == shell.currentIndex);
                        },
                      ),
                    ),
                ]);
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  const _NavItem({required this.label, required this.icon, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOutCubic,
            height: 44,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            decoration: BoxDecoration(color: selected ? c.primary : Colors.transparent, borderRadius: BorderRadius.circular(22)),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(icon, size: 23, color: selected ? Colors.white : c.sub),
              if (selected) Flexible(child: Padding(padding: const EdgeInsets.only(left: 8), child: Text(label, maxLines: 1, overflow: TextOverflow.clip, softWrap: false, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)))),
            ]),
          ),
        ),
      ),
    );
  }
}
