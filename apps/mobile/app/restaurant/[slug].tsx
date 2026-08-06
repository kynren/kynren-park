import { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { poundsFromCents } from '../../lib/format';
import { theme } from '../../lib/theme';

// Pickup slots offered for the visit day (park food hours ~11:00–16:30).
const SLOT_TIMES = ['11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '15:00', '16:00'];

export default function RestaurantScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle, date } = useSync();
  const { user } = useAuth();
  const router = useRouter();

  const restaurant = bundle?.restaurants.find((r) => r.slug === slug);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [slot, setSlot] = useState<string>(SLOT_TIMES[2]!);
  const [placing, setPlacing] = useState(false);

  const total = useMemo(() => {
    if (!restaurant) return 0;
    return restaurant.menuItems.reduce((sum, m) => sum + (cart[m.id] ?? 0) * m.priceCents, 0);
  }, [cart, restaurant]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.muted }}>Outlet not found.</Text>
      </View>
    );
  }

  function bump(id: string, delta: number) {
    setCart((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  }

  async function placeOrder() {
    if (!user) return router.push('/auth');
    const items = Object.entries(cart)
      .filter(([, q]) => q > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (items.length === 0) return;

    setPlacing(true);
    try {
      const pickupSlot = new Date(`${date}T${slot}:00.000Z`).toISOString();
      await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ restaurantId: restaurant!.id, pickupSlot, items }),
      });
      Alert.alert('Order placed 🎉', `Collect from ${restaurant!.name} at ${slot}. We’ll notify you when it’s ready.`, [
        { text: 'Track order', onPress: () => router.replace('/orders') },
      ]);
    } catch {
      Alert.alert('Order failed', 'Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
      <Stack.Screen options={{ title: restaurant.name }} />
      <Text style={styles.h1}>{restaurant.name}</Text>
      {restaurant.cuisine && <Text style={styles.cuisine}>{restaurant.cuisine}</Text>}

      <Text style={styles.section}>Menu</Text>
      {restaurant.menuItems.map((m) => (
        <View key={m.id} style={styles.item}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{m.name}</Text>
            {m.description && <Text style={styles.muted}>{m.description}</Text>}
            <View style={styles.tagRow}>
              <Text style={styles.price}>{poundsFromCents(m.priceCents)}</Text>
              {m.dietaryTags.map((t) => (
                <Text key={t} style={styles.tag}>{t}</Text>
              ))}
            </View>
          </View>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => bump(m.id, -1)}>
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <Text style={styles.qty}>{cart[m.id] ?? 0}</Text>
            <Pressable style={styles.stepBtn} onPress={() => bump(m.id, 1)}>
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Text style={styles.section}>Pickup time</Text>
      <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {SLOT_TIMES.map((t) => (
          <Pressable key={t} onPress={() => setSlot(t)} style={[styles.slot, slot === t && styles.slotOn]}>
            <Text style={[styles.slotTxt, slot === t && { color: '#fff' }]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {count > 0 && (
        <Pressable style={styles.cta} onPress={placeOrder} disabled={placing}>
          {placing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>
              Place order · {count} item{count > 1 ? 's' : ''} · {poundsFromCents(total)}
            </Text>
          )}
        </Pressable>
      )}
      <Text style={styles.note}>Demo checkout — no payment is taken.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 24, fontWeight: '800', color: theme.ink },
  cuisine: { color: theme.brand, fontWeight: '600', marginTop: 2 },
  section: { fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 22, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8, gap: 10 },
  itemName: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  price: { color: theme.brand, fontWeight: '800' },
  tag: { fontSize: 11, color: theme.ok, backgroundColor: '#e7f3ee', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, textTransform: 'uppercase' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { fontSize: 19, color: theme.ink, fontWeight: '700' },
  qty: { minWidth: 18, textAlign: 'center', fontSize: 15, fontWeight: '700', color: theme.ink },
  slot: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card },
  slotOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  slotTxt: { color: theme.ink, fontWeight: '700' },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 22 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  note: { color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 12 },
});
