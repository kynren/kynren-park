import 'package:flutter/foundation.dart';
import 'api.dart';
import 'auth.dart';
import 'safe_notify.dart';

class PersonalNotification {
  final String id, type, title, body, createdAt;
  final String? deepLink, readAt;
  PersonalNotification.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        type = j['type'] as String? ?? '',
        title = j['title'] as String? ?? '',
        body = j['body'] as String? ?? '',
        createdAt = j['createdAt'] as String? ?? '',
        deepLink = j['deepLink'] as String?,
        readAt = j['readAt'] as String?;
}

/// Unread count for the signed-in guest's personal notifications (delay alerts, order-ready, show
/// reminders). Reloaded when the guest changes and whenever [refresh] is called, so the bell badge
/// clears itself right after a visit to the notifications screen.
class UnreadNotifications extends ChangeNotifier with SafeNotify {
  int count = 0;
  AuthUser? _user;

  void syncWith(AuthUser? user) {
    _user = user;
    refresh();
  }

  Future<void> refresh() async {
    if (_user == null) {
      count = 0;
      notifyListeners();
      return;
    }
    try {
      final r = await api('/me/notifications/unread-count') as Map<String, dynamic>;
      count = (r['count'] as num).toInt();
      notifyListeners();
    } catch (_) {}
  }
}
