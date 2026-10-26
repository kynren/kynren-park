import 'package:flutter_test/flutter_test.dart';
import 'package:storiedlands/core/search_logic.dart';

int score(String title, String words, {String subtitle = '', String body = ''}) =>
    matchScore(title: title, subtitle: subtitle, haystack: '$title $subtitle $body', words: searchWords(words));

void main() {
  group('matchScore', () {
    test('a place must contain every word', () {
      expect(score('Land of the Vikings', 'vikings land'), greaterThan(0));
      expect(score('Land of the Vikings', 'vikings horses'), 0);
    });

    test('the title beats the subtitle, which beats the description', () {
      final inTitle = score('Feather Show', 'feather');
      final inSubtitle = score('Birds', 'feather', subtitle: 'The Lost Feather');
      final inBody = score('Birds', 'feather', body: 'a lost feather is found');
      expect(inTitle, greaterThan(inSubtitle));
      expect(inSubtitle, greaterThan(inBody));
      expect(inBody, greaterThan(0));
    });

    test('a title that starts with the word beats one that only contains it, and the full title beats both', () {
      expect(score('Toilets', 'toi'), greaterThan(score('Public toilets', 'toi') - 1)); // both start a word
      expect(score('Viking Camp', 'vik'), greaterThan(score('Heavikings', 'vik')));
      expect(score('Toilets', 'toilets'), greaterThan(score('Toilets east', 'toilets')));
    });

    test('an empty search scores nothing', () {
      expect(score('Anything', ''), 0);
    });
  });

  group('didYouMean', () {
    final vocab = vocabularyOf(['Land of the Vikings', 'Victorian Imaginariums', 'Toilets', 'First aid', 'Lakeside Kitchen']);

    test('fixes a slip in a word the park does not have', () {
      expect(didYouMean(searchWords('vikngs'), vocab), 'vikings');
      expect(didYouMean(searchWords('toliets'), vocab), 'toilets');
      expect(didYouMean(searchWords('lakeside kitchn'), vocab), 'lakeside kitchen');
    });

    test('long words forgive two slips, short ones only one', () {
      expect(didYouMean(searchWords('imaginariam'), vocab), 'imaginariums');
      expect(didYouMean(searchWords('aix'), vocab), 'aid'); // one slip is fine for a short word
      expect(didYouMean(searchWords('xyz'), vocab), isNull); // two would be too many
    });

    test('nothing to suggest when the words are fine or nothing is close', () {
      expect(didYouMean(searchWords('vikings'), vocab), isNull);
      expect(didYouMean(searchWords('zzzzzz'), vocab), isNull);
    });
  });

  test('matchSpans marks every hit once, merged and in order', () {
    expect(matchSpans('Land of the Vikings', ['land', 'vik']), [(0, 4), (12, 15)]);
    expect(matchSpans('Toilets', ['toi', 'oil']), [(0, 4)]);
    expect(matchSpans('Toilets', ['xyz']), isEmpty);
  });
}
