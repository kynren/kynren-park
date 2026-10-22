import { useMemo, useState } from 'react';
import { PageBackdrop } from '../../components/ui/PageBackdrop';
import { ScrollView, View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import { Touchable } from '../../components/Touchable';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader } from '../../components/ui/Controls';
import { ScreenHeader } from '../../components/ui/Header';
import { Icon } from '../../components/ui/Icon';
import { Reveal } from '../../components/ui/Reveal';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { linkBooking, ticketDay, ticketIsPast, useTickets, type TicketItem } from '../../lib/tickets';
import { featureGradient, serif } from '../../lib/theme';
import { radius, useUI, type UIColors } from '../../lib/ui';

/** One ticket in the list: what it is, when, and whose; tapping opens the ticket itself. */
function TicketRow({ ticket, c, onPress }: { ticket: TicketItem; c: UIColors; onPress: () => void }) {
  const when = ticketDay(ticket.date);
  const meta = [when, ticket.priceName, ticket.holder].filter(Boolean).join(' · ');
  const used = !!ticket.status && /used|redeem|scanned/.test(ticket.status);
  return (
    <Card onPress={onPress} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: c.tint }]}>
        <Icon name="ticket" color={c.link} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={2}>{ticket.title}</Text>
        {meta ? <Text style={[styles.rowMeta, { color: c.sub }]} numberOfLines={2}>{meta}</Text> : null}
      </View>
      {used && (
        <View style={[styles.chip, { backgroundColor: c.tint }]}>
          <Text style={[styles.chipTxt, { color: c.sub }]}>Used</Text>
        </View>
      )}
      <Icon name="chevron" color={c.placeholder} size={18} />
    </Card>
  );
}

export default function TicketsScreen() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { c } = useUI();
  const { tickets, reload } = useTickets();
  const [linkRef, setLinkRef] = useState('');
  const [linking, setLinking] = useState(false);

  // Tickets for days still to come first (soonest first), then the ones whose day has passed (latest first).
  const { upcoming, past } = useMemo(() => {
    const when = (x: TicketItem) => (x.date ? new Date(x.date).getTime() || 0 : 0);
    const up = tickets.filter((x) => !ticketIsPast(x.date)).sort((a, b) => when(a) - when(b));
    const gone = tickets.filter((x) => ticketIsPast(x.date)).sort((a, b) => when(b) - when(a));
    return { upcoming: up, past: gone };
  }, [tickets]);

  const open = (x: TicketItem) => router.push(`/ticket/${encodeURIComponent(x.id)}`);

  async function link() {
    const reference = linkRef.trim();
    if (!reference) return;
    setLinking(true);
    try {
      await linkBooking(reference);
      setLinkRef('');
      await reload();
    } catch {
      Alert.alert('Couldn’t link that booking', 'Check the reference and try again.');
    } finally {
      setLinking(false);
    }
  }

  return (
    <KeyboardAvoid>
      <View style={[styles.screen, { backgroundColor: c.screen }]}>
        <PageBackdrop page="tickets" />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <ScreenHeader page="tickets" title={t('tickets.title')} subtitle="Tap a ticket to show it at the gate" colors={featureGradient.tickets} />

          <View style={styles.pad}>
            {/* Account */}
            <Card style={styles.account}>
              <View style={[styles.avatar, { backgroundColor: c.tint }]}>
                <Icon name="user" color={c.link} size={20} />
              </View>
              <Text style={[styles.accountName, { color: c.text }]} numberOfLines={2}>
                {user ? user.name || user.email : t('tickets.signInToBook')}
              </Text>
              <Touchable onPress={user ? logout : () => router.push('/auth')} hitSlop={8}>
                <Text style={[styles.link, { color: c.link }]}>{user ? t('common.signOut') : t('common.signIn')}</Text>
              </Touchable>
            </Card>
          </View>

          {tickets.length === 0 ? (
            <View style={styles.pad}>
              <Card style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: c.tint }]}>
                  <Icon name="ticket" color={c.link} size={28} />
                </View>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No tickets on this device yet</Text>
                <Text style={[styles.muted, { color: c.sub, textAlign: 'center' }]}>
                  Once your bookings are added, your tickets appear here as a list, and each opens as a scannable QR code that works even with no signal — so entry is never blocked by patchy Wi-Fi.
                </Text>
              </Card>
            </View>
          ) : (
            <>
              {upcoming.length > 0 && (
                <View style={{ marginTop: 26, gap: 12 }}>
                  <SectionHeader title={`Upcoming · ${upcoming.length}`} />
                  <View style={styles.list}>
                    {upcoming.map((x, i) => (
                      <Reveal key={x.id} index={i}>
                        <TicketRow ticket={x} c={c} onPress={() => open(x)} />
                      </Reveal>
                    ))}
                  </View>
                </View>
              )}
              {past.length > 0 && (
                <View style={{ marginTop: 26, gap: 12 }}>
                  <SectionHeader title="Past" />
                  <View style={styles.list}>
                    {past.map((x) => (
                      <TicketRow key={x.id} ticket={x} c={c} onPress={() => open(x)} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {user && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Already booked?" />
              <View style={[styles.pad, { marginTop: 12 }]}>
                <Button full variant="soft" label="Find my bookings by email" icon="search" onPress={() => router.push('/find-bookings')} />
                <Text style={[styles.muted, { color: c.sub, marginTop: 14, marginBottom: 8 }]}>Or enter a booking reference:</Text>
                <View style={styles.linkRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: c.card, color: c.text, borderColor: c.line }]}
                    value={linkRef}
                    onChangeText={setLinkRef}
                    placeholder="Your booking reference"
                    placeholderTextColor={c.placeholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Button label="Link" size="sm" loading={linking} onPress={link} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoid>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pad: { paddingHorizontal: 20, marginTop: 20 },
  list: { paddingHorizontal: 20, gap: 12 },
  muted: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  accountName: { flex: 1, fontWeight: '700', fontSize: 15 },
  link: { fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', padding: 24, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontWeight: '800', fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  rowIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: serif, fontSize: 16, fontWeight: '700', lineHeight: 21 },
  rowMeta: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipTxt: { fontSize: 11.5, fontWeight: '800' },
  linkRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: radius.field, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15 },
});
