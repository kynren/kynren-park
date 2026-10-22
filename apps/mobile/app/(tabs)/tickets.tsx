import { PageBackdrop } from '../../components/ui/PageBackdrop';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import { Touchable } from '../../components/Touchable';
import { Button } from '../../components/ui/Button';
import { Card, SectionHeader } from '../../components/ui/Controls';
import { GradientFill } from '../../components/ui/Gradient';
import { ScreenHeader } from '../../components/ui/Header';
import { Icon } from '../../components/ui/Icon';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { poundsFromCents } from '../../lib/format';
import { serif, featureGradient } from '../../lib/theme';
import { radius, shadow, useUI } from '../../lib/ui';

interface CachedTicket {
  id: string;
  reference: string;
  ticketType: string;
  visitDate: string;
  qrToken: string;
}

interface GuestTicket {
  barcode: string | null;
  status: string | null;
  night: string | null;
  holder: string | null;
}
interface GuestLine {
  kind: string;
  name: string;
  priceName: string | null;
  quantity: number;
  tickets: GuestTicket[];
}
interface GuestOrder {
  reference: string;
  status: string;
  placedAt: string;
  currency: string;
  valueTotal: number;
  liveTickets: number;
  nights: string[];
  lines: GuestLine[];
}
interface SmeetzLinkedOrder {
  reference: string;
  source: string;
  linkedAt: string;
  order: Partial<GuestOrder> | null;
}

const DEAD = /CANCEL|REFUND|VOID|EXPIRE/i;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** A paper ticket: a parchment top with what it is and when, then the QR on white, big enough to scan from a phone held at the gate. */
function PassCard({ title, subtitle, code, footer, children }: { title: string; subtitle?: string; code: string; footer?: string; children?: ReactNode }) {
  const { c, dark } = useUI();
  return (
    <View style={[styles.pass, shadow(2, dark), { backgroundColor: c.card }]}>
      <View style={[styles.passTop, { backgroundColor: c.soft }]}>
        <Text style={[styles.passLabel, { color: c.accent }]}>ENTRANCE TICKET</Text>
        <Text style={[styles.passTitle, { color: c.text }]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[styles.passSub, { color: c.sub }]} numberOfLines={2}>{subtitle}</Text> : null}
        <View style={[styles.passRule, { backgroundColor: c.accent }]} />
      </View>
      <View style={styles.tear}>
        <View style={[styles.notch, { left: -12, backgroundColor: c.screen }]} />
        <View style={[styles.dash, { borderColor: c.line }]} />
        <View style={[styles.notch, { right: -12, backgroundColor: c.screen }]} />
      </View>
      <View style={styles.passBody}>
        <View style={styles.qrBox}>
          <QRCode value={code} size={196} />
        </View>
        {footer ? <Text style={[styles.passFoot, { color: c.sub }]}>{footer}</Text> : null}
        {children}
      </View>
    </View>
  );
}

function SmeetzOrderCard({ o }: { o: SmeetzLinkedOrder }) {
  const { c } = useUI();
  const order = o.order;
  const lines = order?.lines ?? [];
  const summary = [
    order?.liveTickets != null ? `${order.liveTickets} ticket${order.liveTickets === 1 ? '' : 's'}` : null,
    order?.nights?.length ? order.nights.map(day).join(', ') : null,
    order?.status ? order.status.toLowerCase() : null,
  ].filter(Boolean).join(' · ');
  const passes = lines.flatMap((line) =>
    line.kind === 'TICKET' ? line.tickets.filter((tk) => tk.barcode && !DEAD.test(tk.status ?? '')).map((tk) => ({ line, tk })) : [],
  );
  const extras = lines.filter((l) => l.kind !== 'TICKET');

  return (
    <View style={{ gap: 16 }}>
      <Card style={styles.orderHead}>
        <Text style={[styles.orderTitle, { color: c.text }]}>Booking</Text>
        <Text style={[styles.muted, { color: c.sub }]}>
          {o.reference}
          {order?.placedAt ? ` · booked ${day(order.placedAt)}` : ''}
        </Text>
        {summary ? <Text style={[styles.muted, { color: c.sub }]}>{summary}</Text> : null}
        {!order && <Text style={[styles.muted, { color: c.sub, marginTop: 6 }]}>Couldn’t refresh this booking right now.</Text>}
        {extras.map((line, i) => (
          <Text key={i} style={[styles.muted, { color: c.sub }]}>{line.quantity} × {line.name}</Text>
        ))}
      </Card>
      {passes.map(({ line, tk }) => (
        <PassCard
          key={tk.barcode as string}
          title={line.name}
          subtitle={[line.priceName, tk.night ? day(tk.night) : null].filter(Boolean).join(' · ')}
          code={tk.barcode as string}
          footer={tk.holder ?? undefined}
        />
      ))}
    </View>
  );
}

export default function TicketsScreen() {
  const { bundle } = useSync();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const { c } = useUI();
  const [tickets, setTickets] = useState<CachedTicket[]>([]);
  const [smeetzOrders, setSmeetzOrders] = useState<SmeetzLinkedOrder[]>([]);
  const [linkRef, setLinkRef] = useState('');
  const [linking, setLinking] = useState(false);

  // Reload cached tickets whenever the tab regains focus (e.g. after booking).
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('kynren_tickets').then((raw) => setTickets(raw ? JSON.parse(raw) : []));
      if (user) {
        // Show what is stored at once, then look again for bookings made since.
        const load = () => api<SmeetzLinkedOrder[]>('/smeetz/my-orders').then(setSmeetzOrders);
        load().catch(() => undefined);
        api('/smeetz/refresh', { method: 'POST' }).then(load).catch(() => undefined);
      } else {
        setSmeetzOrders([]);
      }
    }, [user]),
  );

  async function linkSmeetzOrder() {
    const reference = linkRef.trim();
    if (!reference) return;
    setLinking(true);
    try {
      await api('/smeetz/link', { method: 'POST', body: JSON.stringify({ reference }) });
      setLinkRef('');
      const orders = await api<SmeetzLinkedOrder[]>('/smeetz/my-orders');
      setSmeetzOrders(orders);
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
          <ScreenHeader page="tickets" title={t('tickets.title')} subtitle="Your QR passes, ready at the gate" colors={featureGradient.tickets} />

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

            {/* Tickets on this device */}
            {tickets.length === 0 ? (
              <Card style={styles.empty}>
                <View style={[styles.emptyIcon, { backgroundColor: c.tint }]}>
                  <Icon name="ticket" color={c.link} size={28} />
                </View>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No tickets on this device yet</Text>
                <Text style={[styles.muted, { color: c.sub, textAlign: 'center' }]}>
                  Once your bookings are added, your tickets appear here as scannable QR codes that work even with no signal — so entry is never blocked by patchy Wi-Fi.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: 16, marginTop: 20 }}>
                {tickets.map((tk) => (
                  <PassCard key={tk.id} title={tk.ticketType} subtitle={tk.visitDate} code={tk.qrToken} footer={tk.reference}>
                    <Touchable
                      style={styles.wallet}
                      onPress={() => Alert.alert('Add to Wallet', 'Apple/Google Wallet passes require signing certificates and are configured server-side (coming in a later release). Your offline QR above already works for entry.')}
                    >
                      <Text style={[styles.walletText, { color: c.link }]}>Add to Apple / Google Wallet</Text>
                    </Touchable>
                  </PassCard>
                ))}
              </View>
            )}
          </View>

          {user && smeetzOrders.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <SectionHeader title="Your bookings" />
              <View style={[styles.pad, { marginTop: 12, gap: 20 }]}>
                {smeetzOrders.map((o) => (
                  <SmeetzOrderCard key={o.reference} o={o} />
                ))}
              </View>
            </View>
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
                  <Button label="Link" size="sm" loading={linking} onPress={linkSmeetzOrder} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoid>
  );
}

const NOTCH = 24;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pad: { paddingHorizontal: 20, marginTop: 20 },
  muted: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  accountName: { flex: 1, fontWeight: '700', fontSize: 15 },
  link: { fontWeight: '700', fontSize: 14 },
  empty: { alignItems: 'center', padding: 24, marginTop: 20, gap: 8 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontWeight: '800', fontSize: 16 },
  pass: { borderRadius: 24, overflow: 'hidden' },
  passTop: { paddingHorizontal: 22, paddingVertical: 20 },
  passLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 2.5, marginBottom: 6 },
  passTitle: { fontFamily: serif, fontSize: 18.5, fontWeight: '700' },
  passSub: { fontSize: 13.5, marginTop: 4 },
  passRule: { height: 2, width: 44, borderRadius: 1, marginTop: 14 },
  tear: { height: NOTCH, justifyContent: 'center' },
  notch: { position: 'absolute', top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  dash: { marginHorizontal: NOTCH, borderTopWidth: 1.5, borderStyle: 'dashed' },
  passBody: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 22, paddingTop: 2 },
  qrBox: { padding: 14, backgroundColor: '#ffffff', borderRadius: radius.card },
  passFoot: { fontSize: 13.5, fontWeight: '600', marginTop: 14 },
  wallet: { marginTop: 10, paddingVertical: 6 },
  walletText: { fontSize: 13.5, fontWeight: '700' },
  orderHead: { padding: 16 },
  orderTitle: { fontWeight: '800', fontSize: 16 },
  linkRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: radius.field, paddingVertical: 12, paddingHorizontal: 14, fontSize: 15 },
  priceRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  priceName: { fontWeight: '700', fontSize: 15 },
  price: { fontWeight: '800', fontSize: 17 },
});
