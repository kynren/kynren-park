import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'safe_notify.dart';

const _key = 'kynren_saved_dishes';

/// The dishes a guest has saved to find again, kept on the device. A dish is remembered by its menu item id.
class SavedDishes extends ChangeNotifier with SafeNotify {
  Set<String> ids = {};

  Future<void> load() async {
    try {
      final raw = (await SharedPreferences.getInstance()).getString(_key);
      if (raw != null) ids = {...(jsonDecode(raw) as List).cast<String>()};
      notifyListeners();
    } catch (_) {}
  }

  void toggle(String id) {
    ids = ids.contains(id) ? ids.difference({id}) : {...ids, id};
    notifyListeners();
    SharedPreferences.getInstance().then((p) => p.setString(_key, jsonEncode(ids.toList())));
  }
}
