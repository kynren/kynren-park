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
import '../core/tickets.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/kimage.dart';
import '../ui/managed_image.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

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
  Map<String, dynamic> _saved = {};
  bool _editing = false, _justSaved = false;
  final _first = TextEditingController(), _last = TextEditingController(), _phone = TextEditingController(), _address = TextEditingController();

  @override
  void dispose() {
    for (final c in [_first, _last, _phone, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  /// The guest's name as their bookings spell it ("Mrs Jane Smith" becomes Jane / Smith).
  static (String, String) _splitName(String full) {
    final parts = full.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isNotEmpty && RegExp(r'^(mr|mrs|ms|miss|mx|dr|master)\.?$', caseSensitive: false).hasMatch(parts.first)) parts.removeAt(0);
    if (parts.isEmpty) return ('', '');
    return (parts.first, parts.skip(1).join(' '));
  }

  /// What we know: anything the guest has saved, filled in from their account and bookings where it is blank.
  Map<String, String> _details(AuthUser? user, List<TicketItem> tickets) {
    String saved(String k) => (_saved[k] as String?)?.trim() ?? '';
    var first = saved('firstName'), last = saved('lastName');
    if (first.isEmpty && last.isEmpty) {
      final holder = tickets.map((t) => t.holder).firstWhere((h) => h != null && h.trim().isNotEmpty, orElse: () => null);
      final accountName = user?.name;
      final (f, l) = _splitName(accountName != null && accountName.trim().isNotEmpty ? accountName : (holder ?? ''));
      first = f;
      last = l;
    }
    return {'firstName': first, 'lastName': last, 'phone': saved('phone'), 'address': saved('address')};
  }

  void _startEdit(Map<String, String> d) {
    _first.text = d['firstName']!;
    _last.text = d['lastName']!;
    _phone.text = d['phone']!;
    _address.text = d['address']!;
    setState(() => _editing = true);
  }

  Future<void> _saveEdit() async {
    final p = await SharedPreferences.getInstance();
    // keep everything else the settings page stores (accessibility needs, photo, notes)
    final next = {..._saved, 'firstName': _first.text.trim(), 'lastName': _last.text.trim(), 'phone': _phone.text.trim(), 'address': _address.text.trim()};
    await p.setString(profileKey, jsonEncode(next));
    if (!mounted) return;
    setState(() {
      _saved = next;
      _name = [next['firstName'], next['lastName']].where((x) => x != null && '$x'.isNotEmpty).join(' ');
      _editing = false;
      _justSaved = true;
    });
    Future.delayed(const Duration(milliseconds: 2200), () => mounted ? setState(() => _justSaved = false) : null);
  }

  Widget _detailsCard(BuildContext context, AuthUser user, Map<String, String> d) {
    final c = context.ui;
    Widget line(IconData icon, String label, String value, {String empty = 'Not added yet'}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 9),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 20, color: c.link),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.sub)),
                const SizedBox(height: 2),
                Text(value.isEmpty ? empty : value, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: value.isEmpty ? c.placeholder : c.text)),
              ]),
            ),
          ]),
        );
    final fullName = [d['firstName'], d['lastName']].where((x) => x != null && x.isNotEmpty).join(' ');
    final fromBookings = d['firstName']!.isNotEmpty && ((_saved['firstName'] as String?) ?? '').isEmpty && ((_saved['lastName'] as String?) ?? '').isEmpty;
    return KCard(
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text('Your details', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.text))),
          if (_justSaved)
            const Padding(padding: EdgeInsets.only(right: 10), child: Text('✓ Saved', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Tokens.ok)))
          else if (!_editing)
            Tap(
              onTap: () => _startEdit(d),
              label: 'Edit your details',
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.edit_rounded, size: 15, color: c.link),
                  const SizedBox(width: 6),
                  Text('Edit', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: c.link)),
                ]),
              ),
            ),
        ]),
        const SizedBox(height: 6),
        if (!_editing) ...[
          line(Icons.person_rounded, 'Name', fullName),
          line(Icons.mail_rounded, 'Email', user.email ?? ''),
          line(Icons.phone_rounded, 'Phone', d['phone']!),
          line(Icons.home_rounded, 'Address', d['address']!),
          if (fromBookings)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text('Filled in from your bookings. Tap Edit to change anything.', style: TextStyle(fontSize: 12, color: c.sub))),
        ] else ...[
          const SizedBox(height: 6),
          KTextField(label: 'First name', hint: 'First name', controller: _first, capitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          KTextField(label: 'Last name', hint: 'Last name', controller: _last, capitalization: TextCapitalization.words),
          const SizedBox(height: 4),
          line(Icons.mail_rounded, 'Email (your login, so it stays as it is)', user.email ?? ''),
          KTextField(label: 'Phone', hint: 'Phone', controller: _phone, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          KTextField(label: 'Address', hint: 'Address', controller: _address, keyboardType: TextInputType.multiline, capitalization: TextCapitalization.words),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: KButton('Cancel', variant: ButtonVariant.soft, onPressed: () => setState(() => _editing = false))),
            const SizedBox(width: 10),
            Expanded(child: KButton('Save', onPressed: _saveEdit)),
          ]),
        ],
      ]),
    );
  }

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
            _saved = m;
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
    final tickets = context.watch<TicketsState>().tickets;
    final details = _details(user, tickets);
    final shownName = [details['firstName'], details['lastName']].where((x) => x != null && x.isNotEmpty).join(' ');

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
            Text('Hello${(shownName.isNotEmpty ? shownName : displayName).isNotEmpty ? ', ${shownName.isNotEmpty ? shownName : displayName}' : ''}', textAlign: TextAlign.center, style: TextStyle(fontFamily: Tokens.display, fontSize: 19.5, fontWeight: FontWeight.w800, color: c.text)),
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
              Text('Your adventure starts here', style: TextStyle(fontFamily: Tokens.display, fontSize: 23, fontWeight: FontWeight.w800, height: 27 / 23, color: c.text)),
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
        if (user != null) _detailsCard(context, user, details),
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
