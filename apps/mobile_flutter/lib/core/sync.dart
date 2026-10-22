import 'dart:async';
import 'dart:convert';
import 'dart:io' show File;
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api.dart';
import 'format.dart';
import 'models.dart';
import 'safe_notify.dart';

String _bundleKey(String date) => 'kynren_bundle_$date';
String _etagKey(String date) => 'kynren_etag_$date';
// Live schedule patches, kept apart from the bundle: the bundle carries the park's pictures inline and is many megabytes,
// far too big to rewrite on every show update.
String _sessionsKey(String date) => 'kynren_sessions_$date';

Json _decodeJson(String text) => jsonDecode(text) as Json;

/// The cached bundle lives in a file on a phone (it holds the pictures inline, and is too big for preferences) and in
/// preferences on the web, which has no files.
Future<File?> _bundleFile(String date) async {
  if (kIsWeb) return null;
  final dir = await getApplicationSupportDirectory();
  return File('${dir.path}/${_bundleKey(date)}.json');
}

Future<String?> _readBundle(String date) async {
  final f = await _bundleFile(date);
  if (f == null) return (await SharedPreferences.getInstance()).getString(_bundleKey(date));
  return await f.exists() ? f.readAsString() : null;
}

Future<void> _writeBundle(String date, String body) async {
  final f = await _bundleFile(date);
  if (f == null) {
    await (await SharedPreferences.getInstance()).setString(_bundleKey(date), body);
  } else {
    await f.writeAsString(body, flush: true);
  }
}

/// Cache-first park data: the stored bundle shows instantly (it works fully offline), then
/// quietly reconciles through an ETag/304 refresh and live socket patches.
///
/// Deliberately no refetch on returning to the foreground: a blocking reload every time the
/// app resumes is the most-complained-about thing in Disneyland Paris's own app reviews.
class SyncState extends ChangeNotifier with SafeNotify {
  Bundle? bundle;
  DateTime? lastSynced;
  bool online = true;
  bool loading = true;
  String date = ukTodayStr();

  Json? _raw;
  io.Socket? _socket;
  Timer? _dayTimer;

  Future<void> start() async {
    await _loadCache();
    _connectSocket();
    // Roll over to today at UK midnight if the app is left running.
    _dayTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      final today = ukTodayStr();
      if (today != date) setDate(today);
    });
    unawaited(refresh());
  }

  Future<void> _loadCache() async {
    final p = await SharedPreferences.getInstance();
    final cached = await _readBundle(date);
    if (cached != null) {
      try {
        _raw = await compute(_decodeJson, cached); // off the UI thread: the bundle can be many megabytes
        final patched = p.getString(_sessionsKey(date));
        if (patched != null) _raw!['sessions'] = jsonDecode(patched);
        bundle = Bundle.fromJson(_raw!);
        final at = p.getString('${_bundleKey(date)}_at');
        if (at != null) lastSynced = DateTime.tryParse(at);
      } catch (_) {
        // A cache from an older shape: ignore it and fetch fresh.
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> setDate(String d) async {
    date = d;
    _raw = null;
    bundle = null;
    loading = true;
    notifyListeners();
    await _loadCache();
    if (_socket?.connected == true) _socket!.emit('join', {'date': date});
    unawaited(refresh());
  }

  /// Network refresh with an ETag, so an unchanged bundle is a cheap 304.
  Future<void> refresh() async {
    try {
      final p = await SharedPreferences.getInstance();
      final etag = p.getString(_etagKey(date));
      final res = await http.get(
        Uri.parse('$apiUrl/api/sync/bundle?date=$date'),
        headers: {'If-None-Match': ?etag},
      );
      online = true;
      if (res.statusCode == 304) {
        lastSynced = DateTime.now();
        notifyListeners();
        return;
      }
      if (res.statusCode != 200) {
        notifyListeners();
        return;
      }
      _raw = await compute(_decodeJson, res.body);
      bundle = Bundle.fromJson(_raw!);
      lastSynced = DateTime.now();
      await _writeBundle(date, res.body);
      await p.remove(_sessionsKey(date)); // the fresh bundle already has the latest schedule
      await p.setString('${_bundleKey(date)}_at', lastSynced!.toIso8601String());
      final newEtag = res.headers['etag'];
      if (newEtag != null) await p.setString(_etagKey(date), newEtag);
    } catch (e) {
      // Offline: keep serving the cached bundle.
      online = false;
      if (kDebugMode) debugPrint('sync refresh failed: $e');
    }
    notifyListeners();
  }

  // Connects once (not keyed on the date): a reconnect briefly flips `online` and can drop an
  // in-flight event. The current date is re-joined whenever it changes.
  void _connectSocket() {
    final socket = io.io(apiUrl, io.OptionBuilder().setTransports(['websocket']).build());
    _socket = socket;
    socket.onConnect((_) {
      online = true;
      socket.emit('join', {'date': date});
      _notifyLater();
    });
    socket.onDisconnect((_) {
      online = false;
      _notifyLater();
    });
    socket.on('session.updated', (data) => _applySessionUpdate(data as Map));
  }

  /// Socket callbacks can land while the widget tree is being torn down, when listeners must not be told yet.
  void _notifyLater() => scheduleMicrotask(notifyListeners);

  void _applySessionUpdate(Map e) {
    final b = bundle;
    if (b == null) return;
    final next = [
      for (final s in b.sessions)
        s.id == e['id']
            ? s.patched(status: e['status'] as String, revisedStart: e['revisedStart'] as String?, note: e['note'] as String?)
            : s,
    ];
    bundle = b.withSessions(next);
    if (_raw != null) {
      _raw!['sessions'] = next.map((s) => s.toJson()).toList();
      SharedPreferences.getInstance().then((p) => p.setString(_sessionsKey(date), jsonEncode(_raw!['sessions'])));
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _dayTimer?.cancel();
    _socket?.dispose();
    super.dispose();
  }
}
