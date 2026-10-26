import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:storiedlands/core/auth.dart';
import 'package:storiedlands/core/notifications.dart';
import 'package:storiedlands/core/sync.dart';
import 'package:storiedlands/core/theme.dart';
import 'package:storiedlands/ui/screen.dart';
import 'package:storiedlands/ui/status_bar.dart';

/// The status-bar style actually in force at the top of the screen.
SystemUiOverlayStyle? _styleAtTop(WidgetTester tester) => tester.binding.renderViews.first.debugLayer?.find<SystemUiOverlayStyle>(const Offset(10, 5));

Widget _app(Widget home, {ThemeMode mode = ThemeMode.light}) => MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SyncState()..loading = false),
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider(create: (_) => UnreadNotifications()),
      ],
      child: MaterialApp(
        theme: buildTheme(false),
        darkTheme: buildTheme(true),
        themeMode: mode,
        // the same default the app sets: dark icons on a light page, white in dark mode
        builder: (context, child) => StatusBarIcons(light: Theme.of(context).brightness == Brightness.dark, child: child!),
        home: home,
      ),
    );

void main() {
  testWidgets('a screen with a green header gets white status-bar icons, so they can be seen on it', (tester) async {
    await tester.pumpWidget(_app(const KScreen(title: 'My Tickets', children: [Text('body')])));
    await tester.pump();
    final style = _styleAtTop(tester);
    expect(style?.statusBarIconBrightness, Brightness.light, reason: 'Android: light icons');
    expect(style?.statusBarBrightness, Brightness.dark, reason: 'iOS names it the other way round');
    expect(style?.statusBarColor, Colors.transparent);
  });

  testWidgets('a plain light screen keeps dark icons, and dark mode gets white ones', (tester) async {
    await tester.pumpWidget(_app(const Scaffold(body: Text('plain'))));
    await tester.pump();
    expect(_styleAtTop(tester)?.statusBarIconBrightness, Brightness.dark);

    await tester.pumpWidget(_app(const Scaffold(body: Text('plain')), mode: ThemeMode.dark));
    await tester.pumpAndSettle(); // the theme fades over 200 ms
    expect(_styleAtTop(tester)?.statusBarIconBrightness, Brightness.light);
  });
}
