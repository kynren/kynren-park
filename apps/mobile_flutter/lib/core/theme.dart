import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

/// Design tokens: a fresh, contemporary system: a confident sans, clean surfaces, one forest-green brand colour and a warm amber accent.
class Tokens {
  static const brand = Color(0xFF1F6B49);
  static const brandDark = Color(0xFF0F3B2A);
  static const accent = Color(0xFFE2862B);
  static const gold = Color(0xFFC8963E);
  static const ok = Color(0xFF1F8A5B);
  static const warn = Color(0xFFD98A12);
  static const danger = Color(0xFFD1382E);
  static const full = Color(0xFF7B5BC4);

  static const bandFrom = Color(0xFF0F3B2A);
  static const bandTo = Color(0xFF1F6B49);

  static const radiusCard = 22.0;
  static const radiusField = 14.0;

  /// The one typeface: headings are just heavier weights of it.
  static const display = 'Jakarta';
}

/// Colours for one screen theme; screens read these instead of keeping a palette of their own.
class UIColors {
  final Color screen, card, soft, text, sub, line, placeholder, tint, tabBar;
  final Color primary, link, accent;
  const UIColors({
    required this.screen,
    required this.card,
    required this.soft,
    required this.text,
    required this.sub,
    required this.line,
    required this.placeholder,
    required this.tint,
    required this.tabBar,
    required this.primary,
    required this.link,
    required this.accent,
  });

  static const _light = (
    screen: Color(0xFFF5F6F2),
    card: Color(0xFFFFFFFF),
    soft: Color(0xFFECEFE9),
    text: Color(0xFF101A15),
    sub: Color(0xFF5B6A61),
    line: Color(0xFFE3E7E1),
    placeholder: Color(0xFF96A39B),
    tint: Color(0xFFE3F0E8),
    tabBar: Color(0xFFFFFFFF),
  );
  static const _dark = (
    screen: Color(0xFF0C1210),
    card: Color(0xFF151D19),
    soft: Color(0xFF1C2621),
    text: Color(0xFFEDF3EF),
    sub: Color(0xFF98AAA0),
    line: Color(0xFF243029),
    placeholder: Color(0xFF66766D),
    tint: Color(0xFF1B2D24),
    tabBar: Color(0xFF151D19),
  );

  factory UIColors.of(bool dark, {Color primary = Tokens.brand, Color accent = Tokens.accent}) {
    final b = dark ? _dark : _light;
    return UIColors(
      screen: b.screen,
      card: b.card,
      soft: b.soft,
      text: b.text,
      sub: b.sub,
      line: b.line,
      placeholder: b.placeholder,
      tint: b.tint,
      tabBar: b.tabBar,
      primary: primary,
      link: dark ? Color.lerp(primary, Colors.white, 0.5)! : primary,
      accent: accent,
    );
  }
}

extension UIContext on BuildContext {
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
  UIColors get ui => Theme.of(this).extension<UIThemeExt>()!.colors;
}

/// Carries [UIColors] through the Flutter [Theme].
class UIThemeExt extends ThemeExtension<UIThemeExt> {
  final UIColors colors;
  const UIThemeExt(this.colors);
  @override
  UIThemeExt copyWith({UIColors? colors}) => UIThemeExt(colors ?? this.colors);
  @override
  UIThemeExt lerp(ThemeExtension<UIThemeExt>? other, double t) => this;
}

ThemeData buildTheme(bool dark, {Color primary = Tokens.brand, Color accent = Tokens.accent}) {
  final c = UIColors.of(dark, primary: primary, accent: accent);
  final base = ThemeData(
    brightness: dark ? Brightness.dark : Brightness.light,
    useMaterial3: true,
    fontFamily: Tokens.display,
    scaffoldBackgroundColor: c.screen,
    colorScheme: ColorScheme.fromSeed(seedColor: primary, brightness: dark ? Brightness.dark : Brightness.light)
        .copyWith(primary: c.link, surface: c.card),
    splashFactory: InkSparkle.splashFactory,
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: GlideUpTransitions(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: c.text, displayColor: c.text),
    extensions: [UIThemeExt(c)],
  );
}

/// Soft, low shadows: cards sit just above the page rather than floating high over it.
List<BoxShadow> softShadow(bool dark, {int level = 1, bool up = false}) {
  final lift = level == 2 ? 12.0 : 6.0;
  return [
    BoxShadow(
      color: (dark ? Colors.black : const Color(0xFF101A15)).withValues(alpha: dark ? 0.45 : (level == 2 ? 0.14 : 0.06)),
      blurRadius: level == 2 ? 32 : 20,
      offset: Offset(0, up ? -lift : lift),
    ),
  ];
}

const featureGradient = {
  'restaurants': [Color(0xFFB03A2E), Color(0xFFE5793A)],
  'tickets': [Color(0xFF0F2A21), Color(0xFF2F5C46)],
  'programme': [Color(0xFFB4650F), Color(0xFFF0A744)],
};

const categoryColor = {
  'BIRDS': Color(0xFF3A7CA5),
  'HORSE': Color(0xFF8F5A2B),
  'LAKE': Color(0xFF2E7D5B),
  'VIKINGS': Color(0xFFB3261E),
  'MAZE': Color(0xFF6B4FA1),
  'EVENING_SHOW': Color(0xFF8F1D21),
  'OTHER': Color(0xFF6B6460),
};

const statusColor = {
  'SCHEDULED': Tokens.ok,
  'DELAYED': Tokens.warn,
  'CANCELLED': Tokens.danger,
  'FULL': Tokens.full,
  'FINISHED': Color(0xFF6D5C49),
};

/// Screens rise a little and fade in as they open, and sink and fade as they close: quicker and softer than a hard slide.
class GlideUpTransitions extends PageTransitionsBuilder {
  const GlideUpTransitions();

  @override
  Widget buildTransitions<T>(PageRoute<T> route, BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) {
    final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic, reverseCurve: Curves.easeInCubic);
    final behind = CurvedAnimation(parent: secondaryAnimation, curve: Curves.easeOutCubic);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: const Offset(0, 0.05), end: Offset.zero).animate(curved),
        // the screen being covered recedes slightly
        child: ScaleTransition(scale: Tween(begin: 1.0, end: 0.97).animate(behind), child: child),
      ),
    );
  }
}
