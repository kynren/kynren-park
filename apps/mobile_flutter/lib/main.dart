import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app/overlays.dart';
import 'app/router.dart';
import 'app/splash.dart';
import 'core/auth.dart';
import 'core/favorites.dart';
import 'core/i18n.dart';
import 'core/location.dart';
import 'core/notifications.dart';
import 'core/preferences.dart';
import 'core/profile.dart';
import 'core/push.dart';
import 'core/restaurant_favs.dart';
import 'core/sync.dart';
import 'core/tickets.dart';
import 'ui/status_bar.dart';
import 'core/theme.dart';
import 'core/theme_mode.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KynrenApp());
}

class KynrenApp extends StatefulWidget {
  const KynrenApp({super.key});
  @override
  State<KynrenApp> createState() => _KynrenAppState();
}

class _KynrenAppState extends State<KynrenApp> {
  final _sync = SyncState();
  final _auth = AuthState();
  final _favs = FavoritesState();
  final _prefs = PreferencesState();
  final _restaurantFavs = RestaurantFavs();
  final _i18n = I18nState();
  final _themePref = ThemePref();
  final _unread = UnreadNotifications();
  final _tickets = TicketsState();
  final _profile = ProfileState();
  final _location = LocationState();
  final _push = PushState();
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    // Things that follow the signed-in guest reload whenever they change.
    _auth.addListener(() {
      _favs.syncWith(_auth.user);
      _prefs.syncWith(_auth.user);
      _unread.syncWith(_auth.user);
      _location.syncWith(_auth.user);
      _push.syncWith(_auth.user);
      _profile.syncWith(_auth.user);
    });
    _sync.start();
    _auth.restore();
    _prefs.load();
    _profile.load();
    _restaurantFavs.load();
    _i18n.load();
    _themePref.load();
    _location.start();
    _push.onOpen = (route) => router.push(route);
    // A notification that arrives while the app is open shows as a banner, and a tap on it opens its link.
    _push.onForeground = (title, body, deepLink) {
      final route = deepLink == null ? null : resolveDeepLink(deepLink);
      _messengerKey.currentState?.showSnackBar(SnackBar(
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w800)), if (body.isNotEmpty) Text(body)]),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 6),
        action: route == null ? null : SnackBarAction(label: 'Open', onPressed: () => router.push(route)),
      ));
    };
    _push.start();
  }

  @override
  void dispose() {
    _sync.dispose();
    _auth.dispose();
    _favs.dispose();
    _prefs.dispose();
    _restaurantFavs.dispose();
    _i18n.dispose();
    _themePref.dispose();
    _unread.dispose();
    _tickets.dispose();
    _profile.dispose();
    _location.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _sync),
        ChangeNotifierProvider.value(value: _auth),
        ChangeNotifierProvider.value(value: _favs),
        ChangeNotifierProvider.value(value: _prefs),
        ChangeNotifierProvider.value(value: _restaurantFavs),
        ChangeNotifierProvider.value(value: _i18n),
        ChangeNotifierProvider.value(value: _themePref),
        ChangeNotifierProvider.value(value: _unread),
        ChangeNotifierProvider.value(value: _tickets),
        ChangeNotifierProvider.value(value: _profile),
        ChangeNotifierProvider.value(value: _location),
      ],
      child: Consumer<SyncState>(
        builder: (context, sync, _) {
          // Admin Branding colours re-theme the app, except the old defaults, which mean "unset".
          final b = sync.bundle?.branding;
          final primary = brandColor(b?.primary, _oldPrimaries, Tokens.brand);
          final accent = brandColor(b?.accent, _oldAccents, Tokens.accent);
          return MaterialApp.router(
            title: 'Kynren',
            debugShowCheckedModeBanner: false,
            scaffoldMessengerKey: _messengerKey,
            theme: buildTheme(false, primary: primary, accent: accent),
            darkTheme: buildTheme(true, primary: primary, accent: accent),
            themeMode: context.watch<ThemePref>().mode,
            routerConfig: router,
            // The launch splash, announcements and first-time cards sit above every screen.
            builder: (context, child) => StatusBarIcons(
              light: Theme.of(context).brightness == Brightness.dark,
              child: Stack(fit: StackFit.expand, children: [child ?? const SizedBox.shrink(), const AnnouncementMegaphone(), const WalkthroughOverlay(), const LoadingOverlay()]),
            ),
          );
        },
      ),
    );
  }
}

// The colours admin Branding held before the redesign. A workspace still on one of them has not
// chosen a colour for the new design, so the app's own palette applies.
const _oldPrimaries = ['#8f1d21', '#1d2c49', '#2f80ed', '#1d5bd8'];
const _oldAccents = ['#22b365', '#de022d', '#7b4fe0', '#ef476f'];

Color brandColor(String? hex, List<String> previous, Color fallback) {
  final h = hex?.toLowerCase();
  if (h == null || previous.contains(h)) return fallback;
  final m = RegExp(r'^#([0-9a-f]{6})$').firstMatch(h);
  return m == null ? fallback : Color(0xFF000000 | int.parse(m.group(1)!, radix: 16));
}
