import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:path_provider/path_provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'tickets.dart';

/// The ticket's QR on a white square with a margin round it (a QR needs a quiet border to scan), as PNG bytes.
Future<Uint8List> ticketQrPng(String code, {double size = 1000, double margin = 80}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder);
  final full = size + margin * 2;
  canvas.drawRect(Rect.fromLTWH(0, 0, full, full), Paint()..color = const Color(0xFFFFFFFF));
  canvas.translate(margin, margin);
  QrPainter(
    data: code,
    version: QrVersions.auto,
    gapless: true,
    eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: Color(0xFF000000)),
    dataModuleStyle: const QrDataModuleStyle(dataModuleShape: QrDataModuleShape.square, color: Color(0xFF000000)),
  ).paint(canvas, Size(size, size));
  final image = await recorder.endRecording().toImage(full.round(), full.round());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  return bytes!.buffer.asUint8List();
}

/// What goes with a shared ticket: which night, whose, and the booking it belongs to.
String ticketShareText(TicketItem t, {String? holder}) {
  final bits = [t.title, ticketDay(t.date), t.priceName, holder ?? t.holder].where((x) => x != null && x.isNotEmpty).join(' · ');
  return 'My Kynren ticket: $bits${t.reference.isEmpty ? '' : '\nBooking ${t.reference}'}\nShow the QR code at the gate.';
}

/// Sends a ticket to someone (a friend coming along) as its QR picture, through the phone's share sheet.
Future<void> shareTicket(TicketItem t, {String? holder}) => shareTickets([t], holderFor: (_) => holder);

/// Sends several tickets (a whole booking) in one go: one QR picture each, and a line for each in the message.
Future<void> shareTickets(List<TicketItem> tickets, {String? Function(TicketItem)? holderFor}) async {
  if (tickets.isEmpty) return;
  final text = tickets.length == 1
      ? ticketShareText(tickets.first, holder: holderFor?.call(tickets.first))
      : '${tickets.length} Kynren tickets${tickets.first.reference.isEmpty ? '' : ' (booking ${tickets.first.reference})'}:\n${[
          for (var i = 0; i < tickets.length; i++) '${i + 1}. ${[ticketDay(tickets[i].date), tickets[i].priceName, holderFor?.call(tickets[i]) ?? tickets[i].holder].where((x) => x != null && x.isNotEmpty).join(' · ')}',
        ].join('\n')}\nShow each QR code at the gate.';
  final title = tickets.length == 1 ? tickets.first.title : '${tickets.length} Kynren tickets';
  if (kIsWeb) {
    await SharePlus.instance.share(ShareParams(text: text, title: title));
    return;
  }
  final dir = await getTemporaryDirectory();
  final files = <XFile>[];
  for (final t in tickets) {
    final file = File('${dir.path}/kynren-ticket-${t.id.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '')}.png');
    await file.writeAsBytes(await ticketQrPng(t.code));
    files.add(XFile(file.path, mimeType: 'image/png'));
  }
  await SharePlus.instance.share(ShareParams(files: files, text: text, title: title));
}
