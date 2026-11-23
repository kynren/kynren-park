import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/needs_logic.dart';
import '../core/profile.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

const _amber = Color(0xFFD99A0B);

/// "What suits me": tick what your group needs once (the same choices Settings keeps) and every attraction is marked as
/// meeting them all, some of them, or none, from what the park lists on each one.
class SuitsMeScreen extends StatelessWidget {
  const SuitsMeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final profile = context.watch<ProfileState>();
    final bundle = context.watch<SyncState>().bundle;
    final needs = needsFromProfile(profile.saved);
    final fits = fitFor(bundle?.attractions ?? const [], needs);

    Future<void> toggle(Need n) => profile.update({needKey[n]!: !needs.contains(n)});

    ({Color color, IconData icon, String label}) look(AttractionFit f) => switch (f.fit) {
          Fit.full => (color: Tokens.ok, icon: Icons.check_rounded, label: 'Meets everything you chose'),
          Fit.partial => (color: _amber, icon: Icons.remove_rounded, label: 'Not available: ${f.missing.map((n) => needLabel[n]!.toLowerCase()).join(', ')}'),
          Fit.none => (color: Tokens.danger, icon: Icons.close_rounded, label: 'None of what you chose is listed'),
          Fit.unknown => (color: c.sub, icon: Icons.chevron_right_rounded, label: ''),
        };

    return KScreen(
      title: 'What suits me',
      subtitle: 'Tell us what your group needs',
      page: 'accessibility',
      children: [
        KCard(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Tap everything that applies', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text)),
            const SizedBox(height: 4),
            Text('We keep this on your phone, and use it to mark each attraction below.', style: TextStyle(fontSize: 13, height: 18 / 13, color: c.sub)),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final n in Need.values)
                Tap(
                  onTap: () => toggle(n),
                  label: '${needLabel[n]}, ${needs.contains(n) ? 'on' : 'off'}',
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(color: needs.contains(n) ? c.primary : c.tint, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      if (needs.contains(n)) ...[const Icon(Icons.check_rounded, size: 16, color: Colors.white), const SizedBox(width: 6)],
                      Text(needLabel[n]!, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: needs.contains(n) ? Colors.white : c.link)),
                    ]),
                  ),
                ),
            ]),
          ]),
        ),
        if (bundle == null)
          const LinearProgressIndicator(minHeight: 2)
        else if (fits.isEmpty)
          Text('No attractions have been added yet.', style: TextStyle(fontSize: 13.5, color: c.sub))
        else ...[
          Text(needs.isEmpty ? 'ATTRACTIONS' : 'HOW THEY FIT', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: c.sub)),
          for (final f in fits)
            () {
              final l = look(f);
              return KCard(
                onTap: () => context.push('/attraction/${f.attraction.slug}'),
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(color: l.color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                    child: Icon(l.icon, size: 20, color: l.color),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(f.attraction.name, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: c.text)),
                      if (l.label.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(l.label, style: TextStyle(fontSize: 12.5, height: 17 / 12.5, color: c.sub))),
                    ]),
                  ),
                  if (f.fit != Fit.unknown) Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
                ]),
              );
            }(),
          Text('Based on what the park has listed for each attraction. If something matters to you, check with a steward on the day.', style: TextStyle(fontSize: 12, height: 17 / 12, color: c.sub)),
        ],
      ],
    );
  }
}
