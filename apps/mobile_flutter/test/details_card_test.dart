import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:storiedlands/core/auth.dart';
import 'package:storiedlands/core/profile.dart';
import 'package:storiedlands/core/theme.dart';
import 'package:storiedlands/core/tickets.dart';
import 'package:storiedlands/ui/details_card.dart';

void main() {
  Future<ProfileState> pump(WidgetTester tester, {Map<String, String>? booked}) async {
    SharedPreferences.setMockInitialValues({});
    final profile = ProfileState();
    await profile.load();
    if (booked != null) profile.booked = booked;
    final auth = AuthState()..user = AuthUser.fromJson({'id': 'u1', 'email': 'pat@example.org'});
    await tester.pumpWidget(MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider.value(value: profile),
        ChangeNotifierProvider(create: (_) => TicketsState()),
      ],
      child: MaterialApp(theme: buildTheme(false), home: const Scaffold(body: SingleChildScrollView(child: YourDetailsCard(labelOutside: true)))),
    ));
    return profile;
  }

  testWidgets('is filled in from the bookings, and read-only until Edit is pressed', (tester) async {
    await pump(tester, booked: {'name': 'Mrs Pat Buyer', 'phone': '0123456', 'address': '1 High St, Leeds'});
    expect(find.text('Pat Buyer'), findsOneWidget);
    expect(find.text('0123456'), findsOneWidget);
    expect(find.text('1 High St, Leeds'), findsOneWidget);
    expect(find.text('pat@example.org'), findsOneWidget);
    expect(find.byType(TextField), findsNothing, reason: 'no fields until Edit');

    await tester.tap(find.text('Edit'));
    await tester.pump();
    expect(find.byType(TextField), findsNWidgets(4));
    expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, 'Pat');
  });

  testWidgets('Save keeps the edit, Cancel throws it away', (tester) async {
    final profile = await pump(tester, booked: {'name': 'Pat Buyer'});
    await tester.tap(find.text('Edit'));
    await tester.pump();
    await tester.enterText(find.byType(TextField).at(2), '07700 900123');
    await tester.tap(find.text('Cancel'));
    await tester.pump();
    expect(find.text('07700 900123'), findsNothing);

    await tester.tap(find.text('Edit'));
    await tester.pump();
    await tester.enterText(find.byType(TextField).at(2), '07700 900123');
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle(const Duration(seconds: 3));
    expect(find.text('07700 900123'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(profile.saved['phone'], '07700 900123');
  });
}
