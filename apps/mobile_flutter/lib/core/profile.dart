import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'auth.dart';
import 'safe_notify.dart';
import 'tickets.dart';

const profileKey = 'kynren_profile';

/// The guest's own details: what they have typed in (kept on the phone), filled in from their bookings where blank.
/// Signed in, the name, phone and address on their bookings come from the park's booking system; nothing is shown that they
/// have not proved is theirs by verifying the email address.
class ProfileState extends ChangeNotifier with SafeNotify {
  Map<String, dynamic> saved = {};
  Map<String, String> booked = {};
  String? _bookedFor;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    try {
      final raw = p.getString(profileKey);
      saved = raw == null ? {} : Map<String, dynamic>.from(jsonDecode(raw) as Map);
    } catch (_) {
      saved = {};
    }
    notifyListeners();
  }

  /// Follows the signed-in guest: look up what their bookings say about them, once per sign-in.
  void syncWith(AuthUser? user) {
    if (user == null) {
      _bookedFor = null;
      if (booked.isNotEmpty) {
        booked = {};
        notifyListeners();
      }
      return;
    }
    if (_bookedFor == user.id) return;
    _bookedFor = user.id;
    _loadBooked();
  }

  Future<void> _loadBooked() async {
    try {
      final r = await api('/smeetz/profile') as Map;
      final next = <String, String>{};
      for (final k in ['name', 'phone', 'address']) {
        final v = r[k];
        if (v is String && v.trim().isNotEmpty) next[k] = v.trim();
      }
      booked = next;
      notifyListeners();
    } catch (_) {
      _bookedFor = null; // try again next time
    }
  }

  /// "Mrs Jane Smith" becomes (Jane, Smith).
  static (String, String) splitName(String full) {
    final parts = full.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isNotEmpty && RegExp(r'^(mr|mrs|ms|miss|mx|dr|master)\.?$', caseSensitive: false).hasMatch(parts.first)) parts.removeAt(0);
    if (parts.isEmpty) return ('', '');
    return (parts.first, parts.skip(1).join(' '));
  }

  String _saved(String k) => (saved[k] as String?)?.trim() ?? '';

  /// What to show: anything the guest saved wins; blanks fall back to their bookings, then the account, then the name on a ticket.
  Map<String, String> details(AuthUser? user, List<TicketItem> tickets) {
    var first = _saved('firstName'), last = _saved('lastName');
    if (first.isEmpty && last.isEmpty) {
      final holder = tickets.map((t) => t.holder).firstWhere((h) => h != null && h.trim().isNotEmpty, orElse: () => null);
      final account = user?.name;
      final full = booked['name'] ?? (account != null && account.trim().isNotEmpty ? account : (holder ?? ''));
      (first, last) = splitName(full);
    }
    var phone = _saved('phone');
    if (phone.isEmpty) phone = booked['phone'] ?? '';
    var address = _saved('address');
    if (address.isEmpty) address = booked['address'] ?? '';
    return {'firstName': first, 'lastName': last, 'phone': phone, 'address': address};
  }

  /// True when the name shown came from the bookings rather than from the guest.
  bool nameIsFromBookings() => _saved('firstName').isEmpty && _saved('lastName').isEmpty;

  /// "Hello, Jane": the first name only, or empty when none is known.
  String firstName(AuthUser? user, List<TicketItem> tickets) => details(user, tickets)['firstName']!;

  /// Merge new values over what is stored, so other settings (photo, access needs) are kept.
  Future<void> update(Map<String, dynamic> values) async {
    saved = {...saved, ...values};
    notifyListeners();
    final p = await SharedPreferences.getInstance();
    await p.setString(profileKey, jsonEncode(saved));
  }
}
