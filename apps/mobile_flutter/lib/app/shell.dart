import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';

/// How much room a scrolling screen leaves at its foot so its last item clears the bottom bar.
const navClearance = 104.0;

/// The bar's own height (not counting the phone's bottom inset) and how far the round Home button rises above it.
const navBarHeight = 64.0;
const _homeSize = 68.0;
const navHomeRise = 28.0;

// The tabs beside Home, left to right, with the branch each one opens (the shell's branches are Home, Search, Map, Eat).
const _left = [
  (label: 'Map', icon: Icons.map_outlined, active: Icons.map_rounded, branch: 2),
  (label: 'Search', icon: Icons.search_rounded, active: Icons.search_rounded, branch: 1),
];
const _right = [
  (label: 'Eat', icon: Icons.restaurant_outlined, active: Icons.restaurant_rounded, branch: 3),
];

/// The bottom bar: a flat bar with a label under every icon and, in the middle, a round Home button standing proud of it.
/// The last slot, More, is not a tab: it opens the side menu.
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
    final homeSelected = shell.currentIndex == 0;

    Widget tab(({String label, IconData icon, IconData active, int branch}) t) {
      final selected = shell.currentIndex == t.branch;
      return Expanded(child: _NavItem(label: t.label, icon: selected ? t.active : t.icon, selected: selected, onTap: () => _open(t.branch)));
    }

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
            height: barTotal + navHomeRise,
            child: Stack(clipBehavior: Clip.none, children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                height: barTotal,
                child: Container(
                  padding: EdgeInsets.only(bottom: bottom),
                  decoration: BoxDecoration(
                    color: c.card,
                    border: Border(top: BorderSide(color: c.line)),
                    boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: dark ? 0.4 : 0.08), blurRadius: 18, offset: const Offset(0, -4))],
                  ),
                  child: Row(children: [
                    for (final t in _left) tab(t),
                    const Expanded(child: SizedBox.shrink()), // the room Home stands in
                    for (final t in _right) tab(t),
                    Expanded(child: _NavItem(label: 'More', icon: Icons.grid_view_rounded, selected: false, onTap: () => context.push('/menu'))),
                  ]),
                ),
              ),
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Center(child: _HomeButton(selected: homeSelected, onTap: () => _open(0))),
              ),
            ]),
          ),
      ]),
    );
  }
}

/// The round Home button: the brand colour in a ring the colour of the bar, with a soft glow.
class _HomeButton extends StatelessWidget {
  final bool selected;
  final VoidCallback onTap;
  const _HomeButton({required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Semantics(
      button: true,
      selected: selected,
      label: 'Home',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          width: _homeSize,
          height: _homeSize,
          decoration: BoxDecoration(
            color: c.primary,
            shape: BoxShape.circle,
            border: Border.all(color: c.card, width: 5),
            boxShadow: [
              BoxShadow(color: c.primary.withValues(alpha: selected ? 0.55 : 0.32), blurRadius: selected ? 22 : 16, spreadRadius: selected ? 3 : 0),
              BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 10, offset: const Offset(0, 4)),
            ],
          ),
          child: Icon(selected ? Icons.home_rounded : Icons.home_outlined, size: 32, color: Colors.white),
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
    final colour = selected ? c.link : c.sub;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          AnimatedScale(duration: const Duration(milliseconds: 200), scale: selected ? 1.08 : 1, child: Icon(icon, size: 26, color: colour)),
          const SizedBox(height: 3),
          Text(label, maxLines: 1, style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.w800 : FontWeight.w600, color: colour)),
        ]),
      ),
    );
  }
}
