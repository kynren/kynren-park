import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/essentials.dart';
import '../core/location.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/meeting_card.dart';
import '../ui/screen.dart';
import '../ui/shop_widgets.dart' show DividedCard;
import '../ui/skeleton.dart';
import '../ui/tap.dart';

const _icons = {
  'RESTROOM': Icons.wc_rounded,
  'BABY_CHANGING': Icons.child_friendly_rounded,
  'FIRST_AID': Icons.medical_services_rounded,
  'INFO': Icons.info_rounded,
  'HELP': Icons.support_agent_rounded,
  'ENTRANCE': Icons.door_front_door_rounded,
  'PARKING': Icons.local_parking_rounded,
  'PICNIC': Icons.deck_rounded,
  'ACCESSIBILITY': Icons.accessible_rounded,
};

IconData _iconFor(String type) => _icons[type] ?? Icons.place_rounded;

/// Park essentials: toilets, first aid, baby changing, information, parking and the rest, each kind with the nearest first and
/// how far to walk. The three a guest is most likely to need in a hurry sit at the top.
class EssentialsScreen extends StatelessWidget {
  const EssentialsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final location = context.watch<LocationState>();
    final gps = location.gps;
    final groups = essentialGroups(bundle?.pois ?? const [], gps);
    final urgent = [for (final t in urgentTypes) ...groups.where((g) => g.type == t)];

    return KScreen(
      title: 'Park essentials',
      subtitle: 'Toilets, first aid, parking and more',
      page: 'essentials',
      padded: false,
      colors: featureGradient['essentials'],
      children: [
        if (gps == null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: KCard(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Icon(Icons.my_location_rounded, size: 19, color: c.link),
                  const SizedBox(width: 8),
                  Text('See how far each one is', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text)),
                ]),
                const SizedBox(height: 4),
                Text('Turn on location and the nearest comes first, with the time it takes to walk there. Your position stays on your phone.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
                const SizedBox(height: 12),
                KButton('Turn on location', small: true, onPressed: location.enable),
              ]),
            ),
          ),
        const Padding(padding: EdgeInsets.fromLTRB(20, 20, 20, 0), child: MeetingCard()),
        if (urgent.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Row(children: [
              for (var i = 0; i < urgent.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(child: _UrgentTile(group: urgent[i])),
              ],
            ]),
          ),
        if (groups.isEmpty && bundle == null)
          const Padding(padding: EdgeInsets.fromLTRB(20, 20, 20, 0), child: SkeletonCard(imageHeight: 90))
        else if (groups.isEmpty)
          Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 0), child: Text('No places have been added to the map yet.', textAlign: TextAlign.center, style: TextStyle(color: c.sub))),
        for (final g in groups) ...[
          Padding(padding: const EdgeInsets.only(top: 22), child: SectionHeader(g.spots.length > 1 ? '${g.label} · ${g.spots.length}' : g.label)),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
            child: DividedCard(rows: [for (final s in g.spots) _SpotRow(spot: s, type: g.type)]),
          ),
        ],
        const SizedBox(height: 8),
      ],
    );
  }
}

/// One of the three quick tiles: the kind, and how far the nearest is.
class _UrgentTile extends StatelessWidget {
  final SpotGroup group;
  const _UrgentTile({required this.group});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final near = group.nearest;
    final distance = near.distanceText;
    return Tap(
      onTap: () => context.go('/map?focus=${near.poi.id}'),
      label: '${group.label}: ${distance ?? 'show on the map'}',
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(color: c.card, borderRadius: BorderRadius.circular(18), boxShadow: softShadow(context.isDark)),
        child: Column(children: [
          Container(width: 46, height: 46, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(_iconFor(group.type), size: 23, color: c.link)),
          const SizedBox(height: 8),
          Text(group.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.text)),
          const SizedBox(height: 2),
          Text(distance ?? 'See map', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: distance != null ? c.link : c.sub)),
        ]),
      ),
    );
  }
}

class _SpotRow extends StatelessWidget {
  final Spot spot;
  final String type;
  const _SpotRow({required this.spot, required this.type});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final poi = spot.poi;
    final detail = [if ((poi.mapZone ?? '').isNotEmpty) poi.mapZone!, ?spot.distanceText].join(' · ');
    return Tap(
      onTap: () => context.push('/facility/${poi.id}'),
      label: poi.name,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
        child: Row(children: [
          Container(width: 42, height: 42, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(_iconFor(type), size: 21, color: c.link)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(poi.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: c.text)),
              if (detail.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 1), child: Text(detail, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: spot.distanceText != null ? c.link : c.sub))),
            ]),
          ),
          Tap(
            onTap: () => context.go('/map?focus=${poi.id}'),
            label: 'Show ${poi.name} on the map',
            child: Padding(padding: const EdgeInsets.all(10), child: Icon(Icons.place_outlined, size: 22, color: c.link)),
          ),
        ]),
      ),
    );
  }
}
