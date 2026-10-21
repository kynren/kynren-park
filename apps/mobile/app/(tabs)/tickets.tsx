import { useCallback, useState } from 'react';
import { ScrollView, View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { Touchable } from '../../components/Touchable';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { poundsFromCents } from '../../lib/format';
import { theme } from '../../lib/theme';

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

function SmeetzOrderCard({ o }: { o: SmeetzLinkedOrder }) {
  const order = o.order;
  const lines = order?.lines ?? [];
  return (
    <View style={styles.ticket}>
      <Text style={styles.ticketType}>Smeetz booking</Text>
      <Text style={styles.muted}>
        {o.reference}
        {order?.placedAt ? ` · booked ${day(order.placedAt)}` : ''}
      </Text>
      {order?.liveTickets != null && (
        <Text style={styles.muted}>
          {order.liveTickets} ticket{order.liveTickets === 1 ? '' : 's'}
          {order.nights?.length ? ` · ${order.nights.map(day).join(', ')}` : ''}
          {order.status ? ` · ${order.status.toLowerCase()}` : ''}
        </Text>
      )}
      {!order && <Text style={[styles.muted, { marginTop: 6 }]}>Couldn’t refresh this booking right now.</Text>}
      {lines.map((line, i) =>
        line.kind === 'TICKET' ? (
          line.tickets
            .filter((tk) => tk.barcode && !DEAD.test(tk.status ?? ''))
            .map((tk) => (
              <View key={tk.barcode} style={styles.smeetzTicket}>
                <View style={styles.qrBox}>
                  <QRCode value={tk.barcode as string} size={120} />
                </View>
                <Text style={styles.ticketType}>{line.name}</Text>
                <Text style={styles.muted}>
                  {[line.priceName, tk.night ? day(tk.night) : null, tk.holder].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ))
        ) : (
          <Text key={i} style={styles.muted}>
            {line.quantity} × {line.name}
          </Text>
        ),
      )}
    </View>
  );
}

export default function TicketsScreen() {
  const { bundle } = useSync();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
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
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.h1}>{t('tickets.title')}</Text>

      {/* Account */}
      <View style={styles.account}>
        {user ? (
          <>
            <Text style={styles.accountName}>👤 {user.name || user.email}</Text>
            <Touchable onPress={logout}>
              <Text style={styles.link}>{t('common.signOut')}</Text>
            </Touchable>
          </>
        ) : (
          <>
            <Text style={styles.muted}>{t('tickets.signInToBook')}</Text>
            <Touchable onPress={() => router.push('/auth')}>
              <Text style={styles.link}>{t('common.signIn')}</Text>
            </Touchable>
          </>
        )}
      </View>

      <Touchable style={styles.langRow} onPress={() => router.push('/language')}>
        <Text style={styles.langText}>🌐 {t('common.language')}</Text>
        <Text style={styles.chev}>›</Text>
      </Touchable>

      <Touchable
        style={styles.cta}
        onPress={() => router.push(user ? '/book' : '/auth')}
      >
        <Text style={styles.ctaText}>{t('tickets.book')}</Text>
      </Touchable>

      {tickets.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tickets on this device yet</Text>
          <Text style={styles.muted}>
            Once you book, your tickets appear here as scannable QR codes that work even with no signal
            — so entry is never blocked by patchy Wi-Fi.
          </Text>
        </View>
      ) : (
        tickets.map((t) => (
          <View key={t.id} style={styles.ticket}>
            <View style={styles.qrBox}>
              <QRCode value={t.qrToken} size={140} />
            </View>
            <Text style={styles.ticketType}>{t.ticketType}</Text>
            <Text style={styles.muted}>{t.reference} · {t.visitDate}</Text>
            <Touchable style={styles.wallet} onPress={() => Alert.alert('Add to Wallet', 'Apple/Google Wallet passes require signing certificates and are configured server-side (coming in a later release). Your offline QR above already works for entry.')}>
              <Text style={styles.walletText}>Add to Apple / Google Wallet</Text>
            </Touchable>
          </View>
        ))
      )}

      {user && (
        <>
          <Text style={styles.h2}>Booked via Smeetz?</Text>
          <Touchable style={styles.cta} onPress={() => router.push('/smeetz-link')}>
            <Text style={styles.ctaText}>Find my bookings by email</Text>
          </Touchable>
          <Text style={[styles.muted, { marginBottom: 6 }]}>Or enter a booking reference:</Text>
          <View style={styles.linkRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={linkRef}
              onChangeText={setLinkRef}
              placeholder="Enter your Smeetz order reference"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Touchable style={styles.linkBtn} onPress={linkSmeetzOrder} disabled={linking}>
              <Text style={styles.linkBtnText}>{linking ? '…' : 'Link'}</Text>
            </Touchable>
          </View>
          {smeetzOrders.map((o) => (
            <SmeetzOrderCard key={o.reference} o={o} />
          ))}
        </>
      )}

      <Text style={styles.h2}>{t('tickets.prices')}</Text>
      {(bundle?.ticketTypes ?? []).map((tt) => (
        <View key={tt.id} style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.priceName}>{tt.name}</Text>
            {tt.description && <Text style={styles.muted}>{tt.description}</Text>}
          </View>
          <Text style={styles.price}>{poundsFromCents(tt.priceCents)}</Text>
        </View>
      ))}
      <Text style={[styles.muted, { marginTop: 14, textAlign: 'center' }]}>
        Advance Saver prices. Book online to secure your day — capacity is limited.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800', color: theme.ink, marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 24, marginBottom: 10 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 4 },
  account: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border },
  accountName: { fontWeight: '700', color: theme.ink },
  link: { color: theme.brand, fontWeight: '700' },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginTop: 10 },
  langText: { color: theme.ink, fontWeight: '600', fontSize: 14 },
  chev: { color: theme.muted, fontSize: 20 },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 12, marginBottom: 6 },
  smeetzTicket: { alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, alignSelf: 'stretch' },
  linkRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, color: theme.ink },
  linkBtn: { backgroundColor: theme.brand, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16 },
  linkBtnText: { color: '#fff', fontWeight: '700' },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { backgroundColor: theme.card, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: theme.border, marginTop: 10 },
  emptyTitle: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  ticket: { backgroundColor: theme.card, borderRadius: 14, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: theme.border, marginTop: 14 },
  qrBox: { padding: 12, backgroundColor: '#fff', borderRadius: 10 },
  ticketType: { fontWeight: '800', color: theme.ink, fontSize: 16, marginTop: 12 },
  wallet: { marginTop: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  walletText: { color: theme.ink, fontSize: 13, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8 },
  priceName: { fontWeight: '600', color: theme.ink, fontSize: 15 },
  price: { fontWeight: '800', color: theme.brand, fontSize: 16 },
});
