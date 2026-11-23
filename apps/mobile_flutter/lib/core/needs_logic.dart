import 'models.dart';

/// What a guest or their group needs to be able to enjoy a show. Each maps to something the park lists on every attraction.
enum Need { stepFree, audioDescription, captions, bsl }

const needLabel = {
  Need.stepFree: 'Step-free access',
  Need.audioDescription: 'Audio description',
  Need.captions: 'Captions',
  Need.bsl: 'BSL interpretation',
};

/// The keys the app already stores for these needs in the profile (Settings uses the same ones).
const needKey = {
  Need.stepFree: 'wheelchair',
  Need.audioDescription: 'audioDesc',
  Need.captions: 'captioning',
  Need.bsl: 'bsl',
};

/// The needs saved in the profile.
Set<Need> needsFromProfile(Map<String, dynamic> saved) => {
      for (final n in Need.values)
        if (saved[needKey[n]] == true) n,
    };

bool _has(Attraction a, Need n) => switch (n) {
      Need.stepFree => a.wheelchairAccessible,
      Need.audioDescription => a.hasAudioDescription,
      Need.captions => a.hasCaptioning,
      Need.bsl => a.hasBSL,
    };

/// How well an attraction meets the chosen needs.
enum Fit {
  /// No need has been chosen, so nothing can be said either way.
  unknown,

  /// Every chosen need is met.
  full,

  /// Some are met.
  partial,

  /// None are met.
  none,
}

class AttractionFit {
  final Attraction attraction;
  final Fit fit;
  final List<Need> met, missing;
  const AttractionFit(this.attraction, this.fit, this.met, this.missing);
}

/// Each attraction with what it offers against [needs], best matches first (then the park's own order).
/// What the park has not listed counts as not offered: an attraction is only called a fit when the park says it is.
List<AttractionFit> fitFor(Iterable<Attraction> attractions, Set<Need> needs) {
  final out = [
    for (final a in attractions)
      () {
        final met = [for (final n in Need.values) if (needs.contains(n) && _has(a, n)) n];
        final missing = [for (final n in Need.values) if (needs.contains(n) && !_has(a, n)) n];
        final fit = needs.isEmpty
            ? Fit.unknown
            : missing.isEmpty
                ? Fit.full
                : met.isEmpty
                    ? Fit.none
                    : Fit.partial;
        return AttractionFit(a, fit, met, missing);
      }(),
  ];
  out.sort((x, y) {
    final byFit = x.fit.index.compareTo(y.fit.index);
    return byFit != 0 ? byFit : x.attraction.sortOrder.compareTo(y.attraction.sortOrder);
  });
  return out;
}
