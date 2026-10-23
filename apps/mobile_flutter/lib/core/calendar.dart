import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'models.dart';

String _stamp(DateTime d) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}${two(d.month)}${two(d.day)}T${two(d.hour)}${two(d.minute)}${two(d.second)}';
}

String _escape(String s) => s.replaceAll('\\', r'\\').replaceAll(';', r'\;').replaceAll(',', r'\,').replaceAll('\n', r'\n');

/// An iCalendar event for one show time. Show times are stored as the park's wall-clock digits, so the event is written
/// as a floating (zone-less) time: it lands at the same clock time wherever the guest's phone is.
String sessionIcs(Session s, {String place = 'Kynren – The Storied Lands'}) {
  final start = DateTime.parse(s.revisedStart ?? s.startTime).toUtc();
  final end = DateTime.parse(s.endTime).toUtc();
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kynren//Park app//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:${s.id}@kynren.com',
    'DTSTAMP:${_stamp(DateTime.now().toUtc())}Z',
    'DTSTART:${_stamp(start)}',
    'DTEND:${_stamp(end)}',
    'SUMMARY:${_escape(s.attractionName)}',
    'LOCATION:${_escape(place)}',
    'DESCRIPTION:${_escape('${s.attractionName} at $place.')}',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:${_escape('${s.attractionName} starts in 15 minutes')}',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/// Hands a show time to the phone's calendar through the share sheet, as an event file the calendar app opens.
Future<void> addSessionToCalendar(Session s, {String place = 'Kynren – The Storied Lands'}) async {
  final ics = sessionIcs(s, place: place);
  final name = s.attractionName.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '-');
  if (kIsWeb) {
    await SharePlus.instance.share(ShareParams(text: ics, title: s.attractionName));
    return;
  }
  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/$name.ics');
  await file.writeAsString(ics);
  await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: 'text/calendar', name: '$name.ics')], title: s.attractionName));
}
