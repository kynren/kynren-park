import { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseButton, IconBadge, TagChip, ActionPill, SectionLabel, DetailHero, SheetTitle, ICONS, useDK, type DK } from '../../components/DetailKit';
import { Touchable } from '../../components/Touchable';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtTimeUK, poundsFromCents } from '../../lib/format';
import { serif, featureGradient, theme } from '../../lib/theme';

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
  const dk = useDK();
  const styles = useMemo(() => makeStyles(dk), [dk]);
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
        <DetailHero images={images} height={HERO_HEIGHT} colors={featureGradient.restaurants} />

        <View style={[styles.sheet, styles.sheetOverlap, count > 0 && { paddingBottom: 120 }]} onLayout={(e) => { sheetY.current = e.nativeEvent.layout.y; }}>
          <SheetTitle title={restaurant.name} />

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
            restaurant.menuItems.map((m, i) => {
              const n = qty[m.id] ?? 0;
              return (
                <View key={m.id} style={[styles.item, i === restaurant.menuItems.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{m.name}</Text>
                    {m.description ? <Text style={styles.itemDesc}>{m.description}</Text> : null}
                    <Text style={styles.price}>{poundsFromCents(m.priceCents)}</Text>
                    {m.dietaryTags.length > 0 && (
                      <View style={styles.dietRow}>
                        {m.dietaryTags.map((t) => (
                          <Text key={t} style={styles.diet}>{t}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  {canOrder && (n === 0 ? (
                    <Touchable style={styles.addBtn} onPress={() => bump(m.id, 1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Add ${m.name}`}>
                      <Text style={styles.addTxt}>+</Text>
                    </Touchable>
                  ) : (
                    <View style={styles.stepper}>
                      <Touchable style={styles.stepBtn} onPress={() => bump(m.id, -1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Remove one ${m.name}`}><Text style={styles.stepTxt}>−</Text></Touchable>
                      <Text style={styles.stepQty}>{n}</Text>
                      <Touchable style={[styles.stepBtn, styles.stepBtnOn]} onPress={() => bump(m.id, 1)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Add another ${m.name}`}><Text style={[styles.stepTxt, { color: '#ffffff' }]}>+</Text></Touchable>
                    </View>
                  ))}
                </View>
              );
            })
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
            </>
          ) : (
            <Text style={styles.note}>Order ahead isn’t available here — pay at the outlet.</Text>
          )}
        </View>
      </ScrollView>
      {canOrder && count > 0 && (
        <View style={[styles.basketWrap, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <Touchable style={styles.basket} onPress={placeOrder} disabled={submitting} accessibilityRole="button" accessibilityLabel={user ? 'Order ahead' : 'Sign in to order'}>
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <View style={styles.basketCount}><Text style={styles.basketCountTxt}>{count}</Text></View>
                <Text style={styles.basketTxt}>{user ? 'Order ahead' : 'Sign in to order'}</Text>
                <Text style={styles.basketPrice}>{poundsFromCents(total)}</Text>
              </>
            )}
          </Touchable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (dk: DK) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: dk.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dk.bg },
  sheet: { backgroundColor: dk.sheet, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 },
  sheetOverlap: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: serif, flex: 1, color: dk.ink, fontSize: 21, fontWeight: '800' },
  desc: { color: dk.sub, fontSize: 14.5, lineHeight: 21, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  hoursPill: { alignSelf: 'flex-start', backgroundColor: dk.pill, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, marginTop: 4 },
  hoursTxt: { color: dk.link, fontWeight: '700', fontSize: 13.5 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: dk.line },
  itemDesc: { color: dk.sub, fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  itemName: { fontWeight: '700', color: dk.ink, fontSize: 16 },
  muted: { color: dk.sub, fontSize: 13, marginTop: 2 },
  dietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  diet: { fontSize: 11, fontWeight: '700', color: theme.ok, backgroundColor: dk.chip, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', textTransform: 'uppercase' },
  price: { fontFamily: serif, color: dk.ink, fontWeight: '700', fontSize: 16, marginTop: 6 },
  note: { color: dk.sub, fontSize: 12, textAlign: 'center', marginTop: 20 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: dk.primary, alignItems: 'center', justifyContent: 'center' },
  addTxt: { color: '#ffffff', fontSize: 24, fontWeight: '500', lineHeight: 27 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: dk.pill, alignItems: 'center', justifyContent: 'center' },
  stepBtnOn: { backgroundColor: dk.primary },
  stepTxt: { color: dk.link, fontSize: 16, fontWeight: '700' },
  stepQty: { color: dk.ink, fontSize: 16, fontWeight: '800', minWidth: 18, textAlign: 'center' },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  slotChip: { backgroundColor: dk.chip, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  slotChipOn: { backgroundColor: dk.primary },
  slotChipTxt: { color: dk.ink, fontWeight: '700', fontSize: 13 },
  slotChipTxtOn: { color: '#fff' },
  basketWrap: { position: 'absolute', left: 16, right: 16 },
  basket: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: dk.primary, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  basketCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  basketCountTxt: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  basketTxt: { flex: 1, color: '#ffffff', fontWeight: '800', fontSize: 16 },
  basketPrice: { fontFamily: serif, color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
