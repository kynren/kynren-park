import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:storiedlands/core/ticket_share.dart';
import 'package:storiedlands/core/tickets.dart';

TicketItem ticket(String id, {String? date = '2026-10-28', String reference = 'REF1', String? holder, String? priceName = 'Adult', bool isPark = false}) =>
    TicketItem(id: id, isPark: isPark, title: 'Kynren Night Show', priceName: priceName, date: date, holder: holder, reference: reference, code: 'CODE-$id');

void main() {
  group('how far off a visit is', () {
    test('counted in days by the park calendar', () {
      expect(ticketDaysAway('2026-10-26', today: '2026-10-26'), 0);
      expect(ticketDaysAway('2026-10-27', today: '2026-10-26'), 1);
      expect(ticketDaysAway('2026-11-02', today: '2026-10-26'), 7);
      expect(ticketDaysAway('2026-10-25', today: '2026-10-26'), -1);
      expect(ticketDaysAway('2027-01-01T20:00:00.000Z', today: '2026-12-31'), 1, reason: 'across a year end, and an ISO timestamp counts by its date');
    });

    test('a ticket with no usable date has no countdown', () {
      expect(ticketDaysAway(null), isNull);
      expect(ticketDaysAway('Saturday night'), isNull);
    });

    test('and reads as words', () {
      expect(ticketCountdown(0), 'Today');
      expect(ticketCountdown(1), 'Tomorrow');
      expect(ticketCountdown(5), 'In 5 days');
      expect(ticketCountdown(-1), 'Yesterday');
      expect(ticketCountdown(-4), '4 days ago');
    });
  });

  test('the tickets in one booking are found together, and a ticket with no reference stands alone', () {
    final a = ticket('a'), b = ticket('b'), c = ticket('c', reference: 'REF2'), d = ticket('d', reference: ''), e = ticket('e', reference: '');
    final all = [a, c, b, d, e];
    expect(ticketsInBooking(all, a).map((t) => t.id), ['a', 'b']);
    expect(ticketsInBooking(all, c).map((t) => t.id), ['c']);
    expect(ticketsInBooking(all, d).map((t) => t.id), ['d'], reason: 'two tickets with no reference are not one booking');
  });

  group('the calendar event for a visit', () {
    test('is an all-day event on the ticket\'s day, with a reminder the evening before', () {
      final ics = ticketIcs(ticket('a', date: '2026-10-28', priceName: 'Adult'))!;
      expect(ics, contains('BEGIN:VEVENT'));
      expect(ics, contains('DTSTART;VALUE=DATE:20261028\r\n'));
      expect(ics, contains('DTEND;VALUE=DATE:20261029\r\n'));
      expect(ics, contains('SUMMARY:Kynren – Kynren Night Show (Adult)\r\n'));
      expect(ics, contains('TRIGGER:-PT15H'));
      expect(ics, contains('Booking REF1'));
      expect(ics.endsWith('END:VCALENDAR\r\n'), isTrue);
    });

    test('rolls over month ends and escapes what a calendar file cannot hold', () {
      final ics = ticketIcs(TicketItem(id: 'x', isPark: false, title: 'Night, show; part 2', date: '2026-10-31', reference: '', code: 'c'))!;
      expect(ics, contains('DTEND;VALUE=DATE:20261101'));
      expect(ics, contains(r'SUMMARY:Kynren – Night\, show\; part 2'));
      expect(ics, isNot(contains('Booking ')), reason: 'no reference, so none is claimed');
    });

    test('is not made for a ticket with no date', () {
      expect(ticketIcs(ticket('a', date: null)), isNull);
    });
  });

  test('a shared ticket says which night, whose and which booking', () {
    final text = ticketShareText(ticket('a', holder: 'Ann Guest'));
    expect(text, contains('Kynren Night Show'));
    expect(text, contains('28 Oct 2026'));
    expect(text, contains('Ann Guest'));
    expect(text, contains('Booking REF1'));
  });

  test('the QR picture is a real PNG', () async {
    final bytes = await ticketQrPng('HELLO', size: 200, margin: 20);
    expect(bytes.sublist(0, 8), [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    expect(bytes.length, greaterThan(200));
  });

  group('what a guest should know before holding a ticket up', () {
    test('a scanned ticket is a serious warning, whatever its day', () {
      final used = TicketItem(id: 'u', isPark: false, title: 'Night', date: '2026-10-26', reference: 'R', code: 'c', status: 'redeemed');
      expect(ticketIsUsed(used), isTrue);
      final n = ticketNotice(used, today: '2026-10-26')!;
      expect(n.serious, isTrue);
      expect(n.text, contains('already been scanned'));
    });

    test('a ticket for another night is a heads-up; one for a night gone is serious; today has no notice', () {
      final later = ticketNotice(ticket('a', date: '2026-10-28'), today: '2026-10-26')!;
      expect(later.serious, isFalse);
      expect(later.text, 'This ticket is for 28 Oct 2026, not today.');
      final gone = ticketNotice(ticket('b', date: '2026-10-20'), today: '2026-10-26')!;
      expect(gone.serious, isTrue);
      expect(gone.text, contains('has passed'));
      expect(ticketNotice(ticket('c', date: '2026-10-26'), today: '2026-10-26'), isNull);
      expect(ticketNotice(ticket('d', date: null)), isNull, reason: 'no date, no claim about the day');
    });
  });

  test('a ticket can be given a name that outlives the app, and the holder on the booking is the fallback', () async {
    SharedPreferences.setMockInitialValues({});
    final state = TicketsState();
    final a = ticket('a', holder: 'Booker B');
    expect(state.holderFor(a), 'Booker B');
    await state.setLabel('a', '  Mum  ');
    expect(state.holderFor(a), 'Mum');
    await state.setLabel('b', 'x' * 80);
    expect(state.labels['b']!.length, 40, reason: 'kept to a sensible length');

    final again = TicketsState();
    await again.load(null);
    expect(again.holderFor(a), 'Mum', reason: 'read back from the phone');

    await again.setLabel('a', '   ');
    expect(again.holderFor(a), 'Booker B', reason: 'an empty name takes the label away');
  });

  test('several tickets are shared as one message that lists them', () {
    final text = ticketShareText(ticket('a', holder: 'Ann'), holder: 'Mum');
    expect(text, contains('Mum'));
    expect(text, isNot(contains('Ann')), reason: 'the name the guest chose wins');
  });

  group('the QR code on a booked ticket', () {
    Map<String, dynamic> order(List<Map<String, dynamic>> tickets) => {
          'reference': 'REF9',
          'order': {
            'placedAt': '2026-10-01T10:00:00Z',
            'lines': [
              {'kind': 'TICKET', 'name': 'Night Show', 'priceName': 'Adult', 'quantity': tickets.length, 'tickets': tickets},
            ],
          },
        };

    test('holds the payload Smeetz gives for the ticket, with the short barcode kept for the gate to key in', () {
      final t = ticketsFromBookings([
        order([
          {'barcode': 'BC12345678', 'qr': 'SMEETZ-QR-PAYLOAD-ONE', 'status': 'completed', 'night': '2026-10-31', 'holder': 'Ann'},
        ]),
      ]).single;
      expect(t.code, 'SMEETZ-QR-PAYLOAD-ONE');
      expect(t.shortCode, 'BC12345678');
      expect(t.id, 'BC12345678', reason: 'the id stays the barcode, so names given to tickets and links to them keep working');
    });

    test('falls back to the barcode when the booking has no payload yet, or Smeetz has none', () {
      final tickets = ticketsFromBookings([
        order([
          {'barcode': 'BCAAAAAAAA', 'status': 'completed'},
          {'barcode': 'BCBBBBBBBB', 'qr': '', 'status': 'completed'},
        ]),
      ]);
      expect(tickets.map((t) => t.code), ['BCAAAAAAAA', 'BCBBBBBBBB']);
      expect(tickets.every((t) => t.shortCode == t.code), isTrue);
    });

    test('is not made for a cancelled ticket, and survives being kept on the phone', () {
      final tickets = ticketsFromBookings([
        order([
          {'barcode': 'BCDEAD0000', 'qr': 'QR-DEAD', 'status': 'cancelled'},
          {'barcode': 'BCLIVE0000', 'qr': 'QR-LIVE', 'status': 'completed'},
        ]),
      ]);
      expect(tickets.map((t) => t.id), ['BCLIVE0000']);
      final back = TicketItem.fromJson(tickets.single.toJson());
      expect(back.code, 'QR-LIVE');
      expect(back.shortCode, 'BCLIVE0000');
      // a ticket saved by an older build has no short code and still opens
      final old = TicketItem.fromJson({'id': 'x', 'isPark': false, 'title': 'T', 'reference': 'R', 'code': 'OLDCODE'});
      expect(old.code, 'OLDCODE');
      expect(old.shortCode, isNull);
    });
  });
}
