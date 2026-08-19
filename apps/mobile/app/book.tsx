import { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Touchable } from '../components/Touchable';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { poundsFromCents } from '../lib/format';
import { theme } from '../lib/theme';

interface BookingResult {
  reference: string;
  visitDate: string;
  tickets: { id: string; qrToken: string; ticketType: { name: string } }[];
}

export default function BookScreen() {
  const router = useRouter();
  const { bundle, date } = useSync();
  const { user } = useAuth();
  const ticketTypes = bundle?.ticketTypes ?? [];
  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(
    () => ticketTypes.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.priceCents, 0),
    [qty, ticketTypes],
  );
  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  function bump(id: string, delta: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  }

  async function book() {
    const items = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    if (items.length === 0) return;
    // Ticket selection is open to everyone; an account is only actually
    // needed at the API to attach the booking to (POST /bookings requires
    // auth) — so only ask for it here, at confirm, not before a guest has
    // even seen what's on offer.
    if (!user) { router.push('/auth'); return; }

    setSubmitting(true);
    try {
      const booking = await api<BookingResult>('/bookings', {
        method: 'POST',
        body: JSON.stringify({ visitDate: date, items }),
      });
      // Cache tickets locally so they render as offline QR in the Tickets tab.
      const cached = booking.tickets.map((t) => ({
        id: t.id,
        reference: booking.reference,
        ticketType: t.ticketType.name,
        visitDate: booking.visitDate,
        qrToken: t.qrToken,
      }));
      const existingRaw = await AsyncStorage.getItem('kynren_tickets');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      await AsyncStorage.setItem('kynren_tickets', JSON.stringify([...cached, ...existing]));

      Alert.alert('Booking confirmed', `${booking.reference} — your tickets are saved to this device.`, [
        { text: 'View tickets', onPress: () => router.replace('/(tabs)/tickets') },
      ]);
    } catch {
      Alert.alert('Booking failed', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.h1}>Book your visit</Text>
      <Text style={styles.muted}>Visit date: {date}</Text>

      <View style={{ marginTop: 16, gap: 10 }}>
        {ticketTypes.map((t) => (
          <View key={t.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{t.name}</Text>
              <Text style={styles.price}>{poundsFromCents(t.priceCents)}</Text>
            </View>
            <View style={styles.stepper}>
              <Touchable style={styles.stepBtn} onPress={() => bump(t.id, -1)}>
                <Text style={styles.stepTxt}>−</Text>
              </Touchable>
              <Text style={styles.qty}>{qty[t.id] ?? 0}</Text>
              <Touchable style={styles.stepBtn} onPress={() => bump(t.id, 1)}>
                <Text style={styles.stepTxt}>+</Text>
              </Touchable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{poundsFromCents(total)}</Text>
      </View>

      <Touchable style={[styles.cta, count === 0 && { opacity: 0.5 }]} onPress={book} disabled={submitting || count === 0}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{user ? `Confirm booking (${count})` : `Sign in to book (${count})`}</Text>}
      </Touchable>
      <Text style={styles.note}>Demo checkout — no payment is taken. Tickets are issued instantly with offline QR codes.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.ink },
  muted: { color: theme.muted, fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border },
  name: { fontWeight: '600', color: theme.ink, fontSize: 15 },
  price: { color: theme.brand, fontWeight: '700', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 20, color: theme.ink, fontWeight: '700' },
  qty: { minWidth: 20, textAlign: 'center', fontSize: 16, fontWeight: '700', color: theme.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  totalLabel: { fontSize: 16, fontWeight: '700', color: theme.ink },
  totalValue: { fontSize: 20, fontWeight: '800', color: theme.brand },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 18 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
