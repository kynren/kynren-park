import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/shuttle_logic.dart';

void main() {
  test('minutesOfDay reads HH:mm and rejects anything else', () {
    expect(minutesOfDay('09:30'), 570);
    expect(minutesOfDay(' 9:05 '), 545);
    expect(minutesOfDay('24:00'), isNull);
    expect(minutesOfDay('noon'), isNull);
  });

  test('nextDeparture picks the soonest time at or after now, in any order', () {
    final n = nextDeparture(['17:00', '09:00', '13:30'], DateTime(2026, 11, 18, 12, 0));
    expect(n!.time, '13:30');
    expect(n.minutes, 90);
    expect(n.tomorrow, isFalse);
  });

  test('a bus leaving this minute is "now"', () {
    expect(nextDeparture(['12:00'], DateTime(2026, 11, 18, 12, 0))!.minutes, 0);
  });

  test('after the last bus, the next is tomorrow morning', () {
    final n = nextDeparture(['09:00', '17:00'], DateTime(2026, 11, 18, 22, 0));
    expect(n!.time, '09:00');
    expect(n.tomorrow, isTrue);
    expect(n.minutes, 11 * 60);
  });

  test('no readable times gives nothing', () {
    expect(nextDeparture([], DateTime(2026, 11, 18)), isNull);
    expect(nextDeparture(['soon'], DateTime(2026, 11, 18)), isNull);
  });

  test('untilText', () {
    expect(untilText(0), 'now');
    expect(untilText(12), 'in 12 min');
    expect(untilText(60), 'in 1 h');
    expect(untilText(65), 'in 1 h 5 min');
  });
}
