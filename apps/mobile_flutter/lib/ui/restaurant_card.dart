import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/eat_logic.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'controls.dart';
import 'cover.dart';
import 'tap.dart';

/// One restaurant: its photo (or the fork-and-knife panel), name, cuisine and hours, whether it is open now, how far
/// it is to walk, the dietary choices on its menu, then "See menu". Ordering ahead is offered only once it is open.
class RestaurantCard extends StatelessWidget {
  final Restaurant r;
  final bool faved;
  final VoidCallback onFav;

  /// Open or shut right now, when the hours are known.
  final OpenState? state;

  /// Minutes to walk there, when the guest is in the park.
  final int? walk;
  const RestaurantCard({super.key, required this.r, required this.faved, required this.onFav, this.state, this.walk});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final canOrder = onlineOrderingOpen && r.clickCollect != false && r.menuItems.isNotEmpty;
    void open() => context.push('/restaurant/${r.slug}');
    final hours = parseHours(r.openingHours);
    final sub = [r.cuisine, hours != null ? hoursText(hours) : r.openingHours].where((x) => x != null && x.isNotEmpty).join(' · ');
    final diets = dietsOnMenu(r.menuItems);
    final stateColor = switch (state?.kind) {
      OpenKind.open => Tokens.ok,
      OpenKind.closingSoon => Tokens.warn,
      OpenKind.closed => Tokens.danger,
      _ => c.sub,
    };

    Widget round(IconData icon, Color color, String label, VoidCallback onTap) => Tap(
          onTap: onTap,
          label: label,
          child: Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(icon, color: color, size: 19)),
        );

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(20), boxShadow: softShadow(context.isDark)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Tap(onTap: open, scaleTo: 1.04, label: r.name, child: Cover(image: r.heroImage, color: featureGradient['restaurants']![0], icon: Icons.restaurant_rounded, height: 176)),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(r.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 19, fontWeight: FontWeight.w700, height: 24 / 19, color: c.text)),
            if (sub.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub))),
            if (state != null || walk != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  if (state != null) ...[
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: stateColor, shape: BoxShape.circle)),
                    const SizedBox(width: 6),
                    Flexible(child: Text(state!.text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: stateColor))),
                  ],
                  if (walk != null) Text('${state != null ? ' · ' : ''}$walk min walk', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.sub)),
                ]),
              ),
            if (diets.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final d in diets)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: c.soft, borderRadius: BorderRadius.circular(999)),
                      child: Text(d, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: Tokens.ok)),
                    ),
                ]),
              ),
            const SizedBox(height: 12),
            Row(children: [
              KButton('See menu', small: true, variant: ButtonVariant.soft, onPressed: open),
              if (canOrder) ...[const SizedBox(width: 10), KButton('Order now', small: true, onPressed: open)],
              const Spacer(),
              round(faved ? Icons.favorite_rounded : Icons.favorite_border_rounded, faved ? c.accent : c.link, faved ? 'Remove from favourites' : 'Add to favourites', onFav),
              const SizedBox(width: 8),
              round(Icons.place_outlined, c.link, 'Show ${r.name} on the map', () => context.go('/map?focus=${r.id}')),
            ]),
          ]),
        ),
      ]),
    );
  }
}
