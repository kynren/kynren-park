import 'package:intl/intl.dart';
import 'format.dart';

/// What to tell a guest whose phone is offline: the park they see is what was last saved, and when that was. Null when the
/// time of the last sync is not known, so nothing is claimed about how old it is.
String? offlineNote(DateTime? lastSynced, DateTime now) {
  if (lastSynced == null) return 'You’re offline. Showing the park as it was saved on your phone.';
  final sameDay = DateFormat('yyyy-MM-dd').format(lastSynced.toUtc()) == DateFormat('yyyy-MM-dd').format(now.toUtc());
  final when = sameDay ? 'at ${fmtTimeUK(lastSynced)}' : 'on ${DateFormat('d MMMM').format(lastSynced.toLocal())}';
  return 'You’re offline. Showing the park as it was saved $when.';
}
