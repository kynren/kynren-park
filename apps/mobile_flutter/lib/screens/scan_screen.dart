import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../core/theme.dart';

// Accepts kynren://spot/<type>/<id> (and an https .../s/<type>/<id> fallback).
({String type, String id})? _parseSpot(String data) {
  final m = RegExp(r'(?:spot|s)/(attraction|restaurant|shop|poi)/([\w-]+)', caseSensitive: false).firstMatch(data);
  return m == null ? null : (type: m.group(1)!.toLowerCase(), id: m.group(2)!);
}

// A menu item / shop product isn't its own map spot: it is something sold at one, so its code carries the
// parent's slug and goes straight to that restaurant or shop screen instead of through the map.
({bool menu, String slug})? _parseItem(String data) {
  final m = RegExp(r'item/(menu|shop)/([\w-]+)/([\w-]+)', caseSensitive: false).firstMatch(data);
  return m == null ? null : (menu: m.group(1)!.toLowerCase() == 'menu', slug: m.group(2)!);
}

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  bool _handled = false;
  String _error = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onScanned(BarcodeCapture capture) {
    if (_handled) return;
    final data = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
    if (data == null) return;
    final item = _parseItem(data);
    if (item != null) {
      _handled = true;
      context.pushReplacement('/${item.menu ? 'restaurant' : 'shop'}/${item.slug}');
      return;
    }
    final spot = _parseSpot(data);
    if (spot == null) {
      setState(() => _error = 'That’s not a Kynren code. Try another.');
      return;
    }
    _handled = true;
    context.go('/map?spot=${spot.type}:${spot.id}');
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(fit: StackFit.expand, children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onScanned,
          errorBuilder: (context, error) => Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              const Text('Scan Kynren codes', style: TextStyle(fontFamily: Tokens.display, color: Colors.white, fontSize: 19.5, fontWeight: FontWeight.w800)),
              const SizedBox(height: 10),
              const Text('Allow camera access to scan a code — a spot on the map, or a menu item or product.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFFCFCFCF), fontSize: 15, height: 21 / 15)),
              const SizedBox(height: 26),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: c.primary, padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 34), shape: const StadiumBorder()),
                onPressed: () => _controller.start(),
                child: const Text('Allow camera', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ]),
          ),
        ),
        IgnorePointer(
          child: Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 240, height: 240, decoration: BoxDecoration(borderRadius: BorderRadius.circular(28), border: Border.all(color: const Color(0xE6FFFFFF), width: 3))),
              const SizedBox(height: 22),
              const Text('Point at a Kynren QR code', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600, shadows: [Shadow(color: Color(0x99000000), blurRadius: 6)])),
            ]),
          ),
        ),
        if (_error.isNotEmpty)
          Positioned(
            bottom: MediaQuery.paddingOf(context).bottom + 96,
            left: 0,
            right: 0,
            child: Center(child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10), decoration: BoxDecoration(color: const Color(0xF0D64545), borderRadius: BorderRadius.circular(10)), child: Text(_error, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)))),
          ),
        Positioned(
          top: top + 10,
          right: 16,
          child: GestureDetector(
            onTap: () => context.canPop() ? context.pop() : context.go('/'),
            child: Container(width: 44, height: 44, decoration: const BoxDecoration(color: Color(0x80000000), shape: BoxShape.circle), child: const Icon(Icons.close_rounded, color: Colors.white, size: 22)),
          ),
        ),
      ]),
    );
  }
}
