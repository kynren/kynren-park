import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

const _key = 'kynren_my_day';

/// The show times a guest picked for [date], kept on the device. Picks for any other day read as none.
Future<Set<String>> loadMyDay(String date) async {
  try {
    final raw = (await SharedPreferences.getInstance()).getString(_key);
    if (raw == null) return {};
    final j = jsonDecode(raw) as Map<String, dynamic>;
    if (j['date'] != date) return {};
    return {...(j['ids'] as List).cast<String>()};
  } catch (_) {
    return {}; // an unreadable value is the same as no picks
  }
}

Future<void> saveMyDay(String date, Set<String> ids) async {
  try {
    final p = await SharedPreferences.getInstance();
    if (ids.isEmpty) {
      await p.remove(_key);
    } else {
      await p.setString(_key, jsonEncode({'date': date, 'ids': ids.toList()}));
    }
  } catch (_) {}
}
