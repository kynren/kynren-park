import 'package:flutter/foundation.dart';
import 'api.dart';
import 'auth.dart';
import 'safe_notify.dart';

/// The signed-in guest's favourited attraction ids, server-backed via `/me/favorites`.
/// Shared by the map's Favourites filter, Profile → My favourites and Home's "Your favourites".
class FavoritesState extends ChangeNotifier with SafeNotify {
  Set<String> ids = {};
  String? _loadedFor;

  /// Reload when the signed-in guest changes.
  Future<void> syncWith(AuthUser? user) async {
    if (user?.id == _loadedFor) return;
    _loadedFor = user?.id;
    if (user == null) {
      ids = {};
      notifyListeners();
      return;
    }
    try {
      final list = await api('/me/favorites') as List;
      ids = {for (final f in list) (f as Map)['attractionId'] as String};
    } catch (_) {
      ids = {};
    }
    notifyListeners();
  }

  Future<void> toggle(String attractionId) async {
    final on = ids.contains(attractionId);
    ids = on ? (ids.difference({attractionId})) : {...ids, attractionId};
    notifyListeners();
    try {
      // The endpoint toggles: one POST either adds or removes.
      await api('/me/favorites', method: 'POST', body: {'attractionId': attractionId});
    } catch (_) {
      ids = on ? {...ids, attractionId} : ids.difference({attractionId});
      notifyListeners();
    }
  }
}
