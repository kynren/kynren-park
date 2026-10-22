import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/auth.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/kimage.dart';
import '../ui/managed_image.dart';
import '../ui/screen.dart';

const profileKey = 'kynren_profile';

/// The photo a guest picked, as an image provider that works on phone and web.
ImageProvider? profilePhoto(String? uri) {
  if (uri == null || uri.isEmpty) return null;
  if (kIsWeb || uri.startsWith('http') || uri.startsWith('blob:') || uri.startsWith('data:')) return kImageProvider(uri);
  return FileImage(File(uri));
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String? _photo;
  String _name = '';
  String _version = '';

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      final raw = p.getString(profileKey);
      if (raw == null) return;
      try {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        if (mounted) {
          setState(() {
            _photo = m['photoUri'] as String?;
            _name = [m['firstName'], m['lastName']].where((x) => x != null && '$x'.isNotEmpty).join(' ');
          });
        }
      } catch (_) {}
    });
    PackageInfo.fromPlatform().then((i) {
      if (mounted) setState(() => _version = 'v${i.version} · build ${i.buildNumber}');
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    final bundle = context.watch<SyncState>().bundle;
    final displayName = _name.isNotEmpty ? _name : (user?.name ?? (user?.email != null ? user!.email!.split('@').first : ''));
    final photo = profilePhoto(_photo);

    Widget row(IconData icon, String title, String sub, String to) => KCard(
          onTap: () => context.push(to),
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Container(width: 44, height: 44, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(icon, color: c.link, size: 22)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: c.text)),
                Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub, style: TextStyle(fontSize: 12.5, color: c.sub))),
              ]),
            ),
            Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
          ]),
        );

    Widget check(String text) => Row(children: [
          Container(width: 20, height: 20, decoration: const BoxDecoration(color: Tokens.ok, shape: BoxShape.circle), child: const Icon(Icons.check_rounded, color: Colors.white, size: 13)),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: c.text))),
        ]);

    Widget tile(IconData icon, String title, VoidCallback? onTap, {String? sub}) => Expanded(
          child: Opacity(
            opacity: onTap == null ? 0.55 : 1,
            child: KCard(
              onTap: onTap,
              padding: const EdgeInsets.all(16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 64),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(icon, color: onTap == null ? c.sub : c.link, size: 24),
                  const SizedBox(height: 10),
                  Text(title, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: onTap == null ? c.sub : c.text)),
                  if (sub != null) Text(sub, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, height: 15 / 11.5, color: c.sub)),
                ]),
              ),
            ),
          ),
        );

    return KScreen(
      title: 'Profile',
      subtitle: 'Your account and saved places',
      page: 'profile',
      children: [
        if (user != null)
          Column(children: [
            Container(
              width: 92,
              height: 92,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle, border: Border.all(color: c.card, width: 4), image: photo != null ? DecorationImage(image: photo, fit: BoxFit.cover) : null),
              child: photo == null ? Stack(alignment: Alignment.center, children: [const ManagedImage(slot: 'profile.avatar'), Icon(Icons.person_rounded, color: c.link, size: 38)]) : null,
            ),
            const SizedBox(height: 10),
            Text('Hello${displayName.isNotEmpty ? ', $displayName' : ''}', textAlign: TextAlign.center, style: TextStyle(fontFamily: Tokens.serif, fontSize: 19.5, fontWeight: FontWeight.w800, color: c.text)),
            const SizedBox(height: 2),
            Text(bundle?.branding?.appName ?? 'Kynren – The Storied Lands', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, color: c.sub)),
          ])
        else
          KCard(
            padding: const EdgeInsets.all(22),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (bundle?.branding?.logoUrl != null)
                Padding(padding: const EdgeInsets.only(bottom: 14), child: KImage(bundle!.branding!.logoUrl!, height: 34, width: 150, fit: BoxFit.contain, alignment: Alignment.centerLeft))
              else
                Padding(padding: const EdgeInsets.only(bottom: 14), child: Text((bundle?.branding?.appName ?? 'Kynren').toUpperCase(), style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, letterSpacing: 3, color: c.link))),
              Text('Your adventure starts here', style: TextStyle(fontFamily: Tokens.serif, fontSize: 23, fontWeight: FontWeight.w800, height: 27 / 23, color: c.text)),
              Padding(padding: const EdgeInsets.only(top: 8, bottom: 10), child: Text('Create a free account to:', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: c.sub))),
              check('Hold your tickets in the app'),
              const SizedBox(height: 10),
              check('Bring your bookings in by email'),
              const SizedBox(height: 10),
              check('Order ahead and track your order'),
              const SizedBox(height: 10),
              check('Get reminders before each show'),
              const SizedBox(height: 20),
              KButton('Create an account', full: true, onPressed: () => context.push('/auth')),
              const SizedBox(height: 10),
              KButton('Log in', full: true, variant: ButtonVariant.soft, onPressed: () => context.push('/auth')),
            ]),
          ),
        Row(children: [
          tile(Icons.confirmation_number_rounded, 'My tickets', () => context.push('/tickets')),
          const SizedBox(width: 12),
          tile(Icons.calendar_month_rounded, 'My planned day', user != null ? () => context.push('/plan') : null, sub: user == null ? 'Sign in to plan your day' : null),
        ]),
        row(Icons.favorite_rounded, 'My favourites', 'Your saved shows and activities', '/favorites'),
        row(Icons.check_rounded, 'I did it', 'Everything you\'ve marked as seen', '/seen'),
        row(Icons.restaurant_rounded, 'My orders', 'Track food you\'ve ordered ahead', '/orders'),
        if (user != null) row(Icons.tune_rounded, 'Account settings', 'Personal info, accessibility, theme', '/settings'),
        if (user != null)
          KButton('Log out', full: true, variant: ButtonVariant.soft, onPressed: () async {
            final router = GoRouter.of(context);
            await context.read<AuthState>().logout();
            if (router.canPop()) router.pop();
          }),
        if (_version.isNotEmpty) Center(child: Padding(padding: const EdgeInsets.only(top: 4), child: Text(_version, style: TextStyle(color: c.sub, fontSize: 11)))),
      ],
    );
  }
}
