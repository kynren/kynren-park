import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';
import 'auth.dart';
import 'safe_notify.dart';

const _key = 'kynren_prefs';

enum HomeView { cards, list }

/// The lists on Home that each have their own cards-or-list choice.
enum HomeList { comingUp, favourites }

const _prefKey = {HomeList.comingUp: 'homeViewComingUp', HomeList.favourites: 'homeViewFavourites'};

HomeView? _view(Object? v) => v == 'cards' ? HomeView.cards : (v == 'list' ? HomeView.list : null);

Future<Map<String, dynamic>> _readPhone() async {
  try {
    final raw = (await SharedPreferences.getInstance()).getString(_key);
    return raw == null ? {} : jsonDecode(raw) as Map<String, dynamic>;
  } catch (_) {
    return {};
  }
}

Future<void> _writePhone(Map<String, dynamic> p) async => (await SharedPreferences.getInstance()).setString(_key, jsonEncode(p));

/// Read each list's choice from a stored set of preferences. An older single `homeView` choice applies to both lists.
Map<HomeList, HomeView> _viewsFrom(Map<String, dynamic>? p) {
  final out = <HomeList, HomeView>{};
  if (p == null) return out;
  for (final list in HomeList.values) {
    final v = _view(p[_prefKey[list]]) ?? _view(p['homeView']);
    if (v != null) out[list] = v;
  }
  return out;
}

Map<String, dynamic> _flat(Map<HomeList, HomeView> v) => {for (final e in v.entries) _prefKey[e.key]!: e.value.name};

/// How Home shows "Coming up" and "Your favourites": each as picture cards or as a list, chosen
/// separately. The choices are always kept on the phone, and also on the profile once the guest has
/// an account, so they follow them to a new phone. Choices made before signing in are carried over.
class PreferencesState extends ChangeNotifier with SafeNotify {
  // A list is what guests see until they choose otherwise.
  final Map<HomeList, HomeView> views = {HomeList.comingUp: HomeView.list, HomeList.favourites: HomeView.list};
  String? _syncedFor;
  AuthUser? _user;

  Future<void> load() async {
    views.addAll(_viewsFrom(await _readPhone()));
    notifyListeners();
  }

  Future<void> syncWith(AuthUser? user) async {
    _user = user;
    if (user == null || user.id == _syncedFor) return;
    _syncedFor = user.id;
    try {
      final me = await api('/me') as Map<String, dynamic>;
      final saved = _viewsFrom(me['preferences'] as Map<String, dynamic>?);
      if (saved.isNotEmpty) {
        views.addAll(saved);
        notifyListeners();
        await _writePhone({...await _readPhone(), ..._flat(saved)});
      } else {
        final phone = _viewsFrom(await _readPhone());
        if (phone.isNotEmpty) await api('/me/preferences', method: 'PATCH', body: _flat(phone)).catchError((_) => null);
      }
    } catch (_) {}
  }

  void setView(HomeList list, HomeView view) {
    views[list] = view;
    notifyListeners();
    _readPhone().then((phone) => _writePhone({...phone, _prefKey[list]!: view.name}));
    if (_user != null) api('/me/preferences', method: 'PATCH', body: {_prefKey[list]!: view.name}).catchError((_) => null);
  }
}
