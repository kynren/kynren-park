import 'package:flutter/material.dart';

/// Design tokens ported from the React Native app (lib/theme.ts + lib/ui.ts).
class Tokens {
  static const brand = Color(0xFF2F5B43);
  static const brandDark = Color(0xFF1F3D2D);
  static const accent = Color(0xFF8A1F31);
  static const gold = Color(0xFFB8893A);
  static const ok = Color(0xFF2E7D4F);
  static const warn = Color(0xFFB9791A);
  static const danger = Color(0xFFA3261E);
  static const full = Color(0xFF6B4A8A);

  static const bandFrom = Color(0xFF1D3A2B);
  static const bandTo = Color(0xFF376348);

  static const radiusCard = 16.0;
  static const radiusField = 12.0;

  static const serif = 'Lora';
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
    screen: Color(0xFFF3EAD9),
    card: Color(0xFFFBF6EC),
    soft: Color(0xFFEBDFC6),
    text: Color(0xFF2B2118),
    sub: Color(0xFF6D5C49),
    line: Color(0xFFDCCDAE),
    placeholder: Color(0xFFA2917A),
    tint: Color(0xFFE6E1C8),
    tabBar: Color(0xFFFBF6EC),
  );
  static const _dark = (
    screen: Color(0xFF15120E),
    card: Color(0xFF201B15),
    soft: Color(0xFF2B241C),
    text: Color(0xFFF2E8D3),
    sub: Color(0xFFB9AA90),
    line: Color(0xFF3A3126),
    placeholder: Color(0xFF7D705C),
    tint: Color(0xFF2A3A2E),
    tabBar: Color(0xFF1B1712),
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
    scaffoldBackgroundColor: c.screen,
    colorScheme: ColorScheme.fromSeed(seedColor: primary, brightness: dark ? Brightness.dark : Brightness.light)
        .copyWith(primary: c.link, surface: c.card),
    splashFactory: InkSparkle.splashFactory,
  );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: c.text, displayColor: c.text),
    extensions: [UIThemeExt(c)],
  );
}

/// Soft, wide shadows: the cards float rather than outline.
List<BoxShadow> softShadow(bool dark, {int level = 1, bool up = false}) {
  final lift = level == 2 ? 10.0 : 6.0;
  return [
    BoxShadow(
      color: (dark ? Colors.black : const Color(0xFF3B2A14)).withValues(alpha: dark ? 0.4 : (level == 2 ? 0.14 : 0.08)),
      blurRadius: level == 2 ? 22 : 14,
      offset: Offset(0, up ? -lift : lift),
    ),
  ];
}

const featureGradient = {
  'restaurants': [Color(0xFF6E1423), Color(0xFFA8452D)],
  'tickets': [Color(0xFF2A2118), Color(0xFF5A4630)],
  'programme': [Color(0xFF7A5A1E), Color(0xFFC2923F)],
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
