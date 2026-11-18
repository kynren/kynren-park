import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/auth.dart';
import '../core/profile.dart';
import '../core/theme.dart';
import '../core/tickets.dart';
import '../ui/controls.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';
import 'menu_screen.dart' show menuGroups;

/// The More tab: who the guest is signed in as, and everything the park app offers beyond the other tabs, in groups.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    final name = user == null ? '' : context.watch<ProfileState>().firstName(user, context.watch<TicketsState>().tickets);

    final account = KCard(
      padding: const EdgeInsets.all(18),
      child: user != null
          ? Row(children: [
              Container(width: 48, height: 48, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.person_rounded, color: c.link, size: 26)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Hello${name.isNotEmpty ? ', $name' : ''}', style: TextStyle(fontFamily: Tokens.display, fontSize: 19, fontWeight: FontWeight.w800, color: c.text)),
                  if ((user.email ?? '').isNotEmpty) Text(user.email!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: c.sub)),
                ]),
              ),
            ])
          : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Welcome', style: TextStyle(fontFamily: Tokens.display, fontSize: 19, fontWeight: FontWeight.w800, color: c.text)),
              const SizedBox(height: 4),
              Text('Sign in to see your tickets, reminders and your day.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
              const SizedBox(height: 14),
              KButton('Sign in or create account', small: true, onPressed: () => context.push('/auth')),
            ]),
    );

    return KScreen(
      title: 'More',
      subtitle: 'Everything else in the park app',
      page: 'more',
      back: false,
      children: [
        account,
        for (final g in menuGroups)
          if (g.entries.any((e) => !e.personal || user != null))
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 6, 4, 8),
                child: Semantics(header: true, child: Text(g.title.toUpperCase(), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.4, color: c.sub))),
              ),
              KCard(
                padding: EdgeInsets.zero,
                child: Column(children: [
                  for (final (i, e) in g.entries.where((e) => !e.personal || user != null).indexed)
                    Tap(
                      onTap: () => context.push(e.to),
                      label: e.label,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: c.line, width: 0.5))),
                        child: Row(children: [
                          Container(width: 40, height: 40, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(e.icon, color: c.link, size: 21)),
                          const SizedBox(width: 14),
                          Expanded(child: Text(e.label, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: c.text))),
                          Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 22),
                        ]),
                      ),
                    ),
                ]),
              ),
            ]),
      ],
    );
  }
}
