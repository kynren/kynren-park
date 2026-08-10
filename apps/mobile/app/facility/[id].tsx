import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Touchable } from '../../components/Touchable';
import { useSync } from '../../lib/sync';
import { theme } from '../../lib/theme';

const HERO_HEIGHT = 240;
const TYPE_LABEL: Record<string, string> = {
  RESTROOM: 'Restrooms', FIRST_AID: 'First aid', SHOP: 'Shop', PARKING: 'Parking',
  ACCESSIBILITY: 'Accessibility', BABY_CHANGING: 'Baby changing', PICNIC: 'Picnic area',
  ENTRANCE: 'Entrance', INFO: 'Information', HELP: 'Help point',
};
const TYPE_EMOJI: Record<string, string> = {
  RESTROOM: '🚻', FIRST_AID: '➕', SHOP: '🛍️', PARKING: '🅿️', ACCESSIBILITY: '♿',
  BABY_CHANGING: '🍼', PICNIC: '🧺', ENTRANCE: '🚪', INFO: 'ℹ️', HELP: '❓',
};
function Back({ stroke = '#111' }: { stroke?: string }) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>;
}

export default function FacilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bundle } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const poi = bundle?.pois.find((p) => p.id === id);

  const scrollY = useRef(new Animated.Value(0)).current;
  const [barActive, setBarActive] = useState(false);
  useEffect(() => { const s = scrollY.addListener(({ value }) => setBarActive(value > HERO_HEIGHT - 60)); return () => scrollY.removeListener(s); }, [scrollY]);

  if (!poi) {
    return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><Text style={{ color: theme.muted }}>Place not found.</Text></View>;
  }

  const hero = poi.heroImage;
  const label = TYPE_LABEL[poi.type] ?? poi.type.replace('_', ' ');
  const emoji = poi.icon || TYPE_EMOJI[poi.type] || '📍';
  const barOpacity = scrollY.interpolate({ inputRange: [HERO_HEIGHT - 90, HERO_HEIGHT - 30], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.collapseBar, { paddingTop: insets.top + 8, opacity: hero ? barOpacity : 1 }]} pointerEvents={hero && !barActive ? 'none' : 'auto'}>
        <Touchable style={styles.headerBack} onPress={() => router.back()} hitSlop={8}><Back /></Touchable>
        <Text style={styles.headerTitle} numberOfLines={2}>{poi.name}</Text>
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
            <Touchable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}><Back /></Touchable>
          </View>
        ) : (
          <View style={[styles.heroFallback, { height: HERO_HEIGHT, backgroundColor: poi.color ?? theme.brand }]}>
            <Touchable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}><Back /></Touchable>
            <Text style={{ fontSize: 72 }}>{emoji}</Text>
          </View>
        )}

        <View style={{ padding: 16 }}>
          <Text style={styles.h1}>{poi.name}</Text>
          <Text style={styles.kind}>{label}</Text>
          {poi.openingHours ? (
            <View style={styles.hoursChip}>
              <Text style={styles.hoursIcon}>🕑</Text>
              <Text style={styles.hoursTxt}>Open {poi.openingHours}</Text>
            </View>
          ) : null}
          {poi.description ? <Text style={styles.desc}>{poi.description}</Text> : null}

          <Touchable style={styles.findMap} onPress={() => router.push(`/map?focus=${poi.id}`)}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={theme.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" /><Path d="M9 4v14M15 6v14" /></Svg>
            <Text style={styles.findMapTxt}>Find on Map</Text>
          </Touchable>
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
  heroFallback: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  backBtn: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  collapseBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: theme.border, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  headerBack: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerTitle: { flex: 1, color: theme.ink, fontSize: 17, fontWeight: '800', lineHeight: 21 },
  h1: { fontSize: 24, fontWeight: '800', color: theme.ink },
  kind: { color: theme.brand, fontWeight: '600', marginTop: 2, textTransform: 'capitalize' },
  hoursChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  hoursIcon: { fontSize: 14 },
  hoursTxt: { color: theme.ink, fontWeight: '700', fontSize: 13 },
  desc: { color: theme.ink, fontSize: 15, lineHeight: 23, marginTop: 14 },
  findMap: { alignItems: 'center', gap: 8, paddingVertical: 20, marginTop: 8 },
  findMapTxt: { fontSize: 15, fontWeight: '700', color: theme.ink },
});
