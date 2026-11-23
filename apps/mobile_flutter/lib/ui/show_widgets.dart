import 'package:flutter/material.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/preferences.dart';
import '../core/theme.dart';
import 'controls.dart';
import 'cover.dart';
import 'tap.dart';

const timeBadge = Color(0xFFE8861A);

Color _catColor(Session s) => categoryColor[s.attractionCategory] ?? Tokens.brand;

class _TimePill extends StatelessWidget {
  final String text;
  const _TimePill(this.text);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: timeBadge, borderRadius: BorderRadius.circular(8)),
        child: Text(text, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12.5)),
      );
}

/// The list version of a coming-up show: a small picture, the name and the start time.
class ShowRow extends StatelessWidget {
  final Session session;
  final String? image;
  final VoidCallback onTap;
  const ShowRow({super.key, required this.session, this.image, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final live = session.status != 'SCHEDULED';
    return KCard(
      onTap: onTap,
      padding: const EdgeInsets.all(10),
      child: Row(
        children: [
          Cover(image: image, color: _catColor(session), icon: Icons.calendar_month_rounded, height: 60, width: 60, radius: 14),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(session.attractionName, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: c.text)),
                const SizedBox(height: 5),
                _TimePill(fmtTime(session.revisedStart ?? session.startTime)),
              ],
            ),
          ),
          if (live) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 10),
              decoration: BoxDecoration(color: statusColor[session.status] ?? c.sub, borderRadius: BorderRadius.circular(999)),
              child: Text(session.status, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
            ),
          ],
          const SizedBox(width: 8),
          Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
        ],
      ),
    );
  }
}

/// A show that is coming up: its picture on its own, then the start time and the name underneath.
class ShowCard extends StatelessWidget {
  final Session session;
  final String? image;
  final VoidCallback onTap;
  const ShowCard({super.key, required this.session, this.image, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final live = session.status != 'SCHEDULED';
    final time = fmtTime(session.revisedStart ?? session.startTime);
    return SizedBox(
      width: 168,
      child: Tap(
        onTap: onTap,
        scaleTo: 1.04,
        label: '${session.attractionName}, $time',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Cover(image: image, color: _catColor(session), icon: Icons.calendar_month_rounded, height: 150, radius: 18),
            const SizedBox(height: 8),
            Row(children: [
              _TimePill(time),
              if (live) ...[
                const SizedBox(width: 8),
                Text(session.status, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: statusColor[session.status])),
              ],
            ]),
            const SizedBox(height: 5),
            Text(session.attractionName, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 15.5, fontWeight: FontWeight.w700, height: 20 / 15.5, color: c.text)),
          ],
        ),
      ),
    );
  }
}

/// Cards or a list: the guest's choice for how Home shows a list of shows.
class ViewToggle extends StatelessWidget {
  final HomeView view;
  final ValueChanged<HomeView> onChange;
  const ViewToggle({super.key, required this.view, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    Widget option(HomeView v, IconData icon, String label) {
      final on = view == v;
      return Tap(
        onTap: () => onChange(v),
        label: label,
        child: Container(
          width: 32,
          height: 28,
          decoration: BoxDecoration(color: on ? c.primary : Colors.transparent, borderRadius: BorderRadius.circular(999)),
          child: Icon(icon, size: 17, color: on ? Colors.white : c.link),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        option(HomeView.cards, Icons.grid_view_rounded, 'Show as cards'),
        const SizedBox(width: 2),
        option(HomeView.list, Icons.view_list_rounded, 'Show as a list'),
      ]),
    );
  }
}
