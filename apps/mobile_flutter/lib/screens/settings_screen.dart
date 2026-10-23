import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:share_plus/share_plus.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/theme.dart';
import '../core/theme_mode.dart';
import '../ui/controls.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';
import 'profile_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _first = TextEditingController(), _last = TextEditingController(), _phone = TextEditingController(), _address = TextEditingController(), _notes = TextEditingController();
  String? _photo;
  bool _wheelchair = false, _audioDesc = false, _captioning = false, _bsl = false;
  bool _saved = false, _marketing = false, _exporting = false, _deleting = false;
  Timer? _savedTimer;
  String? _loadedFor;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) {
      final raw = p.getString(profileKey);
      if (raw == null || !mounted) return;
      final m = jsonDecode(raw) as Map<String, dynamic>;
      setState(() {
        _first.text = m['firstName'] as String? ?? '';
        _last.text = m['lastName'] as String? ?? '';
        _phone.text = m['phone'] as String? ?? '';
        _address.text = m['address'] as String? ?? '';
        _notes.text = m['notes'] as String? ?? '';
        _photo = m['photoUri'] as String?;
        _wheelchair = m['wheelchair'] == true;
        _audioDesc = m['audioDesc'] == true;
        _captioning = m['captioning'] == true;
        _bsl = m['bsl'] == true;
      });
    });
  }

  @override
  void dispose() {
    _savedTimer?.cancel();
    for (final c in [_first, _last, _phone, _address, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  void _loadConsent(AuthUser? user) {
    if (user == null || _loadedFor == user.id) return;
    _loadedFor = user.id;
    api('/me').then((me) {
      if (mounted) setState(() => _marketing = (me as Map)['marketingConsent'] == true);
    }).catchError((_) {});
  }

  Future<void> _save() async {
    final p = await SharedPreferences.getInstance();
    await p.setString(profileKey, jsonEncode({
      'firstName': _first.text, 'lastName': _last.text, 'phone': _phone.text, 'address': _address.text, 'photoUri': _photo,
      'wheelchair': _wheelchair, 'audioDesc': _audioDesc, 'captioning': _captioning, 'bsl': _bsl, 'notes': _notes.text,
    }));
    setState(() => _saved = true);
    _savedTimer?.cancel();
    _savedTimer = Timer(const Duration(milliseconds: 1800), () => mounted ? setState(() => _saved = false) : null);
  }

  Future<void> _pickPhoto() async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final f = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 800, imageQuality: 70);
      if (f != null) setState(() => _photo = f.path);
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Allow photo access to set a profile picture.')));
    }
  }

  Future<void> _toggleConsent(bool next) async {
    setState(() => _marketing = next);
    try {
      await api('/me/consent', method: 'PATCH', body: {'marketingConsent': next});
    } catch (_) {
      if (mounted) setState(() => _marketing = !next);
    }
  }

  Future<void> _export() async {
    setState(() => _exporting = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final data = await api('/me/export');
      await SharePlus.instance.share(ShareParams(text: const JsonEncoder.withIndent('  ').convert(data), title: 'My Kynren data'));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Couldn’t export your data. Please try again.')));
    }
    if (mounted) setState(() => _exporting = false);
  }

  Future<void> _delete() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete your account?'),
        content: const Text('This removes your personal details from Kynren. Your booking history is kept for accounting records but is no longer linked to you. This can’t be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete account', style: TextStyle(color: Tokens.danger))),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final router = GoRouter.of(context);
    final auth = context.read<AuthState>();
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _deleting = true);
    try {
      await api('/me', method: 'DELETE');
      await auth.logout();
      router.go('/');
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Couldn’t delete your account. Please try again.')));
    }
    if (mounted) setState(() => _deleting = false);
  }

  Widget _section(String title, List<Widget> children) {
    final c = context.ui;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Semantics(header: true, child: Text(title.toUpperCase(), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: c.text))),
      const SizedBox(height: 10),
      KCard(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 14), children[i]],
        ]),
      ),
    ]);
  }

  Widget _toggle(String label, bool value, ValueChanged<bool> onChanged) {
    final c = context.ui;
    return Row(children: [
      Expanded(child: Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: c.text))),
      Switch(value: value, onChanged: onChanged, activeTrackColor: c.primary, activeThumbColor: Colors.white),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    final themePref = context.watch<ThemePref>();
    _loadConsent(user);
    final initials = '${_first.text.isNotEmpty ? _first.text[0] : ''}${_last.text.isNotEmpty ? _last.text[0] : ''}'.toUpperCase();
    final photo = profilePhoto(_photo);

    return KScreen(
      title: 'Account',
      subtitle: 'Your details, access needs and appearance',
      page: 'settings',
      children: [
        Column(children: [
          Tap(
            onTap: _pickPhoto,
            label: 'Change profile photo',
            child: SizedBox(
              width: 104,
              height: 104,
              child: Stack(children: [
                Container(
                  width: 104,
                  height: 104,
                  decoration: BoxDecoration(color: c.primary, shape: BoxShape.circle, image: photo != null ? DecorationImage(image: photo, fit: BoxFit.cover) : null),
                  child: photo == null ? Center(child: initials.isNotEmpty ? Text(initials, style: const TextStyle(fontFamily: Tokens.display, color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)) : const Icon(Icons.person_rounded, color: Colors.white, size: 40)) : null,
                ),
                Positioned(
                  right: 2,
                  bottom: 2,
                  child: Container(width: 32, height: 32, decoration: BoxDecoration(color: c.accent, shape: BoxShape.circle, border: Border.all(color: c.screen, width: 2)), child: const Icon(Icons.edit_rounded, color: Colors.white, size: 15)),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          Tap(onTap: _pickPhoto, child: Text('Change photo', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: c.link))),
        ]),
        const SizedBox(height: 10),
        _section('Your details', [
          KTextField(label: 'First name', hint: 'First name', controller: _first, onChanged: (_) => setState(() {})),
          KTextField(label: 'Last name', hint: 'Last name', controller: _last, onChanged: (_) => setState(() {})),
          KTextField(label: 'Phone', hint: 'Phone', controller: _phone, keyboardType: TextInputType.phone),
          KTextField(label: 'Address', hint: 'Address', controller: _address, keyboardType: TextInputType.multiline),
        ]),
        const SizedBox(height: 10),
        _section('Accessibility', [
          _toggle('Step-free access needs', _wheelchair, (v) => setState(() => _wheelchair = v)),
          _toggle('Audio description', _audioDesc, (v) => setState(() => _audioDesc = v)),
          _toggle('Captioning', _captioning, (v) => setState(() => _captioning = v)),
          _toggle('BSL interpretation', _bsl, (v) => setState(() => _bsl = v)),
          KTextField(label: 'Other needs (optional)', hint: 'Other needs', controller: _notes, keyboardType: TextInputType.multiline),
        ]),
        const SizedBox(height: 10),
        _section('Appearance', [
          Row(children: [
            for (final m in [ThemeMode.light, ThemeMode.dark, ThemeMode.system]) ...[
              if (m != ThemeMode.light) const SizedBox(width: 8),
              Expanded(
                child: Tap(
                  onTap: () => themePref.set(m),
                  label: m.name,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(color: themePref.mode == m ? c.primary : c.tint, borderRadius: BorderRadius.circular(999)),
                    child: Center(child: Text(m.name[0].toUpperCase() + m.name.substring(1), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: themePref.mode == m ? Colors.white : c.link))),
                  ),
                ),
              ),
            ],
          ]),
        ]),
        const SizedBox(height: 10),
        KButton(_saved ? '✓ Saved' : 'Save changes', full: true, onPressed: _save),
        if (user != null) ...[
          const SizedBox(height: 10),
          _section('Privacy & data', [
            _toggle('Marketing announcements', _marketing, _toggleConsent),
            Tap(onTap: _exporting ? null : _export, child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(_exporting ? 'Preparing export…' : 'Export my data', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.link)))),
            Tap(onTap: _deleting ? null : _delete, child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(_deleting ? 'Deleting…' : 'Delete my account', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Tokens.danger)))),
          ]),
        ],
      ],
    );
  }
}
