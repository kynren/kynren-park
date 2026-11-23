import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'safe_notify.dart';

const _key = 'kynren_theme_pref';

/// The guest's light / dark / system choice. The light theme (white cards on a navy header) is what the app is designed around, so it is the default; the night theme is a choice in Settings.
class ThemePref extends ChangeNotifier with SafeNotify {
  ThemeMode mode = ThemeMode.light;

  Future<void> load() async {
    final v = (await SharedPreferences.getInstance()).getString(_key);
    final found = ThemeMode.values.where((m) => m.name == v);
    if (found.isNotEmpty) {
      mode = found.first;
      notifyListeners();
    }
  }

  void set(ThemeMode m) {
    mode = m;
    notifyListeners();
    SharedPreferences.getInstance().then((p) => p.setString(_key, m.name));
  }
}
