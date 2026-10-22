import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'auth.dart';
import 'safe_notify.dart';

const _parkKey = 'kynren_tickets';
const _bookingKey = 'kynren_booking_tickets';
final _dead = RegExp('CANCEL|REFUND|VOID|EXPIRE', caseSensitive: false);

/// One ticket the guest can show at the gate, whichever way it was bought.
class TicketItem {
  /// The code in the QR; unique, so it doubles as the ticket's id in the app.
  final String id;
  final bool isPark;
  final String title;
  /// The price band, e.g. "Adult".
  final String? priceName;
  /// The day it is for, as given (an ISO date or a yyyy-mm-dd).
  final String? date;
  final String? holder;
  /// The booking reference it belongs to.
  final String reference;
  final String code;
  final String? status, bookedOn;
  /// Other things in the same booking, e.g. "2 × Parking".
  final List<String> extras;

  const TicketItem({
    required this.id,
    required this.isPark,
    required this.title,
    this.priceName,
    this.date,
    this.holder,
    required this.reference,
    required this.code,
    this.status,
    this.bookedOn,
    this.extras = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id, 'isPark': isPark, 'title': title, 'priceName': priceName, 'date': date, 'holder': holder,
        'reference': reference, 'code': code, 'status': status, 'bookedOn': bookedOn, 'extras': extras,
      };

  factory TicketItem.fromJson(Map<String, dynamic> j) => TicketItem(
        id: j['id'] as String,
        isPark: j['isPark'] == true,
        title: j['title'] as String,
        priceName: j['priceName'] as String?,
        date: j['date'] as String?,
        holder: j['holder'] as String?,
        reference: j['reference'] as String? ?? '',
        code: j['code'] as String,
        status: j['status'] as String?,
        bookedOn: j['bookedOn'] as String?,
        extras: (j['extras'] as List?)?.cast<String>() ?? const [],
      );
}

List<TicketItem> _fromBookings(List orders) {
  final out = <TicketItem>[];
  for (final o in orders) {
    final order = (o as Map)['order'] as Map?;
    final lines = (order?['lines'] as List?) ?? const [];
    final extras = [for (final l in lines) if ((l as Map)['kind'] != 'TICKET') '${l['quantity']} × ${l['name']}'];
    for (final l in lines) {
      final line = l as Map;
      if (line['kind'] != 'TICKET') continue;
      for (final t in (line['tickets'] as List?) ?? const []) {
        final tk = t as Map;
        final barcode = tk['barcode'] as String?;
        if (barcode == null || barcode.isEmpty || _dead.hasMatch((tk['status'] as String?) ?? '')) continue;
        out.add(TicketItem(
          id: barcode,
          isPark: false,
          title: line['name'] as String,
          priceName: line['priceName'] as String?,
          date: tk['night'] as String?,
          holder: tk['holder'] as String?,
          reference: o['reference'] as String,
          code: barcode,
          status: (tk['status'] as String?)?.toLowerCase(),
          bookedOn: order?['placedAt'] as String?,
          extras: extras,
        ));
      }
    }
  }
  return out;
}

List<TicketItem> _fromPark(List tickets) => [
      for (final t in tickets)
        TicketItem(
          id: (t as Map)['id'] as String,
          isPark: true,
          title: t['ticketType'] as String,
          date: t['visitDate'] as String?,
          reference: t['reference'] as String? ?? '',
          code: t['qrToken'] as String,
        ),
    ];

/// "24 Oct 2026" for an ISO date; anything else is shown as it came.
String? ticketDay(String? date) {
  if (date == null) return null;
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(date)) return date;
  return DateFormat('d MMM yyyy').format(DateTime.parse(date.substring(0, 10)));
}

/// Whether the ticket's day has gone (tickets with no usable date count as still to come).
bool ticketIsPast(String? date) {
  if (date == null || !RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(date)) return false;
  return DateTime.parse('${date.substring(0, 10)}T23:59:59').isBefore(DateTime.now());
}

/// Every ticket the guest holds: those saved on this phone, and the tickets in any bookings linked to their
/// account. The linked ones are kept on the phone too, so the list and each ticket still open with no signal.
class TicketsState extends ChangeNotifier with SafeNotify {
  List<TicketItem> park = [], booking = [];
  bool loading = true;
  AuthUser? _user;

  List<TicketItem> get tickets => [...booking, ...park];

  Future<void> _loadBookings() async {
    final orders = await api('/smeetz/my-orders') as List;
    booking = _fromBookings(orders);
    notifyListeners();
    final p = await SharedPreferences.getInstance();
    await p.setString(_bookingKey, jsonEncode([for (final t in booking) t.toJson()]));
  }

  Future<void> reload() async {
    if (_user == null) return;
    try {
      await _loadBookings();
    } catch (_) {}
  }

  /// Show what is stored at once, then look again for bookings made since.
  Future<void> load(AuthUser? user) async {
    _user = user;
    final p = await SharedPreferences.getInstance();
    try {
      final raw = p.getString(_parkKey);
      park = _fromPark(raw == null ? [] : jsonDecode(raw) as List);
    } catch (_) {
      park = [];
    }
    if (user == null) {
      booking = [];
      loading = false;
      notifyListeners();
      await p.remove(_bookingKey);
      return;
    }
    try {
      final cached = p.getString(_bookingKey);
      if (cached != null) booking = [for (final j in jsonDecode(cached) as List) TicketItem.fromJson(j as Map<String, dynamic>)];
    } catch (_) {}
    loading = false;
    notifyListeners();
    await reload();
    api('/smeetz/refresh', method: 'POST').then((_) => _loadBookings()).catchError((_) {});
  }
}

/// Link a booking by its reference. Throws if it can't be found.
Future<void> linkBooking(String reference) => api('/smeetz/link', method: 'POST', body: {'reference': reference});
