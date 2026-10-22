import 'package:flutter/foundation.dart';

/// A [ChangeNotifier] that ignores a late notification (a network reply, a socket event) arriving after it was disposed,
/// instead of throwing on it.
mixin SafeNotify on ChangeNotifier {
  bool _disposed = false;

  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
