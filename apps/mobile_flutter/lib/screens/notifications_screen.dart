import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/models.dart';
import '../core/notifications.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/controls.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';

class _Item {
  final String id;
  final DateTime at;
  final Json? announcement;
  final PersonalNotification? personal;
  _Item.announcement(this.id, this.at, this.announcement) : personal = null;
  _Item.personal(this.id, this.at, this.personal) : announcement = null;
}

/// Is the announcement live right now (sent and inside its active window)?
bool _isLive(Json a, DateTime now) {
  if (a['sentAt'] == null) return false;
  final start = a['startAt'] as String?, end = a['endAt'] as String?;
  if (start != null && DateTime.parse(start).isAfter(now)) return false;
  if (end != null && DateTime.parse(end).isBefore(now)) return false;
  return true;
}

IconData _typeIcon(String type) => switch (type) {
      'session' => Icons.calendar_month_rounded,
      'order' => Icons.restaurant_rounded,
      _ => Icons.notifications_rounded,
    };

String _when(String iso) => DateFormat('dd/MM/yyyy, HH:mm:ss').format(DateTime.parse(iso).toLocal());

/// A single feed merging park-wide announcements (public, from the offline bundle) with this guest's own
/// delay / order / reminder history (personal, sign-in required), sorted together by when each happened.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Json>? _announcements;
  List<PersonalNotification> _personal = [];
  final _tts = FlutterTts();
  String? _speakingId;
  String? _loadedFor;

  @override
  void initState() {
    super.initState();
    _tts.setCompletionHandler(() => mounted ? setState(() => _speakingId = null) : null);
    _tts.setCancelHandler(() => mounted ? setState(() => _speakingId = null) : null);
    _tts.setSpeechRate(0.5).catchError((_) => 0); // read-aloud is best effort: some phones have no speech engine
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tts.stop().catchError((_) => 0);
    super.dispose();
  }

  Future<void> _load() async {
    final date = context.read<SyncState>().date;
    final user = context.read<AuthState>().user;
    _loadedFor = user?.id;
    await Future.wait([
      api('/announcements?date=$date').then((a) {
        if (mounted) setState(() => _announcements = (a as List).cast<Json>());
      }).catchError((_) {}),
      if (user != null)
        api('/me/notifications').then((n) {
          if (mounted) setState(() => _personal = [for (final x in n as List) PersonalNotification.fromJson(x as Json)]);
        }).catchError((_) {}),
    ]);
    // Clear the bell badge once the guest has actually seen this screen.
    if (user != null && mounted) {
      await api('/me/notifications/read', method: 'POST').catchError((_) => null);
      if (mounted) context.read<UnreadNotifications>().refresh();
    }
  }

  Future<void> _toggleSpeak(String id, String text) async {
    try {
      if (_speakingId == id) {
        await _tts.stop();
        setState(() => _speakingId = null);
        return;
      }
      await _tts.stop();
      setState(() => _speakingId = id);
      await _tts.speak(text);
    } catch (_) {
      if (mounted) setState(() => _speakingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final bundle = context.watch<SyncState>().bundle;
    final user = context.watch<AuthState>().user;
    if (user?.id != _loadedFor && _loadedFor != null) WidgetsBinding.instance.addPostFrameCallback((_) => _load());

    // Seeded from the offline bundle so there is always something to show offline.
    final announcements = _announcements ??
        [
          for (final a in bundle?.announcements ?? <Announcement>[]) {'id': a.id, 'title': a.title, 'body': a.body, 'createdAt': a.createdAt, 'sentAt': a.createdAt},
        ];
    final now = DateTime.now();
    final items = [
      for (final a in announcements) _Item.announcement('a:${a['id']}', DateTime.parse((a['sentAt'] ?? a['createdAt']) as String), a),
      for (final n in _personal) _Item.personal('n:${n.id}', DateTime.parse(n.createdAt), n),
    ]..sort((x, y) => y.at.compareTo(x.at));

    Widget head(IconData icon, String title, {bool live = false}) => Row(children: [
          Container(width: 34, height: 34, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(icon, color: c.link, size: 18)),
          const SizedBox(width: 10),
          Expanded(child: Text(title, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15.5, color: c.text))),
          if (live)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(color: c.accent, borderRadius: BorderRadius.circular(999)),
              child: const Text('LIVE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 10, letterSpacing: 0.6)),
            ),
        ]);

    return KScreen(
      title: 'Notifications',
      subtitle: 'Park announcements and your reminders',
      page: 'notifications',
      onRefresh: _load,
      children: [
        if (items.isEmpty) Text('No notifications yet. Park announcements and your show reminders will appear here.', style: TextStyle(fontSize: 14, height: 20 / 14, color: c.sub)),
        for (final item in items)
          if (item.personal != null)
            KCard(
              onTap: item.personal!.deepLink != null ? () => context.push(item.personal!.deepLink!) : null,
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                head(_typeIcon(item.personal!.type), item.personal!.title),
                Padding(padding: const EdgeInsets.only(top: 8), child: Text(_when(item.personal!.createdAt), style: TextStyle(fontSize: 12, color: c.sub))),
                Padding(padding: const EdgeInsets.only(top: 6), child: Text(item.personal!.body, style: TextStyle(height: 21 / 14.5, fontSize: 14.5, color: c.text))),
              ]),
            )
          else
            () {
              final a = item.announcement!;
              final id = a['id'] as String;
              final speaking = _speakingId == id;
              return KCard(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  head(Icons.notifications_rounded, a['title'] as String, live: _isLive(a, now)),
                  Padding(padding: const EdgeInsets.only(top: 8), child: Text(_when((a['sentAt'] ?? a['createdAt']) as String), style: TextStyle(fontSize: 12, color: c.sub))),
                  Padding(padding: const EdgeInsets.only(top: 6), child: Text(a['body'] as String? ?? '', style: TextStyle(height: 21 / 14.5, fontSize: 14.5, color: c.text))),
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Tap(
                        onTap: () => _toggleSpeak(id, '${a['title']}. ${a['body']}'),
                        label: speaking ? 'Stop reading aloud' : 'Listen to this announcement',
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
                          decoration: BoxDecoration(color: speaking ? c.primary : c.tint, borderRadius: BorderRadius.circular(999)),
                          child: Text(speaking ? '■ Stop' : '🔊 Listen', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: speaking ? Colors.white : c.link)),
                        ),
                      ),
                    ),
                  ),
                ]),
              );
            }(),
      ],
    );
  }
}
