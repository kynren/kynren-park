import 'dart:async';
import 'package:flutter/widgets.dart';
import '../core/format.dart';

/// The park's time of day in minutes after midnight, for judging "open now".
int nowMinute() {
  final n = ukNow();
  return n.hour * 60 + n.minute;
}

/// Re-reads the clock once a minute so "Open now" and "Closing soon" stay true while the screen is open.
mixin MinuteTick<T extends StatefulWidget> on State<T> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
