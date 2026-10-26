import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

const _key = 'kynren_parked_car';

/// Where the guest left the car: saved on the device so it survives closing the app.
class ParkedSpot {
  final double lat, lng;
  final DateTime savedAt;
  const ParkedSpot(this.lat, this.lng, this.savedAt);

  String toJson() => jsonEncode({'lat': lat, 'lng': lng, 'at': savedAt.millisecondsSinceEpoch});

  static ParkedSpot? fromJson(String? raw) {
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return ParkedSpot((j['lat'] as num).toDouble(), (j['lng'] as num).toDouble(), DateTime.fromMillisecondsSinceEpoch((j['at'] as num).toInt()));
    } catch (_) {
      return null; // an unreadable value is the same as no saved spot
    }
  }
}

Future<ParkedSpot?> loadParkedSpot() async {
  try {
    return ParkedSpot.fromJson((await SharedPreferences.getInstance()).getString(_key));
  } catch (_) {
    return null;
  }
}

Future<void> saveParkedSpot(ParkedSpot spot) async {
  try {
    await (await SharedPreferences.getInstance()).setString(_key, spot.toJson());
  } catch (_) {}
}

Future<void> clearParkedSpot() async {
  try {
    await (await SharedPreferences.getInstance()).remove(_key);
  } catch (_) {}
}
