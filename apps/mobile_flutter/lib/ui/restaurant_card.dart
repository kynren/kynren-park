import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'controls.dart';
import 'cover.dart';
import 'tap.dart';

/// One restaurant: its photo (or the fork-and-knife panel), name and cuisine, then "See menu" beside the one
/// action we can really offer: ordering ahead, only when the place takes Click & Collect and has a menu.
class RestaurantCard extends StatelessWidget {
  final Restaurant r;
  final bool faved;
  final VoidCallback onFav;
  const RestaurantCard({super.key, required this.r, required this.faved, required this.onFav});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final canOrder = r.clickCollect != false && r.menuItems.isNotEmpty;
    void open() => context.push('/restaurant/${r.slug}');
    final sub = [r.cuisine, r.openingHours].where((x) => x != null && x.isNotEmpty).join(' · ');

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
