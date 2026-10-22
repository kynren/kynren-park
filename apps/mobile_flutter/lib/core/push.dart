import 'dart:io' show Platform;
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'api.dart';
import 'auth.dart';

/// Turn an admin-entered NotificationTemplate/Announcement `deepLink` (free text) into an in-app route. The backend's
/// own generated deepLinks are already bare paths ("/attraction/slug"); the field is free text, so this also copes with
/// a scheme-prefixed form ("kynren://attraction/slug") and the old Expo Router style ("/(tabs)/food"). Null for blank.
String? resolveDeepLink(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  var path = trimmed.replaceFirst(RegExp(r'^[a-z][a-z0-9+.-]*://', caseSensitive: false), '');
  if (!path.startsWith('/')) path = '/$path';
  path = path.replaceFirst(RegExp(r'^/\(tabs\)'), '');
  if (path.isEmpty || path == '/index') path = '/';
  return path;
}

/// Native push through Firebase Cloud Messaging: asks permission, registers this device's token with the API (guests
/// included; it links to the guest once they sign in) and routes a tapped notification. Everything here is
/// best-effort: where Firebase is not configured (web, a desktop build) push is simply off.
class PushState {
  /// Called with (title, body, deepLink) when a notification arrives while the app is open.
  void Function(String title, String body, String? deepLink)? onForeground;

  /// Called with an in-app route when the guest taps a notification.
  void Function(String route)? onOpen;

  bool _started = false;
  String? _token;
  AuthUser? _user;

  Future<void> start() async {
    if (_started || kIsWeb) return;
    _started = true;
    try {
      await Firebase.initializeApp();
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission();
      // iOS shows no banner for a notification that arrives while the app is open unless asked to.
      await fm.setForegroundNotificationPresentationOptions(alert: false, badge: false, sound: false);

      // The classic registration token is what the API sends to (FCM v1 `token`). The newer register()/onRegistered
      // pair hands out a Firebase Installation ID instead; stay on the token until that is confirmed to work with the
      // API's sendEachForMulticast.
      // ignore: deprecated_member_use
      _token = await fm.getToken();
      await _register();
      // ignore: deprecated_member_use
      fm.onTokenRefresh.listen((t) {
        _token = t;
        _register();
      });

      FirebaseMessaging.onMessage.listen((m) {
        final n = m.notification;
        if (n == null) return;
        onForeground?.call(n.title ?? '', n.body ?? '', m.data['deepLink'] as String?);
      });
      FirebaseMessaging.onMessageOpenedApp.listen(_open);
      final initial = await fm.getInitialMessage();
      if (initial != null) _open(initial);
    } catch (e) {
      if (kDebugMode) debugPrint('Push is off: $e');
    }
  }

  void _open(RemoteMessage m) {
    final link = m.data['deepLink'] as String?;
    final route = link != null ? resolveDeepLink(link) : (m.data['type'] == 'announcement' ? '/notifications' : null);
    if (route != null) onOpen?.call(route);
  }

  /// Sign-in changes: register again so the API links this device to the guest.
  void syncWith(AuthUser? user) {
    final changed = user?.id != _user?.id;
    _user = user;
    if (changed && _token != null) _register();
  }

  Future<void> _register() async {
    final token = _token;
    if (token == null) return;
    try {
      // Public endpoint: registers the device even for guests, and links to the signed-in guest when a token is sent.
      await api('/push/register', method: 'POST', body: {'token': token, 'platform': Platform.isIOS ? 'ios' : 'android'});
    } catch (_) {}
  }
}
