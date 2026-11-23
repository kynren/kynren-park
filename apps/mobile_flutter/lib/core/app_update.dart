import 'package:flutter/foundation.dart';
import 'package:in_app_update/in_app_update.dart';

/// "Check for updates" in Settings: asks Google Play whether a newer build of this app is out, and starts the update.
///
/// Play is the source of truth (nothing here has to be kept in step with a release by hand). The check only works for an
/// app installed through Google Play, including the internal and closed test tracks; a build installed any other way
/// gets "failed", which offers the Play listing instead. iPhones have no such check, so they are told where updates come from.

/// What the store said when asked.
enum UpdateCheck {
  /// This is the newest build the store knows of.
  upToDate,

  /// A newer build exists and can be installed from inside the app.
  available,

  /// A newer build exists but can only be installed from the store page.
  availableInStore,

  /// This device has no in-app check (not Android).
  unsupported,
}

/// What happened when the guest asked to install.
enum UpdateOutcome { started, declined, failed }

abstract class UpdateSource {
  Future<UpdateCheck> check();
  Future<UpdateOutcome> install();
}

/// Google Play's in-app update, through the `in_app_update` plugin.
class PlayUpdateSource implements UpdateSource {
  bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  @override
  Future<UpdateCheck> check() async {
    if (!_android) return UpdateCheck.unsupported;
    final info = await InAppUpdate.checkForUpdate();
    if (info.updateAvailability != UpdateAvailability.updateAvailable) return UpdateCheck.upToDate;
    return info.immediateUpdateAllowed ? UpdateCheck.available : UpdateCheck.availableInStore;
  }

  @override
  Future<UpdateOutcome> install() async {
    // Play shows its own full-screen update page and restarts the app when it has installed.
    final r = await InAppUpdate.performImmediateUpdate();
    return switch (r) {
      AppUpdateResult.success => UpdateOutcome.started,
      AppUpdateResult.userDeniedUpdate => UpdateOutcome.declined,
      AppUpdateResult.inAppUpdateFailed => UpdateOutcome.failed,
    };
  }
}

enum UpdateStage { idle, checking, upToDate, available, availableInStore, installing, declined, unsupported, failed }

class AppUpdater extends ChangeNotifier {
  AppUpdater({UpdateSource? source}) : _source = source ?? PlayUpdateSource();
  final UpdateSource _source;

  UpdateStage stage = UpdateStage.idle;
  bool get busy => stage == UpdateStage.checking || stage == UpdateStage.installing;

  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _to(UpdateStage s) {
    if (_disposed) return;
    stage = s;
    notifyListeners();
  }

  /// Ask the store. Never throws: any trouble reaching it becomes [UpdateStage.failed].
  Future<void> check() async {
    if (busy) return;
    _to(UpdateStage.checking);
    try {
      _to(switch (await _source.check()) {
        UpdateCheck.upToDate => UpdateStage.upToDate,
        UpdateCheck.available => UpdateStage.available,
        UpdateCheck.availableInStore => UpdateStage.availableInStore,
        UpdateCheck.unsupported => UpdateStage.unsupported,
      });
    } catch (_) {
      _to(UpdateStage.failed);
    }
  }

  /// Start the update found by [check]. On success the store restarts the app, so the stage stays "installing".
  Future<void> install() async {
    if (stage != UpdateStage.available) return;
    _to(UpdateStage.installing);
    try {
      _to(switch (await _source.install()) {
        UpdateOutcome.started => UpdateStage.installing,
        UpdateOutcome.declined => UpdateStage.declined,
        UpdateOutcome.failed => UpdateStage.failed,
      });
    } catch (_) {
      _to(UpdateStage.failed);
    }
  }
}

/// The app's page on Google Play, for when the update has to be done from there.
const playListingUrl = 'https://play.google.com/store/apps/details?id=com.kynren.storiedlands';
