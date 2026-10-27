import 'dart:async';
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/api.dart';
import '../core/auth.dart';
import '../core/calendar.dart';
import '../core/format.dart';
import '../core/i18n.dart';
import '../core/sync.dart';
import '../core/theme.dart';
import '../core/ticket_share.dart';
import '../core/tickets.dart';
import '../ui/controls.dart';
import '../ui/pass_card.dart';
import '../ui/reveal.dart';
import '../ui/screen.dart';
import '../ui/tap.dart';
import 'ticket_gate.dart';

/// Loads the tickets for the signed-in guest when a ticket screen opens and when they sign in or out.
mixin _TicketsLoader<T extends StatefulWidget> on State<T> {
  String? _loadedFor = '';

  void ensureTickets(AuthUser? user) {
    if (_loadedFor == user?.id) return;
    _loadedFor = user?.id;
    WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? context.read<TicketsState>().load(user) : null);
  }
}

/// Asks what to call a ticket ("Mum", "Jack"): bookings often carry no holder name, and a name makes a family's tickets easy to tell apart.
Future<void> _editName(BuildContext context, TicketsState state, TicketItem t) async {
  final saved = await showDialog<String>(context: context, builder: (_) => _NameDialog(initial: state.labels[t.id] ?? ''));
  if (saved != null) await state.setLabel(t.id, saved);
}

/// The dialog owns its text box, so the box lives exactly as long as the dialog does (including while it fades away).
class _NameDialog extends StatefulWidget {
  final String initial;
  const _NameDialog({required this.initial});
  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  late final TextEditingController _ctl = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _ctl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Who is this ticket for?'),
        content: TextField(controller: _ctl, autofocus: true, maxLength: 40, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(hintText: 'For example Mum, or Jack')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          if (widget.initial.isNotEmpty) TextButton(onPressed: () => Navigator.pop(context, ''), child: const Text('Remove name')),
          TextButton(onPressed: () => Navigator.pop(context, _ctl.text), child: const Text('Save')),
        ],
      );
}

/// A warning above a ticket: already scanned (red), or for another day (amber).
class _NoticeBanner extends StatelessWidget {
  final TicketNotice notice;
  const _NoticeBanner(this.notice);

  @override
  Widget build(BuildContext context) {
    final colour = notice.serious ? const Color(0xFFB3261E) : const Color(0xFF8A5A00);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: colour.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14), border: Border.all(color: colour.withValues(alpha: 0.4))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(notice.serious ? Icons.error_outline_rounded : Icons.info_outline_rounded, size: 19, color: colour),
        const SizedBox(width: 10),
        Expanded(child: Text(notice.text, style: TextStyle(fontSize: 13.5, height: 19 / 13.5, fontWeight: FontWeight.w700, color: colour))),
      ]),
    );
  }
}

/// One ticket in the list: what it is, when, and whose; tapping opens the ticket itself.
class _TicketRow extends StatelessWidget {
  final TicketItem ticket;
  final String? holder;
  final VoidCallback onTap;
  const _TicketRow({required this.ticket, required this.holder, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final meta = [ticketDay(ticket.date), ticket.priceName, holder].where((x) => x != null && x.isNotEmpty).join(' · ');
    final used = ticketIsUsed(ticket);
    final days = ticketDaysAway(ticket.date);
    final soon = !used && days != null && days >= 0 && days <= 30;
    return KCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        Container(width: 46, height: 46, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.confirmation_number_rounded, color: c.link, size: 22)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(ticket.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: Tokens.display, fontSize: 16, fontWeight: FontWeight.w700, height: 21 / 16, color: c.text)),
            if (meta.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(meta, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, height: 18 / 13, color: c.sub))),
          ]),
        ),
        if (used) ...[
          const SizedBox(width: 8),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)), child: Text('Used', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: c.sub))),
        ] else if (soon) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: days == 0 ? c.primary : c.tint, borderRadius: BorderRadius.circular(999)),
            child: Text(ticketCountdown(days), style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: days == 0 ? Colors.white : c.link)),
          ),
        ],
        const SizedBox(width: 8),
        Icon(Icons.chevron_right_rounded, color: c.placeholder, size: 20),
      ]),
    );
  }
}

class TicketsScreen extends StatefulWidget {
  const TicketsScreen({super.key});
  @override
  State<TicketsScreen> createState() => _TicketsScreenState();
}

class _TicketsScreenState extends State<TicketsScreen> with _TicketsLoader {
  final _ref = TextEditingController();
  bool _linking = false, _showPast = false;

  @override
  void dispose() {
    _ref.dispose();
    super.dispose();
  }

  Future<void> _link() async {
    final reference = _ref.text.trim();
    if (reference.isEmpty) return;
    final tickets = context.read<TicketsState>();
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _linking = true);
    try {
      await linkBooking(reference);
      _ref.clear();
      await tickets.reload();
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Couldn’t link that booking. Check the reference and try again.')));
    }
    if (mounted) setState(() => _linking = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final auth = context.watch<AuthState>();
    final user = auth.user;
    final t = context.watch<I18nState>().t;
    final state = context.watch<TicketsState>();
    final tickets = state.tickets;
    ensureTickets(user);

    // Tickets for days still to come first (soonest first), then the ones whose day has passed (latest first).
    int when(TicketItem x) => x.date == null ? 0 : (DateTime.tryParse(x.date!)?.millisecondsSinceEpoch ?? 0);
    final upcoming = tickets.where((x) => !ticketIsPast(x.date)).toList()..sort((a, b) => when(a).compareTo(when(b)));
    final past = tickets.where((x) => ticketIsPast(x.date)).toList()..sort((a, b) => when(b).compareTo(when(a)));
    void open(TicketItem x) => context.push('/ticket/${Uri.encodeComponent(x.id)}');

    // Tickets for today that have not been used: the ones the guest is about to hold up at the gate.
    final today = tickets.where((x) => ticketDaysAway(x.date) == 0 && !ticketIsUsed(x)).toList();

    // A booking with several tickets gets a caption over its first one, so a family's tickets read as a set.
    Widget list(List<TicketItem> items, {bool reveal = false}) {
      final perBooking = <String, int>{};
      for (final x in items) {
        if (x.reference.isNotEmpty) perBooking[x.reference] = (perBooking[x.reference] ?? 0) + 1;
      }
      final captioned = <String>{};
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(children: [
          for (var i = 0; i < items.length; i++) ...[
            if ((perBooking[items[i].reference] ?? 0) > 1 && captioned.add(items[i].reference))
              Padding(
                padding: EdgeInsets.only(bottom: 8, top: i == 0 ? 0 : 4),
                child: Align(alignment: Alignment.centerLeft, child: Text('BOOKING ${items[i].reference} · ${perBooking[items[i].reference]} TICKETS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.2, color: c.sub))),
              ),
            Padding(padding: const EdgeInsets.only(bottom: 12), child: reveal ? Reveal(index: i, child: _TicketRow(ticket: items[i], holder: state.holderFor(items[i]), onTap: () => open(items[i]))) : _TicketRow(ticket: items[i], holder: state.holderFor(items[i]), onTap: () => open(items[i]))),
          ],
        ]),
      );
    }

    return KScreen(
      title: t('tickets.title'),
      subtitle: 'Tap a ticket to show it at the gate',
      page: 'tickets',
      back: false,
      padded: false,
      colors: featureGradient['tickets'],
      onRefresh: user == null ? null : () => context.read<TicketsState>().refresh(),
      children: [
        if (today.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: featureGradient['tickets']!), borderRadius: BorderRadius.circular(24)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('TODAY', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 2, color: Color(0xCCFFFFFF))),
                const SizedBox(height: 6),
                Text(today.length == 1 ? today.first.title : '${today.length} tickets for today', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontFamily: Tokens.display, fontSize: 21, fontWeight: FontWeight.w800, height: 1.2, color: Colors.white)),
                const SizedBox(height: 14),
                Tap(
                  onTap: () => openGateMode(context, today, 0),
                  label: 'Show today’s tickets at the gate',
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.qr_code_2_rounded, color: featureGradient['tickets']![0], size: 20),
                      const SizedBox(width: 8),
                      Text('Show at the gate', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: featureGradient['tickets']![0])),
                    ]),
                  ),
                ),
              ]),
            ),
          ),
        Padding(
          padding: EdgeInsets.fromLTRB(20, today.isNotEmpty ? 14 : 20, 20, 0),
          child: KCard(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Container(width: 38, height: 38, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.person_rounded, color: c.link, size: 20)),
              const SizedBox(width: 12),
              Expanded(child: Text(user != null ? ((user.name?.isNotEmpty ?? false) ? user.name! : (user.email ?? '')) : t('tickets.signInToBook'), maxLines: 2, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: c.text))),
              Tap(
                onTap: user != null ? () => context.read<AuthState>().logout() : () => context.push('/auth'),
                child: Text(user != null ? t('common.signOut') : t('common.signIn'), style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: c.link)),
              ),
            ]),
          ),
        ),
        if (tickets.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: KCard(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                Container(width: 60, height: 60, decoration: BoxDecoration(color: c.tint, shape: BoxShape.circle), child: Icon(Icons.confirmation_number_rounded, color: c.link, size: 28)),
                const SizedBox(height: 12),
                Text('No tickets on this device yet', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: c.text)),
                const SizedBox(height: 8),
                Text('Once your bookings are added, your tickets appear here as a list, and each opens as a scannable QR code that works even with no signal — so entry is never blocked by patchy Wi-Fi.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, height: 18 / 13, color: c.sub)),
              ]),
            ),
          )
        else ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
            child: Row(children: [
              Icon(Icons.offline_pin_rounded, size: 15, color: c.sub),
              const SizedBox(width: 6),
              Expanded(child: Text(state.updatedAt == null ? 'Saved on this phone: opens without signal' : 'Saved on this phone: opens without signal · updated ${fmtRelative(state.updatedAt)}', style: TextStyle(fontSize: 12, color: c.sub))),
            ]),
          ),
          if (upcoming.isNotEmpty) ...[
            const SizedBox(height: 26),
            SectionHeader('Upcoming · ${upcoming.length}'),
            const SizedBox(height: 12),
            list(upcoming, reveal: true),
          ],
          if (past.isNotEmpty) ...[
            const SizedBox(height: 26),
            SectionHeader('Past · ${past.length}', action: _showPast ? 'Hide' : 'Show', onAction: () => setState(() => _showPast = !_showPast)),
            const SizedBox(height: 12),
            if (_showPast) list(past),
          ],
        ],
        if (user != null) ...[
          const SizedBox(height: 28),
          const SectionHeader('Already booked?'),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              KButton('Find my bookings by email', full: true, variant: ButtonVariant.soft, icon: Icons.search_rounded, onPressed: () => context.push('/find-bookings')),
              Padding(padding: const EdgeInsets.only(top: 14, bottom: 8), child: Text('Or enter a booking reference:', style: TextStyle(fontSize: 13, height: 18 / 13, color: c.sub))),
              Row(children: [
                Expanded(child: KTextField(hint: 'Your booking reference', controller: _ref, capitalization: TextCapitalization.characters)),
                const SizedBox(width: 10),
                KButton('Link', small: true, loading: _linking, onPressed: _link),
              ]),
            ]),
          ),
        ],
      ],
    );
  }
}

/// One ticket on its own: the big QR to hold up at the gate, and everything about it underneath.
class TicketScreen extends StatefulWidget {
  final String id;
  const TicketScreen({super.key, required this.id});
  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> with _TicketsLoader {
  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    final state = context.watch<TicketsState>();
    ensureTickets(user);
    final ticket = state.tickets.where((x) => x.id == widget.id).firstOrNull;
    final siblings = ticket == null ? <TicketItem>[] : ticketsInBooking(state.tickets, ticket);
    final entrance = context.watch<SyncState>().bundle?.pois.where((p) => p.type == 'ENTRANCE').firstOrNull;
    final days = ticket == null ? null : ticketDaysAway(ticket.date);
    final notice = ticket == null ? null : ticketNotice(ticket);
    final parking = context.watch<SyncState>().bundle?.pois.where((p) => p.type == 'PARKING').firstOrNull;
    final messenger = ScaffoldMessenger.of(context);
    void say(String text) => messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text)));

    final rows = ticket == null
        ? <(String, String?)>[]
        : [
            ('Ticket', ticket.title),
            ('Type', ticket.priceName),
            ('Date', ticketDay(ticket.date)),
            ('Name', state.holderFor(ticket) ?? 'Add a name'),
            ('Booking', ticket.reference),
            ('Ticket code', ticket.shortCode),
            ('Status', ticket.status != null && ticket.status!.isNotEmpty ? ticket.status![0].toUpperCase() + ticket.status!.substring(1) : 'Valid'),
            ('Booked on', ticketDay(ticket.bookedOn)),
          ].where((r) => r.$2 != null && r.$2!.isNotEmpty).toList();

    return KScreen(
      title: 'Your ticket',
      subtitle: ticket?.title,
      page: 'tickets',
      colors: featureGradient['tickets'],
      children: [
        if (ticket != null) ...[
          if (notice != null) _NoticeBanner(notice),
          PassCard(
            title: ticket.title,
            subtitle: [ticketDay(ticket.date), ticket.priceName].where((x) => x != null && x.isNotEmpty).join(' · '),
            code: ticket.code,
            footer: state.holderFor(ticket),
            qrSize: 200,
            child: ticket.isPark
                ? Tap(
                    onTap: () => showDialog(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Add to Wallet'),
                        content: const Text('Apple/Google Wallet passes require signing certificates and are configured server-side (coming in a later release). Your offline QR above already works for entry.'),
                        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
                      ),
                    ),
                    child: Padding(padding: const EdgeInsets.only(top: 10), child: Text('Add to Apple / Google Wallet', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: c.link))),
                  )
                : null,
          ),
          if (days != null && days >= 0)
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(color: days == 0 ? c.primary : c.tint, borderRadius: BorderRadius.circular(999)),
                child: Text(days == 0 ? 'Your visit is today' : 'Your visit is ${ticketCountdown(days).toLowerCase()}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: days == 0 ? Colors.white : c.link)),
              ),
            ),
          Text('Hold this up at the gate. It works with no signal.', textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: c.sub)),
          Row(children: [
            Expanded(child: KButton('Full screen', small: true, full: true, icon: Icons.fullscreen_rounded, onPressed: () => openGateMode(context, siblings, siblings.indexWhere((x) => x.id == ticket.id)))),
            const SizedBox(width: 10),
            Expanded(
              child: KButton('Share', small: true, full: true, variant: ButtonVariant.soft, icon: Icons.ios_share_rounded, onPressed: () async {
                try {
                  await shareTicket(ticket, holder: state.holderFor(ticket));
                } catch (_) {
                  say('Couldn’t open the share sheet. Try again.');
                }
              }),
            ),
          ]),
          if (siblings.length > 1)
            KButton('Share all ${siblings.length} tickets', small: true, full: true, variant: ButtonVariant.soft, icon: Icons.group_outlined, onPressed: () async {
              try {
                await shareTickets(siblings, holderFor: state.holderFor);
              } catch (_) {
                say('Couldn’t open the share sheet. Try again.');
              }
            }),
          Row(children: [
            if (ticketIcs(ticket) != null && (days == null || days >= 0)) ...[
              Expanded(
                child: KButton('Add to calendar', small: true, full: true, variant: ButtonVariant.soft, icon: Icons.event_available_outlined, onPressed: () async {
                  try {
                    await shareIcs(ticketIcs(ticket)!, fileName: 'kynren-${ticket.date}', title: ticket.title);
                  } catch (_) {
                    say('Couldn’t open your calendar. Try again.');
                  }
                }),
              ),
              const SizedBox(width: 10),
            ],
            if (entrance != null) Expanded(child: KButton('Find the entrance', small: true, full: true, variant: ButtonVariant.soft, icon: Icons.place_outlined, onPressed: () => context.go('/map?focus=${entrance.id}'))),
          ]),
          KCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Column(children: [
              for (var i = 0; i < rows.length; i++)
                Tap(
                  // the booking reference is what the box office asks for: one tap copies it
                  onTap: rows[i].$1 == 'Booking'
                      ? () {
                          Clipboard.setData(ClipboardData(text: rows[i].$2!));
                          say('Booking reference copied');
                        }
                      : rows[i].$1 == 'Name'
                          ? () => _editName(context, state, ticket)
                          : null,
                  scaleTo: 0.99,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(border: i < rows.length - 1 ? Border(bottom: BorderSide(color: c.line, width: 0.5)) : null),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      SizedBox(width: 92, child: Text(rows[i].$1, style: TextStyle(fontSize: 13.5, color: c.sub))),
                      if (rows[i].$1 == 'Booking') Padding(padding: const EdgeInsets.only(right: 6, top: 2), child: Icon(Icons.copy_rounded, size: 14, color: c.link)),
                      if (rows[i].$1 == 'Name') Padding(padding: const EdgeInsets.only(right: 6, top: 2), child: Icon(Icons.edit_rounded, size: 14, color: c.link)),
                      Expanded(child: Text(rows[i].$2!, textAlign: TextAlign.right, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w600, color: c.text))),
                    ]),
                  ),
                ),
            ]),
          ),
          if (siblings.length > 1)
            KCard(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Tickets in this booking · ${siblings.length}', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: c.text)),
                const SizedBox(height: 4),
                for (final s in siblings)
                  Tap(
                    onTap: s.id == ticket.id ? null : () => context.pushReplacement('/ticket/${Uri.encodeComponent(s.id)}'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(children: [
                        Icon(s.id == ticket.id ? Icons.radio_button_checked_rounded : Icons.radio_button_unchecked_rounded, size: 18, color: s.id == ticket.id ? c.link : c.placeholder),
                        const SizedBox(width: 10),
                        Expanded(child: Text([state.holderFor(s), s.priceName].where((x) => x != null && x.isNotEmpty).join(' · ').isEmpty ? s.title : [state.holderFor(s), s.priceName].where((x) => x != null && x.isNotEmpty).join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14, fontWeight: s.id == ticket.id ? FontWeight.w800 : FontWeight.w600, color: c.text))),
                        if (s.id != ticket.id) Icon(Icons.chevron_right_rounded, size: 18, color: c.placeholder),
                      ]),
                    ),
                  ),
              ]),
            ),
          if (days != null && days >= 0)
            KCard(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Before you go', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: c.text)),
                const SizedBox(height: 12),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final g in [
                    (label: 'Getting here', icon: Icons.directions_bus_rounded, go: () => context.push('/shuttle')),
                    if (parking != null) (label: 'Parking', icon: Icons.local_parking_rounded, go: () => context.go('/map?focus=${parking.id}')),
                    (label: 'Accessibility', icon: Icons.accessible_rounded, go: () => context.push('/accessibility')),
                    (label: 'Programme', icon: Icons.calendar_month_rounded, go: () => context.push('/shows')),
                    (label: 'Plan my day', icon: Icons.route_rounded, go: () => context.push('/plan')),
                  ])
                    Tap(
                      onTap: g.go,
                      label: g.label,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                        decoration: BoxDecoration(color: c.tint, borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(g.icon, size: 16, color: c.link),
                          const SizedBox(width: 6),
                          Text(g.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.link)),
                        ]),
                      ),
                    ),
                ]),
              ]),
            ),
          if (ticket.extras.isNotEmpty)
            KCard(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Also in this booking', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: c.text)),
                for (final e in ticket.extras) Padding(padding: const EdgeInsets.only(top: 4), child: Text(e, style: TextStyle(fontSize: 14, height: 20 / 14, color: c.sub))),
              ]),
            ),
        ] else if (state.loading)
          Text('Loading your ticket…', style: TextStyle(color: c.sub))
        else
          KCard(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('We can’t find that ticket', style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: c.text)),
              const SizedBox(height: 4),
              Text('It may have been cancelled, or belong to a different account.', style: TextStyle(fontSize: 14, height: 20 / 14, color: c.sub)),
              const SizedBox(height: 14),
              KButton('Back to my tickets', onPressed: () => context.go('/tickets')),
            ]),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------- Find bookings

const _resendSeconds = 60;

String _describe(Object error) {
  if (error is ApiError) {
    if (error.status == 429) return error.serverMessage ?? 'Too many tries. Please wait a little and try again.';
    if (error.status == 400) return error.serverMessage ?? 'That did not work. Check and try again.';
    if (error.status == 503) return 'Booking lookup is unavailable right now. Please try again shortly.';
  }
  return 'Something went wrong. Please try again.';
}

/// Pulls a guest's bookings into their account: they give the address they booked with, we email a code to it, and
/// entering the code proves it is theirs. Reached straight after sign-up (`setup`) and from the Tickets screen.
class FindBookingsScreen extends StatefulWidget {
  final String? email;
  final bool setup;
  const FindBookingsScreen({super.key, this.email, this.setup = false});
  @override
  State<FindBookingsScreen> createState() => _FindBookingsScreenState();
}

class _FindBookingsScreenState extends State<FindBookingsScreen> {
  String _step = 'email';
  late final TextEditingController _email = TextEditingController(text: widget.email ?? '');
  final _code = TextEditingController();
  String _error = '';
  bool _busy = false;
  int _wait = 0, _linked = 0;
  Timer? _timer;
  bool _prefilled = false;

  @override
  void dispose() {
    _timer?.cancel();
    _email.dispose();
    _code.dispose();
    super.dispose();
  }

  void _startWait() {
    _wait = _resendSeconds;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_wait <= 1) t.cancel();
      if (mounted) setState(() => _wait = _wait > 0 ? _wait - 1 : 0);
    });
  }

  void _leave() {
    if (widget.setup) {
      context.go('/');
    } else if (context.canPop()) {
      context.pop();
    } else {
      context.go('/tickets');
    }
  }

  Future<void> _sendCode() async {
    setState(() => _error = '');
    if (!RegExp(r'^\S+@\S+\.\S+$').hasMatch(_email.text.trim())) {
      setState(() => _error = 'Enter the email address you booked with.');
      return;
    }
    setState(() => _busy = true);
    try {
      await api('/smeetz/email/request', method: 'POST', body: {'email': _email.text.trim()});
      _step = 'code';
      _startWait();
    } catch (e) {
      _error = _describe(e);
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _verify() async {
    setState(() {
      _error = '';
      _busy = true;
    });
    try {
      final res = await api('/smeetz/email/verify', method: 'POST', body: {'email': _email.text.trim(), 'code': _code.text}) as Map<String, dynamic>;
      _linked = (res['linked'] as num).toInt();
      _step = 'done';
      if (mounted) context.read<TicketsState>().reload();
    } catch (e) {
      _error = _describe(e);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.ui;
    final user = context.watch<AuthState>().user;
    if (!_prefilled && _email.text.isEmpty && user?.email != null) {
      _prefilled = true;
      _email.text = user!.email!;
    }
    TextStyle body(Color color) => TextStyle(fontSize: 15, height: 22 / 15, color: color);
    Widget link(String text, VoidCallback? onTap, {Color? color, double opacity = 1}) =>
        Tap(onTap: onTap, child: Opacity(opacity: opacity, child: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Center(child: Text(text, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: color ?? c.link))))));

    return KScreen(
      title: 'Find my bookings',
      subtitle: 'Bring your tickets into the app',
      page: 'bookings',
      colors: featureGradient['tickets'],
      onBack: _leave,
      children: [
        if (_step == 'email') ...[
          Text('Booked your tickets online? Enter the email address you booked with. If there are bookings under it, we’ll email you a 6-digit code to add them to your account.', style: body(c.sub)),
          KTextField(hint: 'you@example.com', controller: _email, keyboardType: TextInputType.emailAddress),
          KButton('Send code', full: true, loading: _busy, onPressed: _sendCode),
        ],
        if (_step == 'code') ...[
          Text('If there are bookings under ${_email.text.trim()}, we’ve emailed it a code. It works for 10 minutes. Nothing arrived? Check your spam folder — or there may be no bookings under that address.', style: body(c.sub)),
          TextField(
            controller: _code,
            autofocus: true,
            maxLength: 6,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            onChanged: (_) => setState(() {}),
            style: TextStyle(fontFamily: Tokens.display, fontSize: 23, letterSpacing: 8, fontWeight: FontWeight.w700, color: c.text),
            decoration: InputDecoration(
              counterText: '',
              hintText: '123456',
              filled: true,
              fillColor: c.card,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(Tokens.radiusField), borderSide: BorderSide(color: c.line)),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(Tokens.radiusField), borderSide: BorderSide(color: c.line)),
            ),
          ),
          KButton('Add my bookings', full: true, loading: _busy, onPressed: _code.text.length == 6 ? _verify : null),
          link(_wait > 0 ? 'Send a new code in ${_wait}s' : 'Send a new code', (_busy || _wait > 0) ? null : _sendCode, opacity: _wait > 0 ? 0.5 : 1),
          link('Use a different email', () => setState(() {
                _step = 'email';
                _code.clear();
                _error = '';
              })),
        ],
        if (_step == 'done') ...[
          Text('${_linked == 1 ? 'Added 1 booking' : 'Added $_linked bookings'} to your account. They’re on your Tickets tab.', style: body(c.text)),
          KButton(widget.setup ? 'Continue' : 'See my tickets', full: true, onPressed: () => widget.setup ? context.go('/') : context.go('/tickets')),
        ],
        if (_error.isNotEmpty) Text(_error, style: const TextStyle(color: Tokens.danger, fontSize: 14, fontWeight: FontWeight.w600)),
        if (_step != 'done') link(widget.setup ? 'Skip for now' : 'Cancel', _leave, color: c.sub),
      ],
    );
  }
}
