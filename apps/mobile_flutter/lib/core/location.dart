import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api.dart';
import 'auth.dart';
import 'safe_notify.dart';

class Geo {
  final double lat, lng;
  const Geo(this.lat, this.lng);
}

enum LocationPermissionState { unknown, granted, denied }

/// Great-circle distance in metres, so proximity reflects real distance and not map pixels.
double distMeters(Geo a, Geo b) {
  const r = 6371000.0;
  double rad(double d) => d * math.pi / 180;
  final dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  final h = math.pow(math.sin(dLat / 2), 2) + math.cos(rad(a.lat)) * math.cos(rad(b.lat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * r * math.asin(math.sqrt(h));
}

/// Starts locating the guest as soon as the app boots, so the map already has a fix by the time it opens and the
/// "you are here" beacon appears at once. Strategy: ask permission, use the instant last-known position, refine with an
/// accurate fix, then keep it fresh with a light watcher. Presence is reported once for signed-in guests.
class LocationState extends ChangeNotifier with SafeNotify {
  Geo? gps;
  bool ready = false;
  LocationPermissionState permission = LocationPermissionState.unknown;
  StreamSubscription<Position>? _sub;
  bool _reported = false;
  AuthUser? _user;

  Future<void> start() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        permission = LocationPermissionState.denied;
        ready = true;
        notifyListeners();
        return;
      }
      permission = LocationPermissionState.granted;

      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) _set(last);
      } catch (_) {/* not available on every platform */}
      try {
        _set(await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium)));
      } catch (_) {}
      ready = true;
      notifyListeners();

      _sub = Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium, distanceFilter: 20)).listen(_set, onError: (_) {});
    } catch (_) {
      ready = true;
      notifyListeners();
    }
  }

  /// Turn location on from a button: ask for permission, or, when it has been refused for good or the phone's location
  /// switch is off, take the guest to the setting that fixes it.
  Future<void> enable() async {
    try {
      if (await Geolocator.checkPermission() == LocationPermission.deniedForever) {
        await Geolocator.openAppSettings();
        return;
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        await Geolocator.openLocationSettings();
        return;
      }
    } catch (_) {/* not available on every platform: asking below still works */}
    await start();
  }

  void _set(Position p) {
    gps = Geo(p.latitude, p.longitude);
    notifyListeners();
    _report();
  }

  void syncWith(AuthUser? user) {
    _user = user;
    _report();
  }

  void _report() {
    if (_reported || gps == null || _user == null) return;
    _reported = true;
    api('/me/presence', method: 'POST', body: {'lat': gps!.lat, 'lng': gps!.lng}).catchError((_) => null);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}
