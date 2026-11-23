import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/app_update.dart';

class _Fake implements UpdateSource {
  _Fake({this.check_ = UpdateCheck.upToDate, this.outcome = UpdateOutcome.started, this.throwOnCheck = false});
  UpdateCheck check_;
  UpdateOutcome outcome;
  bool throwOnCheck;
  int checks = 0, installs = 0;

  @override
  Future<UpdateCheck> check() async {
    checks++;
    if (throwOnCheck) throw Exception('not installed from Google Play');
    return check_;
  }

  @override
  Future<UpdateOutcome> install() async {
    installs++;
    return outcome;
  }
}

void main() {
  test('starts idle and reports being up to date', () async {
    final u = AppUpdater(source: _Fake());
    expect(u.stage, UpdateStage.idle);
    await u.check();
    expect(u.stage, UpdateStage.upToDate);
  });

  test('shows checking while the store is being asked', () async {
    final u = AppUpdater(source: _Fake());
    final seen = <UpdateStage>[];
    u.addListener(() => seen.add(u.stage));
    await u.check();
    expect(seen, [UpdateStage.checking, UpdateStage.upToDate]);
  });

  test('a store that cannot be reached is "failed", not an exception', () async {
    final u = AppUpdater(source: _Fake(throwOnCheck: true));
    await u.check();
    expect(u.stage, UpdateStage.failed);
    // and the guest can try again
    expect(u.busy, isFalse);
  });

  test('a newer build can be installed, and the app stays "installing" until the store restarts it', () async {
    final src = _Fake(check_: UpdateCheck.available);
    final u = AppUpdater(source: src);
    await u.check();
    expect(u.stage, UpdateStage.available);
    await u.install();
    expect(src.installs, 1);
    expect(u.stage, UpdateStage.installing);
  });

  test('declining the store prompt is not an error', () async {
    final u = AppUpdater(source: _Fake(check_: UpdateCheck.available, outcome: UpdateOutcome.declined));
    await u.check();
    await u.install();
    expect(u.stage, UpdateStage.declined);
  });

  test('an update the store refuses to run in the app becomes "failed"', () async {
    final u = AppUpdater(source: _Fake(check_: UpdateCheck.available, outcome: UpdateOutcome.failed));
    await u.check();
    await u.install();
    expect(u.stage, UpdateStage.failed);
  });

  test('install does nothing unless an in-app update was found', () async {
    final src = _Fake(check_: UpdateCheck.availableInStore);
    final u = AppUpdater(source: src);
    await u.install();
    expect(src.installs, 0);
    await u.check();
    expect(u.stage, UpdateStage.availableInStore);
    await u.install();
    expect(src.installs, 0);
  });

  test('other devices are told where updates come from', () async {
    final u = AppUpdater(source: _Fake(check_: UpdateCheck.unsupported));
    await u.check();
    expect(u.stage, UpdateStage.unsupported);
  });

  test('a result that arrives after the screen is gone does not crash', () async {
    final u = AppUpdater(source: _Fake());
    final f = u.check();
    u.dispose();
    await f;
  });
}
