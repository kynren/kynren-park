import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:storiedlands/app/router.dart';
import 'package:storiedlands/core/format.dart';
import 'package:storiedlands/main.dart';

class _FakePathProvider extends Fake with MockPlatformInterfaceMixin implements PathProviderPlatform {
  final String dir;
  _FakePathProvider(this.dir);
  @override
  Future<String?> getApplicationSupportPath() async => dir;
}

Future<void> _settle(WidgetTester tester, [int frames = 8]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 250));
  }
}

void main() {
  testWidgets('tickets show a Today card, group by booking, open full screen and swipe between a booking\'s tickets', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return; // the test font is square, so overflow here says nothing
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    final dir = Directory.systemTemp.createTempSync('kynren_tickets_test');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/kynren_bundle_${ukTodayStr()}.json').writeAsStringSync(File('test/fixtures/bundle.json').readAsStringSync());
    PathProviderPlatform.instance = _FakePathProvider(dir.path);

    // Tickets saved on the phone: two in one booking for today, one for a later night, one long past.
    final today = ukTodayStr();
    final later = DateTime.parse('${today}T12:00:00').add(const Duration(days: 12)).toIso8601String().substring(0, 10);
    SharedPreferences.setMockInitialValues({
      'kynren_tickets': jsonEncode([
        {'id': 't1', 'ticketType': 'Night Show Adult', 'visitDate': today, 'reference': 'FAM123', 'qrToken': 'QR-ONE'},
        {'id': 't2', 'ticketType': 'Night Show Child', 'visitDate': today, 'reference': 'FAM123', 'qrToken': 'QR-TWO'},
        {'id': 't3', 'ticketType': 'Night Show Adult', 'visitDate': later, 'reference': 'LATER9', 'qrToken': 'QR-THREE'},
        {'id': 't4', 'ticketType': 'Night Show Adult', 'visitDate': '2024-01-05', 'reference': 'OLD', 'qrToken': 'QR-OLD'},
      ]),
    });

    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    await tester.runAsync(() async {
      await tester.pumpWidget(const KynrenApp());
      await Future<void>.delayed(const Duration(seconds: 2));
    });
    await _settle(tester, 40);
    router.go('/tickets');
    await _settle(tester, 20);

    // the Today card and the countdown chips
    expect(find.text('TODAY'), findsOneWidget);
    expect(find.text('2 tickets for today'), findsOneWidget);
    expect(find.text('In 12 days'), findsOneWidget);
    expect(find.textContaining('BOOKING FAM123 · 2 TICKETS'), findsOneWidget, reason: 'two tickets of one booking read as a set');
    expect(find.textContaining('BOOKING LATER9'), findsNothing, reason: 'a lone ticket needs no caption');
    expect(find.textContaining('Saved on this phone'), findsOneWidget);

    // full screen, and swiping to the booking's other ticket
    await tester.tap(find.text('Show at the gate'));
    await _settle(tester);
    expect(find.text('Ticket 1 of 2'), findsOneWidget);
    await tester.drag(find.byType(PageView), const Offset(-600, 0));
    await _settle(tester);
    expect(find.text('Ticket 2 of 2'), findsOneWidget);
    expect(find.text('Night Show Child'), findsOneWidget);
    await tester.tap(find.byTooltip('Close'));
    await _settle(tester);
    expect(find.text('Ticket 2 of 2'), findsNothing);

    // one ticket: its actions, the rest of its booking, and the reference copies on a tap
    router.push('/ticket/t1');
    await _settle(tester, 20);
    expect(find.text('Full screen'), findsOneWidget);
    expect(find.text('Share'), findsOneWidget);
    expect(find.text('Add to calendar'), findsOneWidget);
    expect(find.text('Find the entrance'), findsOneWidget);
    expect(find.text('Your visit is today'), findsOneWidget);
    expect(find.text('Tickets in this booking · 2'), findsOneWidget);
    await tester.ensureVisible(find.text('FAM123'));
    await tester.pump();
    await tester.tap(find.text('FAM123'));
    await _settle(tester, 2);
    expect(find.text('Booking reference copied'), findsOneWidget);

    // a ticket whose night has gone has no calendar button or countdown
    router.pushReplacement('/ticket/t4');
    await _settle(tester, 20);
    expect(find.text('Add to calendar'), findsNothing);
    expect(find.textContaining('Your visit is'), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });

  testWidgets('a ticket can be named, warns about the wrong night, shares a whole booking, and past tickets fold away', (tester) async {
    final original = FlutterError.onError!;
    FlutterError.onError = (d) {
      if (d.exceptionAsString().contains('overflowed')) return;
      original(d);
    };
    addTearDown(() => FlutterError.onError = original);

    final dir = Directory.systemTemp.createTempSync('kynren_tickets_test2');
    addTearDown(() => dir.deleteSync(recursive: true));
    File('${dir.path}/kynren_bundle_${ukTodayStr()}.json').writeAsStringSync(File('test/fixtures/bundle.json').readAsStringSync());
    PathProviderPlatform.instance = _FakePathProvider(dir.path);

    final later = DateTime.parse('${ukTodayStr()}T12:00:00').add(const Duration(days: 3)).toIso8601String().substring(0, 10);
    SharedPreferences.setMockInitialValues({
      'kynren_tickets': jsonEncode([
        {'id': 'a1', 'ticketType': 'Night Show Adult', 'visitDate': later, 'reference': 'GRP77', 'qrToken': 'QR-A1'},
        {'id': 'a2', 'ticketType': 'Night Show Child', 'visitDate': later, 'reference': 'GRP77', 'qrToken': 'QR-A2'},
        {'id': 'old', 'ticketType': 'Night Show Adult', 'visitDate': '2024-01-05', 'reference': 'OLD', 'qrToken': 'QR-OLD'},
      ]),
    });
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    await tester.runAsync(() async {
      await tester.pumpWidget(const KynrenApp());
      await Future<void>.delayed(const Duration(seconds: 2));
    });
    await _settle(tester, 40);
    router.go('/tickets');
    await _settle(tester, 20);

    // past tickets are folded away until asked for
    expect(find.text('Past · 1'), findsOneWidget);
    expect(find.text('5 Jan 2024'), findsNothing);
    await tester.ensureVisible(find.text('Show'));
    await tester.pump();
    await tester.tap(find.text('Show'));
    await _settle(tester, 4);
    expect(find.textContaining('5 Jan 2024'), findsWidgets);

    // a ticket for another night says so, offers the rest of the booking and shortcuts for the visit
    router.push('/ticket/a1');
    await _settle(tester, 20);
    expect(find.textContaining('not today.'), findsOneWidget);
    expect(find.text('Share all 2 tickets'), findsOneWidget);
    expect(find.text('Before you go'), findsOneWidget);
    expect(find.text('Getting here'), findsOneWidget);
    expect(find.text('Add a name'), findsOneWidget);

    // naming it
    await tester.ensureVisible(find.text('Add a name'));
    await tester.pump();
    await tester.tap(find.text('Add a name'));
    await _settle(tester, 3);
    expect(find.text('Who is this ticket for?'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Mum');
    await tester.tap(find.text('Save'));
    await _settle(tester, 4);
    expect(find.text('Add a name'), findsNothing);
    expect(find.text('Mum'), findsWidgets, reason: 'on the ticket, and in its booking list');

    // and the gate view carries the warning and the name
    await tester.ensureVisible(find.text('Full screen'));
    await tester.pump();
    await tester.tap(find.text('Full screen'));
    await _settle(tester);
    expect(find.text('Ticket 1 of 2'), findsOneWidget, reason: 'the gate view really opened');
    expect(find.textContaining('not today.'), findsWidgets);
    expect(find.text('Mum'), findsWidgets);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 30));
  });
}
