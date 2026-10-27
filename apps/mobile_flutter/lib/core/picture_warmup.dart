import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:http/http.dart' as http;

// The bundle names the park's pictures by URL instead of carrying them, so a phone that is offline at first launch would
// show none. Right after the first sync the app fetches each one into the same disk cache the pictures are shown from.

/// The largest picture worth fetching ahead of time. Anything bigger is left to load when it is shown.
const warmMaxBytes = 6 * 1024 * 1024;

final _pictureUrl = RegExp(r'^https?://\S+$');
final _pictureName = RegExp(r'\.(png|jpe?g|webp|gif)(\?|$)', caseSensitive: false);

/// Every hosted picture URL in a decoded bundle, once each, in the order they appear.
List<String> pictureUrls(Object? json) {
  final seen = <String>{};
  void walk(Object? v) {
    if (v is String) {
      if (_pictureUrl.hasMatch(v) && (v.contains('/api/media/') || _pictureName.hasMatch(v))) seen.add(v);
    } else if (v is List) {
      v.forEach(walk);
    } else if (v is Map) {
      v.values.forEach(walk);
    }
  }

  walk(json);
  return seen.toList();
}

/// Fetches each of [urls] that is not cached yet, one at a time so it never competes with what is on screen. [isCached]
/// and [fetch] are the cache and the network; a picture that fails is skipped. Returns how many were fetched.
Future<int> warmPictures(
  Iterable<String> urls, {
  required Future<bool> Function(String url) isCached,
  required Future<bool> Function(String url) fetch,
}) async {
  var fetched = 0;
  for (final url in urls) {
    try {
      if (await isCached(url)) continue;
      if (await fetch(url)) fetched += 1;
    } catch (_) {
      // Offline, or one bad file: the others still matter.
    }
  }
  return fetched;
}

/// Whether the app should do this at all: a phone, not a browser (which caches for itself) and not a test.
bool get warmingPicturesIsWanted => !kIsWeb && !Platform.environment.containsKey('FLUTTER_TEST');

/// [warmPictures] against the disk cache the pictures are shown from. A HEAD first, so a video or a huge file is never
/// downloaded just to be warmed.
Future<int> warmPictureCache(Iterable<String> urls, {CacheManager? cache, http.Client? client}) {
  final store = cache ?? DefaultCacheManager();
  final web = client ?? http.Client();
  return warmPictures(
    urls,
    isCached: (url) async => await store.getFileFromCache(url) != null,
    fetch: (url) async {
      final head = await web.head(Uri.parse(url));
      final type = head.headers['content-type'] ?? '';
      final size = int.tryParse(head.headers['content-length'] ?? '') ?? 0;
      if (head.statusCode != 200 || !type.startsWith('image/') || size > warmMaxBytes) return false;
      await store.downloadFile(url);
      return true;
    },
  );
}
