import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'auth.dart';
import 'format.dart';
import 'safe_notify.dart';

const _parkKey = 'kynren_tickets';
const _bookingKey = 'kynren_booking_tickets';
const _bookingAtKey = 'kynren_booking_tickets_at';
const _labelsKey = 'kynren_ticket_labels';
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
  /// What the QR code holds: Smeetz's own QR payload for the ticket where the booking has one, else its barcode.
  final String code;

  /// The short code printed with the ticket (Smeetz's barcode), for the gate to key in if a QR will not scan.
  final String? shortCode;
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
    this.shortCode,
    this.status,
    this.bookedOn,
    this.extras = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id, 'isPark': isPark, 'title': title, 'priceName': priceName, 'date': date, 'holder': holder,
        'reference': reference, 'code': code, 'shortCode': shortCode, 'status': status, 'bookedOn': bookedOn, 'extras': extras,
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
        shortCode: j['shortCode'] as String?,
        status: j['status'] as String?,
        bookedOn: j['bookedOn'] as String?,
        extras: (j['extras'] as List?)?.cast<String>() ?? const [],
      );
}

/// The tickets in a guest's linked bookings, as the API sends them (`/smeetz/my-orders`).
List<TicketItem> ticketsFromBookings(List orders) {
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
        // the QR carries Smeetz's own payload for the ticket; a booking that has none yet falls back to the barcode
        final qr = tk['qr'] as String?;
        out.add(TicketItem(
          id: barcode,
          isPark: false,
          title: line['name'] as String,
          priceName: line['priceName'] as String?,
          date: tk['night'] as String?,
          holder: tk['holder'] as String?,
          reference: o['reference'] as String,
          code: qr != null && qr.isNotEmpty ? qr : barcode,
          shortCode: barcode,
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

/// How far off a ticket's day is, by the park's calendar: 0 is today. Null for a ticket with no usable date.
int? ticketDaysAway(String? date, {String? today}) {
  if (date == null || !RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(date)) return null;
  final t = today ?? ukTodayStr();
  final a = DateTime.utc(int.parse(date.substring(0, 4)), int.parse(date.substring(5, 7)), int.parse(date.substring(8, 10)));
  final b = DateTime.utc(int.parse(t.substring(0, 4)), int.parse(t.substring(5, 7)), int.parse(t.substring(8, 10)));
  return a.difference(b).inDays;
}

/// "Today", "Tomorrow", "In 5 days", "Yesterday", "3 days ago".
String ticketCountdown(int days) => switch (days) {
      0 => 'Today',
      1 => 'Tomorrow',
      -1 => 'Yesterday',
      > 1 => 'In $days days',
      _ => '${-days} days ago',
    };

/// Whether the booking system has marked the ticket as already scanned.
bool ticketIsUsed(TicketItem t) => t.status != null && RegExp('used|redeem|scanned').hasMatch(t.status!);

/// Something the guest should know before holding a ticket up: it has been scanned, or it is for another day.
class TicketNotice {
  final String text;

  /// true when the ticket will not get them in as it is (already scanned), false for a heads-up (another day).
  final bool serious;
  const TicketNotice(this.text, {required this.serious});
}

TicketNotice? ticketNotice(TicketItem t, {String? today}) {
  if (ticketIsUsed(t)) return const TicketNotice('This ticket has already been scanned.', serious: true);
  final days = ticketDaysAway(t.date, today: today);
  if (days == null || days == 0) return null;
  final day = ticketDay(t.date);
  return days > 0
      ? TicketNotice('This ticket is for $day, not today.', serious: false)
      : TicketNotice('This ticket was for $day. That day has passed.', serious: true);
}

/// The tickets in the same booking as [t] (including it), in the order they are held. A ticket with no booking
/// reference is on its own.
List<TicketItem> ticketsInBooking(List<TicketItem> all, TicketItem t) =>
    t.reference.isEmpty ? [t] : [for (final x in all) if (x.reference == t.reference && x.isPark == t.isPark) x];

/// An iCalendar all-day event for the day of a ticket, with a reminder the evening before. Null when the ticket has no date.
String? ticketIcs(TicketItem t, {String place = 'Kynren – The Storied Lands'}) {
  final day = t.date;
  if (day == null || !RegExp(r'^\d{4}-\d{2}-\d{2}').hasMatch(day)) return null;
  final d = DateTime.utc(int.parse(day.substring(0, 4)), int.parse(day.substring(5, 7)), int.parse(day.substring(8, 10)));
  String two(int n) => n.toString().padLeft(2, '0');
  String ymd(DateTime x) => '${x.year.toString().padLeft(4, '0')}${two(x.month)}${two(x.day)}';
  String esc(String s) => s.replaceAll('\\', r'\\').replaceAll(';', r'\;').replaceAll(',', r'\,').replaceAll('\n', r'\n');
  final stamp = DateTime.now().toUtc();
  final what = t.priceName == null || t.priceName!.isEmpty ? t.title : '${t.title} (${t.priceName})';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kynren//Park app//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:ticket-${t.id}@kynren.com',
    'DTSTAMP:${ymd(stamp)}T${two(stamp.hour)}${two(stamp.minute)}${two(stamp.second)}Z',
    'DTSTART;VALUE=DATE:${ymd(d)}',
    'DTEND;VALUE=DATE:${ymd(d.add(const Duration(days: 1)))}',
    'SUMMARY:${esc('Kynren – $what')}',
    'LOCATION:${esc(place)}',
    'DESCRIPTION:${esc('${t.reference.isEmpty ? '' : 'Booking ${t.reference}. '}Show the QR code in the Kynren app at the gate.')}',
    'BEGIN:VALARM',
    'TRIGGER:-PT15H',
    'ACTION:DISPLAY',
    'DESCRIPTION:${esc('Kynren is tomorrow: your tickets are in the app')}',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/// Every ticket the guest holds: those saved on this phone, and the tickets in any bookings linked to their
/// account. The linked ones are kept on the phone too, so the list and each ticket still open with no signal.
class TicketsState extends ChangeNotifier with SafeNotify {
  List<TicketItem> park = [], booking = [];
  bool loading = true;

  /// Names the guest has given tickets on this phone ("Mum", "Jack"), by ticket id: bookings often have no holder name.
  Map<String, String> labels = {};

  /// Who a ticket is for: the guest's own name for it, else the holder on the booking.
  String? holderFor(TicketItem t) {
    final own = labels[t.id];
    return own != null && own.isNotEmpty ? own : t.holder;
  }

  /// Gives a ticket a name of the guest's own, kept on the phone; an empty name takes it away again.
  Future<void> setLabel(String id, String name) async {
    final n = name.trim();
    if (n.isEmpty) {
      labels = {...labels}..remove(id);
    } else {
      labels = {...labels, id: n.length > 40 ? n.substring(0, 40) : n};
    }
    notifyListeners();
    try {
      await (await SharedPreferences.getInstance()).setString(_labelsKey, jsonEncode(labels));
    } catch (_) {}
  }

  /// When the bookings were last fetched from the server (kept on the phone with them), so the guest can see how fresh the list is.
  DateTime? updatedAt;
  AuthUser? _user;

  List<TicketItem> get tickets => [...booking, ...park];

  Future<void> _loadBookings() async {
    final orders = await api('/smeetz/my-orders') as List;
    booking = ticketsFromBookings(orders);
    updatedAt = DateTime.now();
    notifyListeners();
    final p = await SharedPreferences.getInstance();
    await p.setString(_bookingKey, jsonEncode([for (final t in booking) t.toJson()]));
    await p.setString(_bookingAtKey, updatedAt!.toIso8601String());
  }

  /// Asks the booking system for anything new, then reads the bookings again (pull to refresh).
  Future<void> refresh() async {
    if (_user == null) return;
    try {
      await api('/smeetz/refresh', method: 'POST');
    } catch (_) {}
    await reload();
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
      labels = {for (final e in (jsonDecode(p.getString(_labelsKey) ?? '{}') as Map).entries) e.key as String: e.value as String};
    } catch (_) {
      labels = {};
    }
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
      await p.remove(_bookingAtKey);
      updatedAt = null;
      return;
    }
    try {
      final cached = p.getString(_bookingKey);
      if (cached != null) booking = [for (final j in jsonDecode(cached) as List) TicketItem.fromJson(j as Map<String, dynamic>)];
      updatedAt = DateTime.tryParse(p.getString(_bookingAtKey) ?? '');
    } catch (_) {}
    loading = false;
    notifyListeners();
    await reload();
    api('/smeetz/refresh', method: 'POST').then((_) => _loadBookings()).catchError((_) {});
  }
}

/// Link a booking by its reference. Throws if it can't be found.
Future<void> linkBooking(String reference) => api('/smeetz/link', method: 'POST', body: {'reference': reference});
