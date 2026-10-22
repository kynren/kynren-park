import 'package:go_router/go_router.dart';
import '../screens/attraction_screen.dart';
import '../screens/auth_screen.dart';
import '../screens/food_screens.dart';
import '../screens/home_screen.dart';
import '../screens/info_screens.dart';
import '../screens/language_screen.dart';
import '../screens/map/map_screen.dart';
import '../screens/menu_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/plan_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/programme_screen.dart';
import '../screens/restaurant_screen.dart';
import '../screens/saved_screens.dart';
import '../screens/scan_screen.dart';
import '../screens/search_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/shop_facility_screens.dart';
import '../screens/tickets_screens.dart';
import 'shell.dart';

/// Routes mirror the Expo Router tree in apps/mobile/app: four tabs plus pushed screens.
final router = GoRouter(
  initialLocation: '/',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => AppShell(shell: shell),
      branches: [
        StatefulShellBranch(routes: [GoRoute(path: '/', builder: (_, _) => const HomeScreen())]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/search', builder: (_, state) => SearchScreen(linkedFilter: state.uri.queryParameters['filter'])),
        ]),
        StatefulShellBranch(routes: [GoRoute(path: '/map', builder: (_, state) => MapScreen(focus: state.uri.queryParameters['focus'], spot: state.uri.queryParameters['spot']))]),
        StatefulShellBranch(routes: [GoRoute(path: '/food', builder: (_, _) => const FoodScreen())]),
      ],
    ),
    GoRoute(path: '/attraction/:slug', builder: (_, state) => AttractionScreen(slug: state.pathParameters['slug']!)),
    GoRoute(path: '/restaurant/:slug', builder: (_, state) => RestaurantScreen(slug: state.pathParameters['slug']!)),
    GoRoute(path: '/restaurants', builder: (_, state) => RestaurantsScreen(slot: state.uri.queryParameters['slot'])),
    GoRoute(path: '/shop/:slug', builder: (_, state) => ShopScreen(slug: state.pathParameters['slug']!)),
    GoRoute(path: '/shows', builder: (_, _) => const ProgrammeScreen()),
    GoRoute(path: '/plan', builder: (_, _) => const PlanScreen()),
    GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
    GoRoute(path: '/language', builder: (_, _) => const LanguageScreen()),
    // The menu is a drawer over whatever opened it, so the page behind stays visible.
    GoRoute(
      path: '/menu',
      pageBuilder: (_, state) => CustomTransitionPage(key: state.pageKey, opaque: false, transitionsBuilder: (_, _, _, child) => child, child: const MenuScreen()),
    ),
    GoRoute(path: '/auth', builder: (_, _) => const AuthScreen()),
    GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen()),
    GoRoute(path: '/settings', builder: (_, _) => const SettingsScreen()),
    GoRoute(path: '/orders', builder: (_, _) => const OrdersScreen()),
    GoRoute(path: '/accessibility', builder: (_, _) => const AccessibilityScreen()),
    GoRoute(path: '/shuttle', builder: (_, _) => const ShuttleScreen()),
    GoRoute(path: '/tickets', builder: (_, _) => const TicketsScreen()),
    GoRoute(path: '/ticket/:id', builder: (_, state) => TicketScreen(id: state.pathParameters['id']!)),
    GoRoute(
      path: '/find-bookings',
      builder: (_, state) => FindBookingsScreen(email: state.uri.queryParameters['email'], setup: state.uri.queryParameters['setup'] == '1'),
    ),
    GoRoute(path: '/favorites', builder: (_, _) => const FavoritesScreen()),
    GoRoute(path: '/seen', builder: (_, _) => const SeenScreen()),
    GoRoute(path: '/scan', builder: (_, _) => const ScanScreen()),
    GoRoute(path: '/facility/:id', builder: (_, state) => FacilityScreen(id: state.pathParameters['id']!)),
  ],
);
