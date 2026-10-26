import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/models.dart';
import 'package:storiedlands/core/parking.dart';
import 'package:storiedlands/core/programme_logic.dart';

// Show times are the park's wall-clock digits wearing a UTC label, and "now" is built the same way.
Session session(String id, String start, String end, {String status = 'SCHEDULED', String? revised, String attraction = 'a1'}) => Session(
      id: id,
      attractionId: attraction,
      startTime: '2026-10-26T$start:00.000Z',
      endTime: '2026-10-26T$end:00.000Z',
      status: status,
      revisedStart: revised == null ? null : '2026-10-26T$revised:00.000Z',
      note: null,
      attractionName: 'Show $attraction',
      attractionSlug: attraction,
      attractionCategory: 'DAY',
    );

DateTime at(String hhmm) => DateTime.parse('2026-10-26T$hhmm:00.000Z');

void main() {
  group('runLine', () {
    final day = [session('s1', '10:00', '10:30'), session('s2', '12:00', '12:30'), session('s3', '15:00', '15:30')];

    test('a show that is playing is live, with its end time', () {
      final l = runLine(day, at('12:10'))!;
      expect(l.live, isTrue);
      expect(l.session.id, 's2');
      expect(l.text, 'On now · until 12:30');
    });

    test('a show within the hour is "soon", counted in minutes', () {
      final l = runLine(day, at('11:20'))!;
      expect(l.live, isFalse);
      expect(l.soon, isTrue);
      expect(l.text, 'Starts in 40 min');
    });

    test('a show further off just gives its time', () {
      final l = runLine(day, at('12:45'))!;
      expect(l.soon, isFalse);
      expect(l.text, 'Next at 15:00');
    });

    test('nothing left once the last show has finished', () {
      expect(runLine(day, at('16:00')), isNull);
    });

    test('a delayed start moves the show; a cancelled one is skipped', () {
      final delayed = [session('d', '12:00', '12:30', revised: '12:20')];
      expect(runLine(delayed, at('12:10'))!.text, 'Starts in 10 min');
      final cancelled = [session('c', '12:00', '12:30', status: 'CANCELLED'), session('n', '14:00', '14:30')];
      expect(runLine(cancelled, at('12:10'))!.session.id, 'n');
    });
  });

  test('nextUp prefers a show that is on, then the earliest start', () {
    final lines = {
      'soonish': runLine([session('a', '11:40', '12:00', attraction: 'soonish')], at('11:00')),
      'live': runLine([session('b', '10:30', '11:30', attraction: 'live')], at('11:00')),
      'later': runLine([session('c', '14:00', '15:00', attraction: 'later')], at('11:00')),
      'none': null,
    };
    expect(nextUp(lines)!.attractionId, 'live');
    lines.remove('live');
    expect(nextUp(lines)!.attractionId, 'soonish');
    expect(nextUp({'none': null}), isNull);
  });

  group('ParkedSpot', () {
    test('survives being saved and read back', () {
      final spot = ParkedSpot(54.6761, -1.6812, DateTime.fromMillisecondsSinceEpoch(1790000000000));
      final back = ParkedSpot.fromJson(spot.toJson())!;
      expect(back.lat, 54.6761);
      expect(back.lng, -1.6812);
      expect(back.savedAt, spot.savedAt);
    });

    test('garbage reads as no saved spot', () {
      expect(ParkedSpot.fromJson(null), isNull);
      expect(ParkedSpot.fromJson('not json'), isNull);
      expect(ParkedSpot.fromJson('{"lat":"x"}'), isNull);
    });
  });
}
