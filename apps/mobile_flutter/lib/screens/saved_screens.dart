import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/favorites.dart';
import '../core/models.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/cover.dart';
import '../ui/managed_image.dart';
import '../ui/screen.dart';

/// A list of attractions the guest has saved (favourites, or ones they have done), or its empty state.
class AttractionListScreen extends StatelessWidget {
  final String page, title, label, emptyHeading, emptyBody, slot;
  final Set<String>? ids;
  const AttractionListScreen({super.key, required this.page, required this.title, required this.label, required this.emptyHeading, required this.emptyBody, required this.slot, required this.ids});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final items = ids == null ? <Attraction>[] : (bundle?.attractions ?? <Attraction>[]).where((a) => ids!.contains(a.id)).toList();
    return KScreen(
      title: title,
      subtitle: 'Shows and places you have saved',
      page: page,
      colors: featureGradient['programme'],
      children: [
        if (items.isNotEmpty)
          for (final a in items)
            KCard(
              onTap: () => context.push('/attraction/${a.slug}'),
              padding: const EdgeInsets.all(12),
              child: Row(children: [
                Cover(image: a.heroImage, color: featureGradient['programme']![0], icon: Icons.star_rounded, height: 58, width: 58, radius: 14),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(a.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5, color: c.text)),
                    if ((a.tagline ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 1), child: Text(a.tagline!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: c.sub))),
                    Padding(padding: const EdgeInsets.only(top: 2), child: Text(a.category.replaceAll('_', ' ').toLowerCase(), style: TextStyle(fontSize: 11.5, color: c.sub))),
                  ]),
                ),
                Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
              ]),
            )
        else
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 48, 18, 0),
            child: Column(children: [
              SizedBox(width: 150, height: 150, child: ClipRRect(borderRadius: BorderRadius.circular(20), child: ManagedImage(slot: slot, fadeColor: c.screen))),
              const SizedBox(height: 18),
              Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 1, color: c.sub)),
              const SizedBox(height: 4),
              Text(emptyHeading, textAlign: TextAlign.center, style: TextStyle(fontFamily: Tokens.serif, fontSize: 21, fontWeight: FontWeight.w800, color: c.text)),
              const SizedBox(height: 6),
              Text(emptyBody, textAlign: TextAlign.center, style: TextStyle(fontSize: 14.5, height: 21 / 14.5, color: c.sub)),
              const SizedBox(height: 18),
              KButton('Discover', onPressed: () => context.push('/shows')),
            ]),
          ),
      ],
    );
  }
}

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});
  @override
  Widget build(BuildContext context) => AttractionListScreen(
        page: 'favorites',
        title: 'My favourites',
        label: 'MY FAVOURITES',
        slot: 'favorites.empty',
        emptyHeading: 'Create your favourites list',
        emptyBody: 'Shows, restaurants and activities appear here when you mark them as favourites.',
        ids: context.watch<FavoritesState>().ids,
      );
}

class SeenScreen extends StatefulWidget {
  const SeenScreen({super.key});
  @override
  State<SeenScreen> createState() => _SeenScreenState();
}

class _SeenScreenState extends State<SeenScreen> {
  Set<String>? _ids;
  String? _loadedFor = '';

  void _load(AuthUser? user) {
    if (_loadedFor == user?.id) return;
    _loadedFor = user?.id;
    if (user == null) {
      _ids = {};
      return;
    }
    api('/me/seen').then((s) {
      if (mounted) setState(() => _ids = {for (final x in s as List) (x as Map)['attractionId'] as String});
    }).catchError((_) {
      if (mounted) setState(() => _ids = {});
    });
  }

  @override
  Widget build(BuildContext context) {
    _load(context.watch<AuthState>().user);
    return AttractionListScreen(
      page: 'seen',
      title: 'I did it',
      label: 'I DID IT',
      slot: 'seen.empty',
      emptyHeading: 'Write your story at Kynren',
      emptyBody: 'Shows, restaurants and activities appear here when you mark them as done.',
      ids: _ids,
    );
  }
}
