import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';

const _items = [
  (label: 'Home', icon: Icons.home_outlined, active: Icons.home_rounded),
  (label: 'Search', icon: Icons.search_rounded, active: Icons.search_rounded),
  (label: 'Map', icon: Icons.place_outlined, active: Icons.place_rounded),
  (label: 'Restaurants', icon: Icons.restaurant_outlined, active: Icons.restaurant_rounded),
];

/// The four places guests start from, in a rounded floating tab bar.
class AppShell extends StatelessWidget {
  final StatefulNavigationShell shell;
  const AppShell({super.key, required this.shell});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final dark = context.isDark;
    return Scaffold(
      body: shell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: c.tabBar,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          boxShadow: softShadow(dark, level: 2, up: true),
        ),
        padding: EdgeInsets.only(top: 12, bottom: MediaQuery.paddingOf(context).bottom.clamp(10, 40)),
        child: Row(
          children: [
            for (var i = 0; i < _items.length; i++)
              Expanded(
                child: InkResponse(
                  radius: 36,
                  onTap: () {
                    if (i != shell.currentIndex) HapticFeedback.selectionClick();
                    shell.goBranch(i, initialLocation: i == shell.currentIndex);
                  },
                  child: Semantics(
                    button: true,
                    selected: i == shell.currentIndex,
                    label: _items[i].label,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 50),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            i == shell.currentIndex ? _items[i].active : _items[i].icon,
                            size: 25,
                            color: i == shell.currentIndex ? c.link : c.placeholder,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            _items[i].label,
                            maxLines: 1,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: i == shell.currentIndex ? FontWeight.w800 : FontWeight.w600,
                              color: i == shell.currentIndex ? c.link : c.sub,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
