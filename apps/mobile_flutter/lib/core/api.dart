import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// The hosted API. Debug builds may point at a local server with
/// `--dart-define=API_URL=http://localhost:4010`.
const _definedUrl = String.fromEnvironment('API_URL');
final String apiUrl = (_definedUrl.isNotEmpty ? _definedUrl : 'https://app-park.kynren.com').replaceAll(RegExp(r'/+$'), '');

const _tokenKey = 'kynren_access_token';
const _refreshKey = 'kynren_refresh_token';

Future<String?> getToken() async => (await SharedPreferences.getInstance()).getString(_tokenKey);
Future<String?> getRefreshToken() async => (await SharedPreferences.getInstance()).getString(_refreshKey);

Future<void> _put(String key, String? v) async {
  final p = await SharedPreferences.getInstance();
  if (v == null) {
    await p.remove(key);
  } else {
    await p.setString(key, v);
  }
}

Future<void> setToken(String? v) => _put(_tokenKey, v);
Future<void> setRefreshToken(String? v) => _put(_refreshKey, v);

class ApiError implements Exception {
  final int status;
  final String? serverMessage;
  ApiError(this.status, [this.serverMessage]);
  @override
  String toString() => serverMessage ?? 'Request failed ($status)';
}

// The access token is short-lived (15 min); the refresh token (30 days, rotated on every
// use) is what keeps a guest signed in. Concurrent 401s share one in-flight refresh,
// because the endpoint rotates the token per call and only the first of a race would win.
Future<String?>? _refreshing;

Future<String?> _refreshAccessToken() {
  return _refreshing ??= () async {
    try {
      final rt = await getRefreshToken();
      if (rt == null) return null;
      try {
        final res = await http.post(
          Uri.parse('$apiUrl/api/auth/refresh'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': rt}),
        );
        if (res.statusCode < 200 || res.statusCode >= 300) {
          // The refresh token itself is invalid or revoked: a genuine end of session.
          await setToken(null);
          await setRefreshToken(null);
          return null;
        }
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        await setToken(data['accessToken'] as String);
        await setRefreshToken(data['refreshToken'] as String);
        return data['accessToken'] as String;
      } catch (_) {
        // Offline: leave the tokens alone so the next call can retry.
        return null;
      }
    } finally {
      _refreshing = null;
    }
  }();
}

/// Calls `/api{path}` with the signed-in guest's token, refreshing it once on a 401.
/// Returns decoded JSON (or null for 204). Throws [ApiError] on a non-2xx response.
Future<dynamic> api(String path, {String method = 'GET', Object? body, Map<String, String>? headers}) async {
  Future<http.Response> doFetch(String? token) {
    final h = {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      ...?headers,
    };
    final uri = Uri.parse('$apiUrl/api$path');
    final b = body == null ? null : (body is String ? body : jsonEncode(body));
    switch (method) {
      case 'POST':
        return http.post(uri, headers: h, body: b);
      case 'PATCH':
        return http.patch(uri, headers: h, body: b);
      case 'PUT':
        return http.put(uri, headers: h, body: b);
      case 'DELETE':
        return http.delete(uri, headers: h, body: b);
      default:
        return http.get(uri, headers: h);
    }
  }

  var res = await doFetch(await getToken());
  if (res.statusCode == 401) {
    final fresh = await _refreshAccessToken();
    if (fresh != null) res = await doFetch(fresh);
  }
  if (res.statusCode < 200 || res.statusCode >= 300) {
    String? msg;
    try {
      final m = (jsonDecode(res.body) as Map<String, dynamic>)['message'];
      msg = m is List ? m.join(', ') : m as String?;
    } catch (_) {}
    throw ApiError(res.statusCode, msg);
  }
  if (res.statusCode == 204 || res.body.isEmpty) return null;
  try {
    return jsonDecode(res.body);
  } catch (e) {
    if (kDebugMode) debugPrint('api $path: not JSON');
    return null;
  }
}
