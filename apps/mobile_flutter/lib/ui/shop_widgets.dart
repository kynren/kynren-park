import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/eat_logic.dart';
import '../core/models.dart';
import '../core/shop_logic.dart';
import '../core/theme.dart';
import 'controls.dart';
import 'cover.dart';
import 'tap.dart';

/// Open or shut right now, and how far to walk: the line under a shop's name. Nothing at all when neither is known.
class OpenStatus extends StatelessWidget {
  final OpenState? state;
  final int? walk;
  const OpenStatus({super.key, this.state, this.walk});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    if (state == null && walk == null) return const SizedBox.shrink();
    final color = switch (state?.kind) {
      OpenKind.open => Tokens.ok,
      OpenKind.closingSoon => Tokens.warn,
      OpenKind.closed => Tokens.danger,
      _ => c.sub,
    };
    return Row(children: [
      if (state != null) ...[
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Flexible(child: Text(state!.text, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: color))),
      ],
      if (walk != null) Text('${state != null ? ' · ' : ''}$walk min walk', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.sub)),
    ]);
  }
}

/// A small heart that saves a product to find again.
class SaveHeart extends StatelessWidget {
  final bool saved;
  final String name;
  final VoidCallback onTap;
  const SaveHeart({super.key, required this.saved, required this.name, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Tap(
      onTap: onTap,
      label: saved ? 'Remove $name from saved' : 'Save $name',
      child: Padding(padding: const EdgeInsets.all(10), child: Icon(saved ? Icons.favorite_rounded : Icons.favorite_border_rounded, size: 21, color: saved ? c.accent : c.sub)),
    );
  }
}

/// One product: its name and what it is, its price (or each price, labelled, when it has several), and a heart. [shopName] is
/// given where products from several shops share a list, and [onTap] where the row opens its shop.
class ProductRow extends StatelessWidget {
  final Product product;
  final String? shopName;
  final bool saved;
  final VoidCallback onSave;
  final VoidCallback? onTap;
  const ProductRow({super.key, required this.product, this.shopName, required this.saved, required this.onSave, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final priced = product.options.where((o) => o.priceCents > 0).toList();
    final labelled = priced.length > 1 && priced.every((o) => (o.variant ?? '').isNotEmpty);
    final single = product.priceText != null && !labelled;
    final dim = product.soldOut ? 0.5 : 1.0;
    final desc = product.description;
    final row = Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 4, 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Opacity(
            opacity: dim,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(product.name, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, height: 20 / 15.5, color: c.text)),
              if (shopName != null) Padding(padding: const EdgeInsets.only(top: 1), child: Text(shopName!, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.link))),
              if ((desc ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(desc!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, height: 18 / 13, color: c.sub))),
              if (labelled)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final o in priced)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
                        child: Text('${o.variant} ${poundsShort(o.priceCents)}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: c.link)),
                      ),
                  ]),
                ),
              if (product.soldOut)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('Sold out', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Tokens.danger)),
                ),
            ]),
          ),
        ),
        if (single)
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 1),
            child: Opacity(opacity: dim, child: Text(product.priceText!, style: TextStyle(fontFamily: Tokens.display, fontSize: 16, fontWeight: FontWeight.w800, color: c.text))),
          ),
        SaveHeart(saved: saved, name: product.name, onTap: onSave),
      ]),
    );
    return onTap == null ? row : Tap(onTap: onTap!, label: '${product.name}${shopName != null ? ' at $shopName' : ''}', child: row);
  }
}

/// A run of rows in one card, each set off by a hairline.
class DividedCard extends StatelessWidget {
  final List<Widget> rows;
  const DividedCard({super.key, required this.rows});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    return Container(
      decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(20), boxShadow: softShadow(context.isDark)),
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) Divider(height: 0.5, thickness: 0.5, indent: 16, color: c.line),
          rows[i],
        ],
      ]),
    );
  }
}

/// One shop in the list: its picture (or the shop panel), name, what it sells, whether it is open, how far it is, and the way in.
class ShopCard extends StatelessWidget {
  final Shop shop;
  final OpenState? state;
  final int? walk;
  const ShopCard({super.key, required this.shop, this.state, this.walk});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    void open() => context.push('/shop/${shop.slug}');
    final count = productCount(shop);
    final range = shopPriceRange(shop);
    final sub = [
      if ((shop.category ?? '').isNotEmpty) shop.category!,
      if (count > 0) '$count product${count == 1 ? '' : 's'}',
      ?range,
    ].join(' · ');
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(20), boxShadow: softShadow(context.isDark)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Tap(onTap: open, scaleTo: 1.04, label: shop.name, child: Cover(image: shop.heroImage ?? (shop.images.isNotEmpty ? shop.images.first : null), color: featureGradient['shops']![0], icon: Icons.storefront_rounded, height: 132)),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(shop.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 19, fontWeight: FontWeight.w700, height: 24 / 19, color: c.text)),
            if (sub.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub))),
            if (state != null || walk != null) Padding(padding: const EdgeInsets.only(top: 6), child: OpenStatus(state: state, walk: walk)),
            const SizedBox(height: 12),
            Row(children: [
              KButton('See products', small: true, variant: ButtonVariant.soft, onPressed: open),
              const Spacer(),
              Tap(
                onTap: () => context.go('/map?focus=${shop.poiId ?? shop.id}'),
                label: 'Show ${shop.name} on the map',
                child: Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.place_outlined, color: c.link, size: 19)),
              ),
            ]),
          ]),
        ),
      ]),
    );
  }
}
