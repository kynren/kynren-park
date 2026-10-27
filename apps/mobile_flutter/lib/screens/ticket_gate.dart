import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../core/tickets.dart';
import '../core/theme.dart';
import '../ui/status_bar.dart';

/// Opens the full-screen "show at the gate" view: [tickets] one after another (swipe sideways), starting at [index].
void openGateMode(BuildContext context, List<TicketItem> tickets, int index) {
  if (tickets.isEmpty) return;
  Navigator.of(context, rootNavigator: true).push(
    MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => TicketGate(tickets: tickets, index: index.clamp(0, tickets.length - 1))),
  );
}

// A plain white screen with black ink whatever the app's theme: the brightest, highest-contrast thing a scanner can read.
const _ink = Color(0xFF14161A);
const _soft = Color(0xFF5B6270);

/// One ticket's QR as large as the screen allows, on white, with just enough to tell tickets apart. For a booking of
/// several tickets the guest swipes from one to the next without leaving the screen.
class TicketGate extends StatefulWidget {
  final List<TicketItem> tickets;
  final int index;
  const TicketGate({super.key, required this.tickets, required this.index});
  @override
  State<TicketGate> createState() => _TicketGateState();
}

class _TicketGateState extends State<TicketGate> {
  late final PageController _page = PageController(initialPage: widget.index);
  late int _at = widget.index;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final many = widget.tickets.length > 1;
    final size = MediaQuery.sizeOf(context);
    final qr = math.min(size.width - 56, size.height * 0.5);
    return StatusBarIcons(
      light: false,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: Stack(children: [
            PageView.builder(
              controller: _page,
              itemCount: widget.tickets.length,
              onPageChanged: (i) {
                HapticFeedback.selectionClick();
                setState(() => _at = i);
              },
              itemBuilder: (_, i) {
                final t = widget.tickets[i];
                final line = [ticketDay(t.date), t.priceName].where((x) => x != null && x.isNotEmpty).join(' · ');
                final holder = context.read<TicketsState>().holderFor(t);
                final notice = ticketNotice(t);
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 28),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    if (notice != null) ...[
                      // before the guest holds it up: this one will not get them in as it is, or is for another day
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(color: notice.serious ? const Color(0xFFFCE8E6) : const Color(0xFFFFF3D6), borderRadius: BorderRadius.circular(12)),
                        child: Text(notice.text, textAlign: TextAlign.center, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: notice.serious ? const Color(0xFFB3261E) : const Color(0xFF8A5A00))),
                      ),
                      const SizedBox(height: 16),
                    ],
                    Text(t.title, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: Tokens.display, fontSize: 22, fontWeight: FontWeight.w800, height: 1.2, color: _ink)),
                    if (line.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(line, textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _soft))),
                    const SizedBox(height: 22),
                    QrImageView(data: t.code, size: qr, padding: EdgeInsets.zero, backgroundColor: Colors.white, eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Colors.black), dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Colors.black)),
                    const SizedBox(height: 22),
                    if (holder != null && holder.isNotEmpty) Text(holder, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: _ink)),
                    if (t.reference.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('Booking ${t.reference}', style: const TextStyle(fontSize: 13.5, color: _soft))),
                    // the short code, for the gate to key in if the QR will not scan
                    if (t.shortCode != null && t.shortCode!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text('Ticket code ${t.shortCode}', style: const TextStyle(fontSize: 13.5, color: _soft))),
                  ]),
                );
              },
            ),
            Positioned(
              top: 6,
              left: 8,
              child: IconButton(tooltip: 'Close', icon: const Icon(Icons.close_rounded, color: _ink, size: 28), onPressed: () => Navigator.of(context).maybePop()),
            ),
            if (many)
              Positioned(
                bottom: 22,
                left: 0,
                right: 0,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('Ticket ${_at + 1} of ${widget.tickets.length}', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: _ink)),
                  const SizedBox(height: 8),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    for (var i = 0; i < widget.tickets.length; i++)
                      Container(margin: const EdgeInsets.symmetric(horizontal: 3), width: i == _at ? 18 : 7, height: 7, decoration: BoxDecoration(color: i == _at ? _ink : const Color(0xFFCDD1D8), borderRadius: BorderRadius.circular(4))),
                  ]),
                  const SizedBox(height: 8),
                  const Text('Swipe for the next ticket', style: TextStyle(fontSize: 12.5, color: _soft)),
                ]),
              ),
          ]),
        ),
      ),
    );
  }
}
