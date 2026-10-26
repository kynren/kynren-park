import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/auth.dart';
import '../core/profile.dart';
import '../core/theme.dart';
import '../core/tickets.dart';
import 'controls.dart';
import 'tap.dart';

/// "Your details": the guest's name, email, phone and address, read-only until they press Edit. Signed in, the name and
/// phone come from their bookings; whatever they save here wins over that from then on.
class YourDetailsCard extends StatefulWidget {
  /// Draw the heading as a section label above the card (the settings page) rather than inside it.
  final bool labelOutside;
  const YourDetailsCard({super.key, this.labelOutside = false});

  @override
  State<YourDetailsCard> createState() => _YourDetailsCardState();
}

class _YourDetailsCardState extends State<YourDetailsCard> {
  bool _editing = false, _justSaved = false;
  final _first = TextEditingController(), _last = TextEditingController(), _phone = TextEditingController(), _address = TextEditingController();

  @override
  void dispose() {
    for (final c in [_first, _last, _phone, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  void _startEdit(Map<String, String> d) {
    _first.text = d['firstName']!;
    _last.text = d['lastName']!;
    _phone.text = d['phone']!;
    _address.text = d['address']!;
    setState(() => _editing = true);
  }

  Future<void> _save() async {
    await context.read<ProfileState>().update({'firstName': _first.text.trim(), 'lastName': _last.text.trim(), 'phone': _phone.text.trim(), 'address': _address.text.trim()});
    if (!mounted) return;
    setState(() {
      _editing = false;
      _justSaved = true;
    });
    Future.delayed(const Duration(milliseconds: 2200), () => mounted ? setState(() => _justSaved = false) : null);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    final profile = context.watch<ProfileState>();
    final tickets = context.watch<TicketsState>().tickets;
    final d = profile.details(user, tickets);

    Widget line(IconData icon, String label, String value) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 9),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, size: 20, color: c.link),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.sub)),
                const SizedBox(height: 2),
                Text(value.isEmpty ? 'Not added yet' : value, style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: value.isEmpty ? c.placeholder : c.text)),
              ]),
            ),
          ]),
        );

    final fullName = [d['firstName'], d['lastName']].where((x) => x != null && x.isNotEmpty).join(' ');
    final fromBookings = user != null && d['firstName']!.isNotEmpty && profile.nameIsFromBookings();

    final heading = Text(widget.labelOutside ? 'YOUR DETAILS' : 'Your details',
        style: widget.labelOutside ? TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: c.text) : TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.text));
    final action = _justSaved
        ? const Text('✓ Saved', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Tokens.ok))
        : _editing
            ? const SizedBox.shrink()
            : Tap(
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
              );

    final card = KCard(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (!widget.labelOutside) ...[
          Row(children: [Expanded(child: heading), action]),
          const SizedBox(height: 6),
        ],
        if (!_editing) ...[
          line(Icons.person_rounded, 'Name', fullName),
          if (user != null) line(Icons.mail_rounded, 'Email', user.email ?? ''),
          line(Icons.phone_rounded, 'Phone', d['phone']!),
          line(Icons.home_rounded, 'Address', d['address']!),
          if (fromBookings) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Filled in from your bookings. Tap Edit to change anything.', style: TextStyle(fontSize: 12, color: c.sub))),
        ] else ...[
          const SizedBox(height: 8),
          KTextField(label: 'First name', hint: 'First name', controller: _first, capitalization: TextCapitalization.words),
          const SizedBox(height: 12),
          KTextField(label: 'Last name', hint: 'Last name', controller: _last, capitalization: TextCapitalization.words),
          if (user != null) ...[
            const SizedBox(height: 4),
            line(Icons.mail_rounded, 'Email (your login, so it stays as it is)', user.email ?? ''),
          ] else
            const SizedBox(height: 12),
          KTextField(label: 'Phone', hint: 'Phone', controller: _phone, keyboardType: TextInputType.phone),
          const SizedBox(height: 12),
          KTextField(label: 'Address', hint: 'Address', controller: _address, keyboardType: TextInputType.multiline, capitalization: TextCapitalization.words),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: KButton('Cancel', variant: ButtonVariant.soft, onPressed: () => setState(() => _editing = false))),
            const SizedBox(width: 10),
            Expanded(child: KButton('Save', onPressed: _save)),
          ]),
        ],
      ]),
    );

    if (!widget.labelOutside) return card;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Semantics(header: true, child: Row(children: [Expanded(child: heading), action])),
      const SizedBox(height: 10),
      card,
    ]);
  }
}
