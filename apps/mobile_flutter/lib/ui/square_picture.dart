import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'kimage.dart';
import 'skeleton.dart';

/// The average colour round the outer edge of a picture (raw straight RGBA, [w] by [h]), with anything see-through
/// counted as [backdrop]. A logo on a green panel gives that green, so it can be set on a square of the same green.
Color edgeColorOf(Uint8List rgba, int w, int h, {Color backdrop = Colors.white}) {
  if (w <= 0 || h <= 0 || rgba.length < w * h * 4) return backdrop;
  var r = 0.0, g = 0.0, b = 0.0, n = 0;
  void add(int x, int y) {
    final i = (y * w + x) * 4;
    final a = rgba[i + 3] / 255;
    r += rgba[i] * a + (backdrop.r * 255) * (1 - a);
    g += rgba[i + 1] * a + (backdrop.g * 255) * (1 - a);
    b += rgba[i + 2] * a + (backdrop.b * 255) * (1 - a);
    n++;
  }

  final sx = (w ~/ 48).clamp(1, w), sy = (h ~/ 48).clamp(1, h);
  for (var x = 0; x < w; x += sx) {
    add(x, 0);
    add(x, h - 1);
  }
  for (var y = 0; y < h; y += sy) {
    add(0, y);
    add(w - 1, y);
  }
  return Color.fromARGB(255, (r / n).round().clamp(0, 255), (g / n).round().clamp(0, 255), (b / n).round().clamp(0, 255));
}

/// A square picture that shows all of the image, neatly: a picture that is already about square fills the square; a wide
/// or tall one (most of ours are logos) is centred whole on a square of its own edge colour, so there are no bars or
/// blurred fill and nothing is cut off.
class SquarePicture extends StatefulWidget {
  final String url;
  final double size, radius;

  /// What see-through parts of a picture are taken to sit on, for working out its edge colour.
  final Color backdrop;
  const SquarePicture({super.key, required this.url, this.size = 96, this.radius = 16, this.backdrop = Colors.white});

  @override
  State<SquarePicture> createState() => _SquarePictureState();
}

class _SquarePictureState extends State<SquarePicture> {
  ImageStream? _stream;
  ImageStreamListener? _listener;
  double? _aspect;
  Color? _edge;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(SquarePicture old) {
    super.didUpdateWidget(old);
    if (old.url != widget.url) {
      _aspect = null;
      _edge = null;
      _resolve();
    }
  }

  void _resolve() {
    _stop();
    final stream = kImageProvider(widget.url, cacheWidth: 320).resolve(ImageConfiguration.empty);
    _listener = ImageStreamListener((info, _) async {
      final image = info.image;
      final aspect = image.width / image.height;
      Color? edge;
      try {
        final data = await image.toByteData(format: ui.ImageByteFormat.rawStraightRgba);
        if (data != null) edge = edgeColorOf(data.buffer.asUint8List(), image.width, image.height, backdrop: widget.backdrop);
      } catch (_) {
        // an edge colour we cannot read falls back to the card colour
      }
      if (mounted) {
        setState(() {
          _aspect = aspect;
          _edge = edge ?? widget.backdrop;
        });
      }
    }, onError: (_, _) {
      if (mounted) {
        setState(() {
          _aspect = 1;
          _edge = widget.backdrop;
        });
      }
    });
    _stream = stream..addListener(_listener!);
  }

  void _stop() {
    final l = _listener;
    if (l != null) _stream?.removeListener(l);
    _listener = null;
  }

  @override
  void dispose() {
    _stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final aspect = _aspect;
    final s = widget.size;
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: SizedBox(
        width: s,
        height: s,
        child: aspect == null
            ? const Skeleton(radius: 0)
            : (aspect >= 0.85 && aspect <= 1.18)
                ? KImage(widget.url, fit: BoxFit.cover, cacheWidth: 320)
                : ColoredBox(color: _edge ?? widget.backdrop, child: Center(child: KImage(widget.url, fit: BoxFit.contain, cacheWidth: 320))),
      ),
    );
  }
}
