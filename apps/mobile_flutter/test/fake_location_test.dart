import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/location.dart';

void main() {
  test('a real fix is used', () {
    final s = LocationState();
    s.accept(54.67, -1.68, mocked: false);
    expect(s.gps, isNotNull);
    expect(s.gps!.lat, 54.67);
    expect(s.fakeLocation, isFalse);
  });

  test('a mock-location fix is refused, and the last real one is dropped with it', () {
    final s = LocationState();
    s.accept(54.67, -1.68, mocked: false);
    s.accept(54.6715, -1.679, mocked: true);
    expect(s.gps, isNull);
    expect(s.fakeLocation, isTrue);
  });

  test('switching the fake off and getting a real fix brings the location back', () {
    final s = LocationState();
    s.accept(54.6715, -1.679, mocked: true);
    s.accept(54.68, -1.69, mocked: false);
    expect(s.fakeLocation, isFalse);
    expect(s.gps!.lng, -1.69);
  });
}
