import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/calendar.dart';
import 'package:storiedlands/core/models.dart';

Session _session({String start = '2026-10-23T10:30:00.000Z', String? revised}) => Session(
      id: 's1',
      attractionId: 'a1',
      startTime: start,
      endTime: '2026-10-23T10:55:00.000Z',
      status: 'SCHEDULED',
      revisedStart: revised,
      note: null,
      attractionName: 'Land of the Vikings, live',
      attractionSlug: 'vikings',
      attractionCategory: 'VIKINGS',
    );

void main() {
  test('a show time becomes a calendar event at the park clock time, with a reminder', () {
    final ics = sessionIcs(_session());
    expect(ics, contains('BEGIN:VEVENT'));
    expect(ics, contains('DTSTART:20261023T103000\r\n'), reason: 'floating wall-clock time, no Z');
    expect(ics, contains('DTEND:20261023T105500\r\n'));
    expect(ics, contains(r'SUMMARY:Land of the Vikings\, live'), reason: 'commas are escaped');
    expect(ics, contains('TRIGGER:-PT15M'));
    expect(ics.endsWith('END:VCALENDAR\r\n'), isTrue);
  });

  test('a delayed show uses its revised start', () {
    final ics = sessionIcs(_session(revised: '2026-10-23T10:45:00.000Z'));
    expect(ics, contains('DTSTART:20261023T104500\r\n'));
  });

  test('several show times become one calendar file with an event and a reminder each', () {
    final ics = sessionsIcs([_session(), _session(start: '2026-10-23T14:00:00.000Z')]);
    expect('BEGIN:VEVENT'.allMatches(ics).length, 2);
    expect('TRIGGER:-PT15M'.allMatches(ics).length, 2);
    expect('BEGIN:VCALENDAR'.allMatches(ics).length, 1);
    expect(ics, contains('DTSTART:20261023T140000\r\n'));
    expect(ics.endsWith('END:VCALENDAR\r\n'), isTrue);
  });
}
