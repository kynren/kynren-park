import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'location.dart';

const _key = 'kynren_meeting_spot';

/// A place the guest has marked for their group to meet, kept on the device so it survives closing the app.
class MeetSpot {
  final double lat, lng;
  final DateTime savedAt;
  const MeetSpot(this.lat, this.lng, this.savedAt);

  Geo get geo => Geo(lat, lng);

  String toJson() => jsonEncode({'lat': lat, 'lng': lng, 'at': savedAt.millisecondsSinceEpoch});

  static MeetSpot? fromJson(String? raw) {
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return MeetSpot((j['lat'] as num).toDouble(), (j['lng'] as num).toDouble(), DateTime.fromMillisecondsSinceEpoch((j['at'] as num).toInt()));
    } catch (_) {
      return null; // an unreadable value is the same as no saved spot
    }
  }
}

/// A link that opens the spot in the maps app on any phone.
String meetLink(MeetSpot s) => 'https://www.google.com/maps/search/?api=1&query=${s.lat.toStringAsFixed(6)},${s.lng.toStringAsFixed(6)}';

/// The message sent to the group.
String meetText(MeetSpot s) => 'Meet me here at Kynren – The Storied Lands:\n${meetLink(s)}';

Future<MeetSpot?> loadMeetSpot() async {
  try {
    return MeetSpot.fromJson((await SharedPreferences.getInstance()).getString(_key));
  } catch (_) {
    return null;
  }
}

Future<void> saveMeetSpot(MeetSpot spot) async {
  try {
    await (await SharedPreferences.getInstance()).setString(_key, spot.toJson());
  } catch (_) {}
}

Future<void> clearMeetSpot() async {
  try {
    await (await SharedPreferences.getInstance()).remove(_key);
  } catch (_) {}
}
