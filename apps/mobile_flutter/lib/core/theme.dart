import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';

/// Design tokens: a fresh, contemporary system: a confident sans, clean surfaces, and Kynren's own two colours:
/// the official navy (#1B2B4B) as the brand colour and the official red (#DB0833) as the accent.
class Tokens {
  static const brand = Color(0xFF1B2B4B);
  static const brandDark = Color(0xFF0E1830);
  static const accent = Color(0xFFDB0833);
  static const gold = Color(0xFFC8963E);
  static const ok = Color(0xFF1F8A5B);
  static const warn = Color(0xFFD98A12);
  static const danger = Color(0xFFD1382E);
  static const full = Color(0xFF7B5BC4);

  static const bandFrom = Color(0xFF0E1830);
  static const bandTo = Color(0xFF1B2B4B);

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
    screen: Color(0xFFF4F5F8),
    card: Color(0xFFFFFFFF),
    soft: Color(0xFFECEEF3),
    text: Color(0xFF111A2E),
    sub: Color(0xFF596378),
    line: Color(0xFFE1E4EB),
    placeholder: Color(0xFF959FB2),
    tint: Color(0xFFE5E9F2),
    tabBar: Color(0xFFFFFFFF),
  );
  static const _dark = (
    screen: Color(0xFF0A101C),
    card: Color(0xFF131B2B),
    soft: Color(0xFF1B2538),
    text: Color(0xFFECEFF6),
    sub: Color(0xFF97A2B8),
    line: Color(0xFF232E44),
    placeholder: Color(0xFF65718A),
    tint: Color(0xFF1B2741),
    tabBar: Color(0xFF131B2B),
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
      // navy on a dark page would vanish: filled controls lift a little, and text-coloured links go a light blue
      primary: dark ? Color.lerp(primary, Colors.white, 0.22)! : primary,
      link: dark ? Color.lerp(primary, const Color(0xFF9DB7FF), 0.75)! : primary,
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
  'restaurants': [Color(0xFFB4650F), Color(0xFFF0A744)],
  'shops': [Color(0xFF2F3E52), Color(0xFF5B7390)],
  'essentials': [Color(0xFF1F4F7A), Color(0xFF3E86B8)],
  'tickets': [Color(0xFF0E1830), Color(0xFF2B4170)],
  'programme': [Color(0xFF9E0626), Color(0xFFDB0833)],
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
