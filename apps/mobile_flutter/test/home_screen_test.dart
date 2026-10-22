import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:storiedlands/core/auth.dart';
import 'package:storiedlands/core/favorites.dart';
import 'package:storiedlands/core/models.dart';
import 'package:storiedlands/core/preferences.dart';
import 'package:storiedlands/core/sync.dart';
import 'package:storiedlands/core/theme.dart';
import 'package:storiedlands/screens/home_screen.dart';

Bundle _bundle() => Bundle.fromJson({
      'date': '2026-10-22',
      'attractions': [
        {'id': 'a1', 'slug': 'vikings', 'name': 'Land of the Vikings', 'category': 'VIKINGS', 'synopsis': 'x', 'durationMins': 20, 'sortOrder': 1},
      ],
      'pois': [],
      'restaurants': [],
      'ticketTypes': [],
      'content': [],
      'announcements': [],
      'sessions': [
        {
          'id': 's1',
          'attractionId': 'a1',
          'startTime': '2099-10-22T10:30:00.000Z',
          'endTime': '2099-10-22T11:00:00.000Z',
          'status': 'SCHEDULED',
          'attraction': {'id': 'a1', 'slug': 'vikings', 'name': 'Land of the Vikings', 'category': 'VIKINGS'},
        },
      ],
    });

void main() {
  testWidgets('Home renders its sections without errors', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    final sync = SyncState()
      ..bundle = _bundle()
      ..loading = false;
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<SyncState>.value(value: sync),
          ChangeNotifierProvider(create: (_) => AuthState()),
          ChangeNotifierProvider(create: (_) => FavoritesState()),
          ChangeNotifierProvider(create: (_) => PreferencesState()),
        ],
        child: MaterialApp(theme: buildTheme(false), home: const HomeScreen()),
      ),
    );
    await tester.pump(const Duration(seconds: 2));
    expect(tester.takeException(), isNull);
    expect(find.text('Welcome'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Land of the Vikings'), 300, scrollable: find.byType(Scrollable).first);
    expect(find.text('Land of the Vikings'), findsWidgets);
  });
}
