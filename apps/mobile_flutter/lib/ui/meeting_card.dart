import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/essentials.dart';
import '../core/format.dart';
import '../core/location.dart';
import '../core/meeting.dart';
import '../core/theme.dart';
import 'controls.dart';
import 'tap.dart';

/// A meeting spot for the guest's group: stand where the group should meet, mark it, and send it as a link that opens in any
/// maps app. The spot lives on the phone; nothing is uploaded.
class MeetingCard extends StatefulWidget {
  const MeetingCard({super.key});
  @override
  State<MeetingCard> createState() => _MeetingCardState();
}

class _MeetingCardState extends State<MeetingCard> {
  MeetSpot? _spot;

  @override
  void initState() {
    super.initState();
    loadMeetSpot().then((s) => mounted && s != null ? setState(() => _spot = s) : null);
  }

  Future<void> _set(Geo here) async {
    final spot = MeetSpot(here.lat, here.lng, DateTime.now());
    setState(() => _spot = spot);
    await saveMeetSpot(spot);
  }

  Future<void> _clear() async {
    setState(() => _spot = null);
    await clearMeetSpot();
  }

  Future<void> _open(MeetSpot s) async {
    try {
      await launchUrl(Uri.parse(meetLink(s)), mode: LaunchMode.externalApplication);
    } catch (_) {/* no maps app to open it: the link can still be sent */}
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final gps = context.watch<LocationState>().gps;
    final spot = _spot;
    final away = spot == null || gps == null ? null : distanceLabel(distMeters(gps, spot.geo));
    return KCard(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.groups_rounded, size: 20, color: c.link),
          const SizedBox(width: 8),
          Text('Meeting spot', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: c.text)),
        ]),
        const SizedBox(height: 4),
        if (spot == null) ...[
          Text('Stand where your group should meet, mark it, and send them a link that opens in their maps app. It is saved on your phone.', style: TextStyle(fontSize: 13.5, height: 19 / 13.5, color: c.sub)),
          const SizedBox(height: 12),
          KButton('Mark where I am', small: true, icon: Icons.add_location_alt_rounded, onPressed: gps == null ? null : () => _set(gps)),
          if (gps == null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Turn on location to mark a spot.', style: TextStyle(fontSize: 12.5, color: c.sub))),
        ] else ...[
          Text(
            'Marked at ${fmtTimeUK(spot.savedAt)}${away != null ? ' · $away' : ''}',
            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.link),
          ),
          const SizedBox(height: 12),
          Wrap(spacing: 10, runSpacing: 10, crossAxisAlignment: WrapCrossAlignment.center, children: [
            KButton('Send to my group', small: true, icon: Icons.ios_share_rounded, onPressed: () => SharePlus.instance.share(ShareParams(text: meetText(spot), title: 'Meeting spot'))),
            KButton('Open in Maps', small: true, variant: ButtonVariant.soft, onPressed: () => _open(spot)),
            Tap(onTap: _clear, label: 'Clear the meeting spot', child: Padding(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8), child: Text('Clear', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: c.sub)))),
          ]),
        ],
      ]),
    );
  }
}
