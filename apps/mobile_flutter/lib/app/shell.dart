import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';

/// Set by the map while a place card is up: the bar slides away so the card can start from the very bottom of the screen.
final navHiddenByMap = ValueNotifier<bool>(false);

/// How much room a scrolling screen leaves at its foot so its last item clears the bottom bar.
const navClearance = 84.0;

/// The bar's own height (not counting the phone's bottom inset). Nothing rises above it any more; the map still asks how far.
const navBarHeight = 60.0;
const navHomeRise = 0.0;

// The five tabs, left to right, with the branch each one opens (the shell's branches are Home, Search, Map, Eat, More).
const _tabs = [
  (label: 'Home', icon: Icons.home_outlined, active: Icons.home_rounded, branch: 0),
  (label: 'Search', icon: Icons.search_rounded, active: Icons.search_rounded, branch: 1),
  (label: 'Map', icon: Icons.map_outlined, active: Icons.map_rounded, branch: 2),
  (label: 'Eat', icon: Icons.restaurant_outlined, active: Icons.restaurant_rounded, branch: 3),
  (label: 'More', icon: Icons.grid_view_outlined, active: Icons.grid_view_rounded, branch: 4),
];

/// The bottom bar: a flat white bar with five icons, the open one in Kynren red with a small dot under it. Each icon has a
/// spoken label for screen readers. More, the last tab, holds everything the park app offers beyond the others.
class AppShell extends StatelessWidget {
  final StatefulNavigationShell shell;
  const AppShell({super.key, required this.shell});

  void _open(int branch) {
    if (branch != shell.currentIndex) HapticFeedback.selectionClick();
    shell.goBranch(branch, initialLocation: branch == shell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final dark = context.isDark;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final keyboard = MediaQuery.viewInsetsOf(context).bottom > 0;
    final barTotal = navBarHeight + bottom;

    return Scaffold(
      backgroundColor: c.screen,
      body: Stack(children: [
        Positioned.fill(child: shell),
        // Hidden while the keyboard is up, so it never rides over what is being typed.
        if (!keyboard)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: barTotal,
            child: ValueListenableBuilder<bool>(
              valueListenable: navHiddenByMap,
              builder: (context, mapWantsItGone, child) {
                final hidden = mapWantsItGone && shell.currentIndex == 2; // only while the Map tab is the one showing
                return IgnorePointer(
                  ignoring: hidden,
                  child: AnimatedSlide(offset: Offset(0, hidden ? 1.15 : 0), duration: const Duration(milliseconds: 220), curve: Curves.easeOutCubic, child: child),
                );
              },
              child: Container(
                padding: EdgeInsets.only(bottom: bottom),
                decoration: BoxDecoration(
                  color: c.tabBar,
                  border: dark ? Border(top: BorderSide(color: c.line)) : null,
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? 0.4 : 0.07), blurRadius: 14, offset: const Offset(0, -2))],
                ),
                child: Row(children: [
                  for (final t in _tabs)
                    Expanded(
                      child: _NavItem(
                        label: t.label,
                        icon: shell.currentIndex == t.branch ? t.active : t.icon,
                        selected: shell.currentIndex == t.branch,
                        onTap: () => _open(t.branch),
                      ),
                    ),
                ]),
              ),
            ),
          ),
      ]),
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
    final colour = selected ? c.accent : c.placeholder;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          AnimatedScale(duration: const Duration(milliseconds: 200), scale: selected ? 1.1 : 1, child: Icon(icon, size: 26, color: colour)),
          const SizedBox(height: 4),
          AnimatedContainer(duration: const Duration(milliseconds: 200), width: selected ? 5 : 0, height: 5, decoration: BoxDecoration(color: c.accent, shape: BoxShape.circle)),
        ]),
      ),
    );
  }
}
