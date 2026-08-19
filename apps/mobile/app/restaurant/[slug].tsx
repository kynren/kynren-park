import { useRef, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageCarousel } from '../../components/ImageCarousel';
import { CloseButton, IconBadge, TagChip, ActionPill, SectionLabel, ICONS, dk } from '../../components/DetailKit';
import { Touchable } from '../../components/Touchable';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtTimeUK, poundsFromCents } from '../../lib/format';
import { theme } from '../../lib/theme';

const HERO_HEIGHT = 340;
// How far ahead a guest can choose to pick up their order. The API stores
// whatever pickupSlot it's given with no server-side slot validation against
// opening hours (those are a freeform admin string, not structured data), so
// these are just sensible client-side choices, not a real availability check.
const PICKUP_OFFSETS_MIN = [15, 30, 45, 60, 90];

export default function RestaurantScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle } = useSync();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const restaurant = bundle?.restaurants.find((r) => r.slug === slug);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pickupOffset, setPickupOffset] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // scrollTo needs an offset relative to the whole scroll content, but
  // onLayout only reports a view's position relative to its own immediate
  // parent — sheetY (the "sheet" card's own position, a direct ScrollView
  // child) plus menuLocalY (the Menu marker's position within that card)
  // together give the real absolute offset, without needing measureLayout's
  // fragile-across-RN-versions node-handle API for what's a minor polish item.
  const sheetY = useRef(0);
  const menuLocalY = useRef(0);

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: dk.sub }}>Outlet not found.</Text>
      </View>
    );
  }

  const images = restaurant.images?.length ? restaurant.images : restaurant.heroImage ? [restaurant.heroImage] : [];
  const canOrder = restaurant.clickCollect !== false && restaurant.menuItems.length > 0;
  const count = Object.values(qty).reduce((a, b) => a + b, 0);
  const total = restaurant.menuItems.reduce((sum, m) => sum + (qty[m.id] ?? 0) * m.priceCents, 0);
  function bump(id: string, delta: number) {
    setQty((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + delta) }));
  }
  async function placeOrder() {
    if (!user) { router.push('/auth'); return; }
    const items = Object.entries(qty).filter(([, q]) => q > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    if (items.length === 0 || !restaurant) return;
    setSubmitting(true);
    try {
      const pickupDate = new Date(Date.now() + pickupOffset * 60000);
      await api('/orders', { method: 'POST', body: JSON.stringify({ restaurantId: restaurant.id, pickupSlot: pickupDate.toISOString(), items }) });
      setQty({});
      Alert.alert('Order placed', `We'll have it ready to collect around ${fmtTimeUK(pickupDate)}.`, [
        { text: 'Track order', onPress: () => router.push('/orders') },
        { text: 'OK', style: 'cancel' },
      ]);
    } catch {
      Alert.alert('Order failed', 'Something went wrong. Please try again.');
    }
    setSubmitting(false);
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', top: insets.top + 8, right: 14, zIndex: 10 }}><CloseButton onPress={() => router.back()} /></View>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {images.length > 0 ? (
          <ImageCarousel images={images} height={HERO_HEIGHT} />
        ) : (
          <View style={{ height: insets.top + 52 }} />
        )}

        <View style={[styles.sheet, images.length > 0 && styles.sheetOverlap]} onLayout={(e) => { sheetY.current = e.nativeEvent.layout.y; }}>
          <View style={styles.titleRow}>
            <IconBadge letter={restaurant.name[0]?.toUpperCase() ?? 'R'} />
            <Text style={styles.title}>{restaurant.name}</Text>
          </View>

          {restaurant.description ? <Text style={styles.desc}>{restaurant.description}</Text> : null}

          <View style={styles.tagRow}>
            {restaurant.cuisine ? <TagChip icon="🍴" label={restaurant.cuisine} /> : null}
          </View>

          <View style={styles.actionRow}>
            <ActionPill icon={ICONS.map} label="Go to" onPress={() => router.push(`/map?focus=${restaurant.id}`)} />
            <ActionPill icon={ICONS.menu} label="Menu" onPress={() => scrollRef.current?.scrollTo({ y: sheetY.current + menuLocalY.current - 12, animated: true })} />
          </View>

          {restaurant.openingHours ? (
            <>
              <SectionLabel>Schedules</SectionLabel>
              <View style={styles.hoursPill}><Text style={styles.hoursTxt}>From {restaurant.openingHours}</Text></View>
            </>
          ) : null}

          <View onLayout={(e) => { menuLocalY.current = e.nativeEvent.layout.y; }}>
            <SectionLabel>Menu</SectionLabel>
          </View>
          {restaurant.menuItems.length === 0 ? (
            <Text style={styles.muted}>Menu coming soon.</Text>
          ) : (
            restaurant.menuItems.map((m) => (
              <View key={m.id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{m.name}</Text>
                  {m.description && <Text style={styles.muted}>{m.description}</Text>}
                  {m.dietaryTags.length > 0 && (
                    <View style={styles.dietRow}>
                      {m.dietaryTags.map((t) => (
                        <Text key={t} style={styles.diet}>{t}</Text>
                      ))}
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Text style={styles.price}>{poundsFromCents(m.priceCents)}</Text>
                  {canOrder && (
                    <View style={styles.stepper}>
                      <Touchable style={styles.stepBtn} onPress={() => bump(m.id, -1)} hitSlop={6}><Text style={styles.stepTxt}>−</Text></Touchable>
                      <Text style={styles.stepQty}>{qty[m.id] ?? 0}</Text>
                      <Touchable style={styles.stepBtn} onPress={() => bump(m.id, 1)} hitSlop={6}><Text style={styles.stepTxt}>+</Text></Touchable>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}

          {canOrder ? (
            <>
              <SectionLabel>Order ahead</SectionLabel>
              <Text style={styles.muted}>Pick a collection time — pay at the outlet, no card needed now.</Text>
              <View style={styles.slotRow}>
                {PICKUP_OFFSETS_MIN.map((min) => (
                  <Touchable
                    key={min}
                    style={[styles.slotChip, pickupOffset === min && styles.slotChipOn]}
                    onPress={() => setPickupOffset(min)}
                  >
                    <Text style={[styles.slotChipTxt, pickupOffset === min && styles.slotChipTxtOn]}>
                      {fmtTimeUK(new Date(Date.now() + min * 60000))}
                    </Text>
                  </Touchable>
                ))}
              </View>
              {count > 0 && (
                <Touchable style={styles.orderCta} onPress={placeOrder} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.orderCtaTxt}>{user ? `Order ahead — ${poundsFromCents(total)}` : `Sign in to order — ${poundsFromCents(total)}`}</Text>}
                </Touchable>
              )}
            </>
          ) : (
            <Text style={styles.note}>Order ahead isn’t available here — pay at the outlet.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dk.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dk.bg },
  sheet: { backgroundColor: dk.sheet, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 },
  sheetOverlap: { marginTop: -22, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { flex: 1, color: dk.ink, fontSize: 24, fontWeight: '800' },
  desc: { color: dk.sub, fontSize: 14.5, lineHeight: 21, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  hoursPill: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, marginTop: 4 },
  hoursTxt: { color: '#111', fontWeight: '700', fontSize: 13.5 },
  item: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: dk.chip, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  itemName: { fontWeight: '700', color: dk.ink, fontSize: 15 },
  muted: { color: dk.sub, fontSize: 13, marginTop: 2 },
  dietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  diet: { fontSize: 11, color: '#7fd6ad', backgroundColor: 'rgba(127,214,173,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, textTransform: 'uppercase' },
  price: { color: dk.ink, fontWeight: '800', fontSize: 15 },
  note: { color: dk.sub, fontSize: 12, textAlign: 'center', marginTop: 20 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: dk.pill, alignItems: 'center', justifyContent: 'center' },
  stepTxt: { color: dk.ink, fontSize: 16, fontWeight: '700' },
  stepQty: { color: dk.ink, fontSize: 14, fontWeight: '700', minWidth: 14, textAlign: 'center' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  slotChip: { backgroundColor: dk.chip, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  slotChipOn: { backgroundColor: theme.brand },
  slotChipTxt: { color: dk.ink, fontWeight: '700', fontSize: 13 },
  slotChipTxtOn: { color: '#fff' },
  orderCta: { backgroundColor: theme.brand, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  orderCtaTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
