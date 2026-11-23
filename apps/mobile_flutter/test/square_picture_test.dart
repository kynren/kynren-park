import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/ui/square_picture.dart';

Uint8List _solid(int w, int h, int r, int g, int b, int a) => Uint8List.fromList([for (var i = 0; i < w * h; i++) ...[r, g, b, a]]);

void main() {
  test('a picture on a green panel gives that green', () {
    final c = edgeColorOf(_solid(4, 2, 80, 110, 60, 255), 4, 2);
    expect((c.r * 255).round(), 80);
    expect((c.g * 255).round(), 110);
    expect((c.b * 255).round(), 60);
  });

  test('only the edge counts, not the middle', () {
    // a 5x5 picture: white edge, black centre
    final px = <int>[];
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < 5; x++) {
        final edge = x == 0 || y == 0 || x == 4 || y == 4;
        px.addAll(edge ? [255, 255, 255, 255] : [0, 0, 0, 255]);
      }
    }
    final c = edgeColorOf(Uint8List.fromList(px), 5, 5);
    expect((c.r * 255).round(), 255);
  });

  test('see-through edges are counted as the backdrop', () {
    final c = edgeColorOf(_solid(3, 3, 0, 0, 0, 0), 3, 3, backdrop: const Color(0xFF123456));
    expect(c, const Color(0xFF123456));
  });

  test('a picture that is not there falls back to the backdrop', () {
    expect(edgeColorOf(Uint8List(0), 4, 4, backdrop: Colors.red), Colors.red);
  });
}
