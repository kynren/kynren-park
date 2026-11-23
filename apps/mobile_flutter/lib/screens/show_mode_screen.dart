import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/format.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../ui/tap.dart';

const _bg = Color(0xFF06090F);
const _card = Color(0xFF111827);
const _ink = Color(0xFFF1F3F8);
const _soft = Color(0xFF9AA3B8);
const _gold = Color(0xFFD6B86A);

/// A dark, low-glare screen to keep open during a show: when it starts, the story read aloud, and bigger text. Nothing
/// here is live: it shows only what the park has published for the show, so there are no live captions or translation.
class ShowModeScreen extends StatefulWidget {
  final String slug;
  const ShowModeScreen({super.key, required this.slug});
  @override
  State<ShowModeScreen> createState() => _ShowModeScreenState();
}

class _ShowModeScreenState extends State<ShowModeScreen> {
  final _tts = FlutterTts();
  bool _speaking = false, _large = false;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tts.setCompletionHandler(() => mounted ? setState(() => _speaking = false) : null);
    _tts.setCancelHandler(() => mounted ? setState(() => _speaking = false) : null);
    _tts.setSpeechRate(0.5).catchError((_) => 0); // read-aloud is best effort: some phones have no speech engine
    _tick = Timer.periodic(const Duration(seconds: 30), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    _tts.stop().catchError((_) => 0);
    super.dispose();
  }

  Future<void> _readAloud(String text) async {
    if (_speaking) {
      await _tts.stop();
      if (mounted) setState(() => _speaking = false);
      return;
    }
    setState(() => _speaking = true);
    try {
      await _tts.speak(text);
    } catch (_) {
      if (mounted) setState(() => _speaking = false);
    }
  }

  static String _startsIn(DateTime start, DateTime now) {
    final m = start.difference(now).inMinutes;
    if (m <= 0) return 'On now';
    if (m < 60) return 'Starts in $m min';
    return 'Starts in ${m ~/ 60} h ${(m % 60).toString().padLeft(2, '0')} min';
  }

  @override
  Widget build(BuildContext context) {
    final bundle = context.watch<SyncState>().bundle;
    final a = bundle?.attractions.where((x) => x.slug == widget.slug).firstOrNull;
    final scale = _large ? 1.3 : 1.0;
    final now = ukNow();
    final next = a == null
        ? null
        : (bundle!.sessions.where((s) => s.attractionSlug == widget.slug && s.status != 'CANCELLED' && DateTime.parse(s.endTime).isAfter(now)).toList()
          ..sort((x, y) => DateTime.parse(x.revisedStart ?? x.startTime).compareTo(DateTime.parse(y.revisedStart ?? y.startTime))))
            .firstOrNull;
    final story = a == null ? '' : [if ((a.tagline ?? '').isNotEmpty) a.tagline!, a.synopsis].where((t) => t.isNotEmpty).join('. ');

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bg,
        body: SafeArea(
          child: MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
              children: [
                Row(children: [
                  Tap(
                    onTap: () => context.canPop() ? context.pop() : context.go('/'),
                    label: 'Close show mode',
                    child: Container(width: 42, height: 42, decoration: const BoxDecoration(color: _card, shape: BoxShape.circle), child: const Icon(Icons.close_rounded, color: _ink, size: 22)),
                  ),
                  const Spacer(),
                  Tap(
                    onTap: () => setState(() => _large = !_large),
                    label: _large ? 'Use normal text' : 'Use large text',
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(color: _large ? Tokens.brand : _card, borderRadius: BorderRadius.circular(999)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.text_increase_rounded, color: _ink, size: 18),
                        const SizedBox(width: 6),
                        Text('Large text', style: TextStyle(color: _ink, fontWeight: FontWeight.w700, fontSize: 13 / scale)),
                      ]),
                    ),
                  ),
                ]),
                const SizedBox(height: 22),
                if (a == null)
                  Text(bundle == null ? 'Loading…' : 'Show not found.', style: const TextStyle(color: _soft, fontSize: 16))
                else ...[
                  const Text('SHOW MODE', style: TextStyle(color: _gold, fontSize: 11.5, fontWeight: FontWeight.w800, letterSpacing: 2.2)),
                  const SizedBox(height: 8),
                  Text(a.name, style: const TextStyle(fontFamily: Tokens.display, color: _ink, fontSize: 30, height: 1.1, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 14),
                  if (next != null)
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(18)),
                      child: Row(children: [
                        const Icon(Icons.schedule_rounded, color: _gold, size: 22),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(_startsIn(DateTime.parse(next.revisedStart ?? next.startTime), now), style: const TextStyle(color: _ink, fontSize: 18, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 2),
                            Text('${fmtTime(next.revisedStart ?? next.startTime)} to ${fmtTime(next.endTime)}', style: const TextStyle(color: _soft, fontSize: 13.5)),
                          ]),
                        ),
                      ]),
                    )
                  else
                    const Text('No more performances today.', style: TextStyle(color: _soft, fontSize: 14)),
                  const SizedBox(height: 14),
                  if (story.isNotEmpty) ...[
                    Tap(
                      onTap: () => _readAloud(story),
                      label: _speaking ? 'Stop reading' : 'Read the story aloud',
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(color: Tokens.brand, borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Icon(_speaking ? Icons.stop_rounded : Icons.volume_up_rounded, color: Colors.white, size: 20),
                          const SizedBox(width: 8),
                          Text(_speaking ? 'Stop reading' : 'Read the story aloud', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(18)),
                      child: Text(story, style: const TextStyle(color: _ink, fontSize: 16, height: 1.5)),
                    ),
                  ],
                  if (a.sensoryNotes != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(18)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('GOOD TO KNOW', style: TextStyle(color: _gold, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.6)),
                        const SizedBox(height: 6),
                        Text(a.sensoryNotes!, style: const TextStyle(color: _ink, fontSize: 14.5, height: 1.45)),
                      ]),
                    ),
                  ],
                  const SizedBox(height: 20),
                  const Text('Turn your brightness down so the screen does not spoil the view for the people around you.', style: TextStyle(color: _soft, fontSize: 12.5, height: 1.45), textAlign: TextAlign.center),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
