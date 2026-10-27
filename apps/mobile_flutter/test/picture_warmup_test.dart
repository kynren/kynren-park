import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/picture_warmup.dart';

void main() {
  group('finding the pictures in a bundle', () {
    test('picks out hosted pictures wherever they sit, once each, in order', () {
      final urls = pictureUrls({
        'attractions': [
          {'name': 'Kynren', 'heroImage': 'https://app-park.kynren.com/api/media/aaa'},
          {'name': 'Fort', 'images': ['https://app-park.kynren.com/api/media/bbb', 'https://app-park.kynren.com/api/media/aaa']},
        ],
        'branding': {'iconUrl': 'https://cdn.example.com/icon.PNG?v=2'},
      });
      expect(urls, [
        'https://app-park.kynren.com/api/media/aaa',
        'https://app-park.kynren.com/api/media/bbb',
        'https://cdn.example.com/icon.PNG?v=2',
      ]);
    });

    test('leaves out text, embedded pictures, links to pages and anything that is not a web address', () {
      expect(
        pictureUrls({
          'a': 'Open from 10:30',
          'b': 'data:image/png;base64,iVBORw0KGgo=',
          'c': 'https://app-park.kynren.com/restaurants/pizza',
          'd': 'a https://app-park.kynren.com/api/media/zzz inside a sentence',
          'e': 42,
          'f': null,
        }),
        isEmpty,
      );
    });
  });

  group('warming the cache', () {
    test('fetches only what is not cached, one at a time, and says how many it fetched', () async {
      final cached = {'b'};
      final order = <String>[];
      var running = 0;
      final n = await warmPictures(
        ['a', 'b', 'c'],
        isCached: (u) async => cached.contains(u),
        fetch: (u) async {
          running += 1;
          expect(running, 1, reason: 'never two at once');
          await Future<void>.delayed(Duration.zero);
          order.add(u);
          running -= 1;
          return true;
        },
      );
      expect(order, ['a', 'c']);
      expect(n, 2);
    });

    test('a picture that fails, or is declined, does not stop the rest', () async {
      final n = await warmPictures(
        ['a', 'b', 'c', 'd'],
        isCached: (u) async => u == 'x',
        fetch: (u) async {
          if (u == 'a') throw Exception('offline');
          return u != 'b';
        },
      );
      expect(n, 2, reason: 'c and d only');
    });
  });
}
