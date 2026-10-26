/// The words of a search box: lower case, split on spaces, empties dropped.
List<String> searchWords(String query) => [for (final w in query.toLowerCase().split(RegExp(r'\s+'))) if (w.isNotEmpty) w];

bool _startsWord(String text, String w) => text.split(RegExp(r'[^a-z0-9]+')).any((t) => t.startsWith(w));

/// How well a place answers the search, 0 when it does not: every word must appear somewhere in [haystack]
/// (the place's title, tagline and the rest of its text). A hit in the title beats one in the subtitle, which beats
/// one buried in the description, and a title that starts with the word beats one that merely contains it.
int matchScore({required String title, required String subtitle, required String haystack, required List<String> words}) {
  if (words.isEmpty) return 0;
  final t = title.toLowerCase(), s = subtitle.toLowerCase(), h = haystack.toLowerCase();
  var total = 0;
  for (final w in words) {
    if (t.startsWith(w)) {
      total += 100;
    } else if (_startsWord(t, w)) {
      total += 80;
    } else if (t.contains(w)) {
      total += 60;
    } else if (s.contains(w)) {
      total += 30;
    } else if (h.contains(w)) {
      total += 10;
    } else {
      return 0;
    }
  }
  if (t == words.join(' ')) total += 50; // the whole title, typed out
  return total;
}

/// Edit distance between two words, giving up early once it passes [limit].
int _distance(String a, String b, int limit) {
  if ((a.length - b.length).abs() > limit) return limit + 1;
  var prev = List<int>.generate(b.length + 1, (i) => i);
  for (var i = 1; i <= a.length; i++) {
    final cur = List<int>.filled(b.length + 1, 0)..[0] = i;
    var rowMin = cur[0];
    for (var j = 1; j <= b.length; j++) {
      final cost = a.codeUnitAt(i - 1) == b.codeUnitAt(j - 1) ? 0 : 1;
      cur[j] = [prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost].reduce((x, y) => x < y ? x : y);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length];
}

/// A corrected spelling of a search that found nothing: each word the park's own vocabulary lacks is swapped for its
/// nearest word (one slip for short words, two for long ones). Null when nothing close enough exists, or nothing needed fixing.
String? didYouMean(List<String> words, Iterable<String> vocabulary) {
  final vocab = vocabulary.where((v) => v.length >= 3).toSet();
  var changed = false;
  final fixed = <String>[];
  for (final w in words) {
    if (w.length < 3 || vocab.any((v) => v.contains(w))) {
      fixed.add(w);
      continue;
    }
    final limit = w.length >= 7 ? 2 : 1;
    String? best;
    var bestD = limit + 1;
    for (final v in vocab) {
      final d = _distance(w, v, limit);
      if (d < bestD || (d == bestD && best != null && v.length < best.length)) {
        best = v;
        bestD = d;
      }
    }
    if (best == null) {
      fixed.add(w);
    } else {
      fixed.add(best);
      changed = true;
    }
  }
  return changed ? fixed.join(' ') : null;
}

/// The single words of some texts, for [didYouMean] to draw on.
Set<String> vocabularyOf(Iterable<String> texts) => {
      for (final t in texts)
        for (final w in t.toLowerCase().split(RegExp(r'[^a-z0-9]+')))
          if (w.length >= 3) w,
    };

/// Where [text] matches any of [words], as [start, end) spans, merged and in order, for highlighting.
List<(int, int)> matchSpans(String text, List<String> words) {
  final low = text.toLowerCase();
  final spans = <(int, int)>[];
  for (final w in words) {
    var from = 0;
    while (true) {
      final i = low.indexOf(w, from);
      if (i < 0) break;
      spans.add((i, i + w.length));
      from = i + w.length;
    }
  }
  spans.sort((a, b) => a.$1.compareTo(b.$1));
  final merged = <(int, int)>[];
  for (final s in spans) {
    if (merged.isNotEmpty && s.$1 <= merged.last.$2) {
      if (s.$2 > merged.last.$2) merged[merged.length - 1] = (merged.last.$1, s.$2);
    } else {
      merged.add(s);
    }
  }
  return merged;
}
