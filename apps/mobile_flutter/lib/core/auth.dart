import 'package:flutter/foundation.dart';
import 'api.dart';
import 'safe_notify.dart';

class AuthUser {
  final String id;
  final String? email, name;
  AuthUser.fromJson(Map<String, dynamic> j)
      : id = j['id'] as String,
        email = j['email'] as String?,
        name = j['name'] as String?;
}

class AuthState extends ChangeNotifier with SafeNotify {
  AuthUser? user;
  bool loading = true;

  /// Restores the session on launch. The access token is short-lived, so most re-opens land
  /// here with it expired: `api()`'s own 401 retry redeems the 30-day refresh token before this
  /// `/me` call fails, which is what keeps a guest signed in across restarts.
  Future<void> restore() async {
    final token = await getToken();
    final refresh = await getRefreshToken();
    if (token != null || refresh != null) {
      try {
        user = AuthUser.fromJson(await api('/me') as Map<String, dynamic>);
      } on ApiError catch (e) {
        // Only a rejected session ends it; a network failure keeps the tokens for next time.
        if (e.status == 401 || e.status == 403) {
          await setToken(null);
          await setRefreshToken(null);
        }
      } catch (_) {}
    }
    loading = false;
    notifyListeners();
  }

  Future<void> _apply(Map<String, dynamic> res) async {
    await setToken(res['accessToken'] as String);
    await setRefreshToken(res['refreshToken'] as String);
    user = AuthUser.fromJson(res['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  Future<void> login(String email, String password) async =>
      _apply(await api('/auth/login', method: 'POST', body: {'email': email, 'password': password}) as Map<String, dynamic>);

  Future<void> register(String email, String password, {String? name}) async =>
      _apply(await api('/auth/register', method: 'POST', body: {'email': email, 'password': password, 'name': name}) as Map<String, dynamic>);

  Future<void> logout() async {
    final refresh = await getRefreshToken();
    if (refresh != null) {
      // Best effort: revoke server-side, but never let being offline block signing out.
      await api('/auth/logout', method: 'POST', body: {'refreshToken': refresh}).catchError((_) => null);
    }
    await setToken(null);
    await setRefreshToken(null);
    user = null;
    notifyListeners();
  }
}
