import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Touchable } from '../components/Touchable';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Controls';
import { Screen } from '../components/ui/Screen';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { poundsFromCents } from '../lib/format';
import { serif, featureGradient } from '../lib/theme';
import { useUI } from '../lib/ui';

interface BookingResult {
  reference: string;
  visitDate: string;
  tickets: { id: string; qrToken: string; ticketType: { name: string } }[];
}

export default function BookScreen() {
  const router = useRouter();
  const { c } = useUI();
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
    <Screen title="Buy tickets" colors={featureGradient.tickets}>
      <View>
        <Text style={[styles.h1, { color: c.text }]}>Book your visit</Text>
        <Text style={[styles.muted, { color: c.sub }]}>Visit date: {date}</Text>
      </View>

      {ticketTypes.map((t) => (
        <Card key={t.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: c.text }]}>{t.name}</Text>
            <Text style={[styles.price, { color: c.link }]}>{poundsFromCents(t.priceCents)}</Text>
          </View>
          <View style={styles.stepper}>
            <Touchable style={[styles.stepBtn, { backgroundColor: c.tint }]} onPress={() => bump(t.id, -1)} accessibilityLabel={`Fewer ${t.name}`} hitSlop={6}>
              <Text style={[styles.stepTxt, { color: c.link }]}>−</Text>
            </Touchable>
            <Text style={[styles.qty, { color: c.text }]}>{qty[t.id] ?? 0}</Text>
            <Touchable style={[styles.stepBtn, { backgroundColor: c.primary }]} onPress={() => bump(t.id, 1)} accessibilityLabel={`More ${t.name}`} hitSlop={6}>
              <Text style={[styles.stepTxt, { color: '#ffffff' }]}>+</Text>
            </Touchable>
          </View>
        </Card>
      ))}

      <View style={[styles.totalRow, { borderTopColor: c.line }]}>
        <Text style={[styles.totalLabel, { color: c.text }]}>Total</Text>
        <Text style={[styles.totalValue, { color: c.link }]}>{poundsFromCents(total)}</Text>
      </View>

      <Button
        full
        label={user ? `Confirm booking (${count})` : `Sign in to book (${count})`}
        onPress={book}
        loading={submitting}
        disabled={count === 0}
      />
      <Text style={[styles.note, { color: c.sub }]}>Demo checkout — no payment is taken. Tickets are issued instantly with offline QR codes.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: serif, fontSize: 24, fontWeight: '800' },
  muted: { fontSize: 14, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  name: { fontWeight: '700', fontSize: 15.5 },
  price: { fontWeight: '800', marginTop: 2, fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontFamily: serif, fontSize: 21, fontWeight: '700', lineHeight: 24 },
  qty: { minWidth: 20, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTopWidth: 1 },
  totalLabel: { fontSize: 16, fontWeight: '700' },
  totalValue: { fontFamily: serif, fontSize: 22, fontWeight: '800' },
  note: { fontSize: 12.5, textAlign: 'center' },
});
