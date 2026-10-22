import 'dart:convert';
import 'dart:typed_data';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';

// The park's pictures arrive inside the bundle as base64 `data:` URIs as often as hosted URLs, so every image goes
// through here: data URIs are decoded once and shown from memory, anything else comes from the network with a disk cache.
final _decoded = <int, Uint8List>{};

bool isDataUri(String url) => url.startsWith('data:');

Uint8List _bytes(String url) {
  final key = Object.hash(url.length, url.hashCode);
  return _decoded.putIfAbsent(key, () {
    final comma = url.indexOf(',');
    return base64Decode(url.substring(comma + 1).replaceAll(RegExp(r'\s'), ''));
  });
}

/// An [ImageProvider] for a picture URL, hosted or embedded. [cacheWidth] decodes it no wider than that, which keeps
/// a huge embedded picture from taking tens of megabytes when it is only shown card-sized.
ImageProvider kImageProvider(String url, {int? cacheWidth}) {
  final base = isDataUri(url) ? MemoryImage(_bytes(url)) as ImageProvider : CachedNetworkImageProvider(url);
  return cacheWidth == null ? base : ResizeImage(base, width: cacheWidth, policy: ResizeImagePolicy.fit);
}

/// A picture from a hosted or embedded URL.
class KImage extends StatelessWidget {
  final String url;
  final BoxFit fit;
  final Alignment alignment;
  final double? width, height;
  final int? cacheWidth;
  final WidgetBuilder? placeholder, error;
  const KImage(this.url, {super.key, this.fit = BoxFit.cover, this.alignment = Alignment.center, this.width, this.height, this.cacheWidth, this.placeholder, this.error});

  @override
  Widget build(BuildContext context) {
    final empty = error ?? (_) => const SizedBox.shrink();
    if (url.isEmpty) return empty(context);
    Widget img;
    try {
      img = Image(
        image: kImageProvider(url, cacheWidth: cacheWidth),
        fit: fit,
        alignment: alignment,
        width: width,
        height: height,
        gaplessPlayback: true,
        errorBuilder: (ctx, _, _) => empty(ctx),
        frameBuilder: placeholder == null ? null : (ctx, child, frame, sync) => (sync || frame != null) ? child : placeholder!(ctx),
      );
    } catch (_) {
      img = empty(context);
    }
    return img;
  }
}
