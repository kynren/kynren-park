import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Chooses the colour of the phone's status-bar icons (clock, signal, battery) for the screen it wraps.
/// [light] means white icons, for a screen whose top is dark (a green header band, a photo); otherwise they are dark.
/// The bar itself stays transparent, so the page shows through it.
class StatusBarIcons extends StatelessWidget {
  final bool light;
  final Widget child;
  const StatusBarIcons({super.key, required this.light, required this.child});

  static SystemUiOverlayStyle styleFor({required bool light}) => SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: light ? Brightness.light : Brightness.dark, // Android
        statusBarBrightness: light ? Brightness.dark : Brightness.light, // iOS names it the other way round
      );

  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(value: styleFor(light: light), child: child);
}
