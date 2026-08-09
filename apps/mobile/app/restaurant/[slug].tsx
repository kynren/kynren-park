import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Touchable } from '../../components/Touchable';
import { useSync } from '../../lib/sync';
import { poundsFromCents } from '../../lib/format';
import { theme } from '../../lib/theme';

const HERO_HEIGHT = 260;

export default function RestaurantScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const restaurant = bundle?.restaurants.find((r) => r.slug === slug);

  // Collapsing header: the title slides into the top bar once the hero scrolls off.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [barActive, setBarActive] = useState(false);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => setBarActive(value > HERO_HEIGHT - 60));
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.muted }}>Outlet not found.</Text>
      </View>
    );
  }

  const hero = restaurant.heroImage;
  const barOpacity = scrollY.interpolate({ inputRange: [HERO_HEIGHT - 90, HERO_HEIGHT - 30], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Collapsing top bar — with a hero it fades in as you scroll; without, it's solid. */}
      <Animated.View
        style={[styles.collapseBar, { backgroundColor: theme.brand, paddingTop: insets.top + 8, opacity: hero ? barOpacity : 1 }]}
        pointerEvents={hero && !barActive ? 'none' : 'auto'}
      >
        <Touchable style={styles.headerBack} onPress={() => router.back()} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
        </Touchable>
        <Text style={styles.headerTitle} numberOfLines={1}>{restaurant.name}</Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {hero ? (
          <View style={styles.hero}>
            <Image source={{ uri: hero }} style={styles.heroImg} resizeMode="cover" />
            <Touchable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
            </Touchable>
          </View>
        ) : (
          <View style={{ height: insets.top + 52 }} />
        )}

        <View style={{ padding: 16 }}>
          <Text style={styles.h1}>{restaurant.name}</Text>
          {restaurant.cuisine && <Text style={styles.cuisine}>{restaurant.cuisine}</Text>}

          {restaurant.openingHours ? (
            <View style={styles.hoursChip}>
              <Text style={styles.hoursIcon}>🕑</Text>
              <Text style={styles.hoursTxt}>Available {restaurant.openingHours}</Text>
            </View>
          ) : null}

          <Text style={styles.section}>Menu</Text>
          {restaurant.menuItems.length === 0 ? (
            <Text style={styles.muted}>Menu coming soon.</Text>
          ) : (
            restaurant.menuItems.map((m) => (
              <View key={m.id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{m.name}</Text>
                  {m.description && <Text style={styles.muted}>{m.description}</Text>}
                  {m.dietaryTags.length > 0 && (
                    <View style={styles.tagRow}>
                      {m.dietaryTags.map((t) => (
                        <Text key={t} style={styles.tag}>{t}</Text>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.price}>{poundsFromCents(m.priceCents)}</Text>
              </View>
            ))
          )}

          <Text style={styles.note}>Order ahead is coming soon — for now, pay at the outlet.</Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', height: HERO_HEIGHT, backgroundColor: '#0e1013' },
  heroImg: { width: '100%', height: HERO_HEIGHT },
  backBtn: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  collapseBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  headerBack: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 19, fontWeight: '800' },
  h1: { fontSize: 24, fontWeight: '800', color: theme.ink },
  cuisine: { color: theme.brand, fontWeight: '600', marginTop: 2 },
  hoursChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  hoursIcon: { fontSize: 14 },
  hoursTxt: { color: theme.ink, fontWeight: '700', fontSize: 13 },
  section: { fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 22, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8, gap: 12 },
  itemName: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  price: { color: theme.brand, fontWeight: '800', fontSize: 15 },
  tag: { fontSize: 11, color: theme.ok, backgroundColor: '#e7f3ee', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, textTransform: 'uppercase' },
  note: { color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 20 },
});
