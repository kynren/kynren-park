import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Touchable } from '../components/Touchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSync, type Restaurant, type Poi } from '../lib/sync';
import { theme } from '../lib/theme';
import { useThemePref } from '../lib/theme-context';

const FAVS_KEY = 'kynren_fav_restaurants';

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#171717', chip: '#2a2a2a', text: '#ffffff', sub: '#9a9a9a', icon: '#e6e6e6', green: '#5bbf7b', thumb: '#242424' }
    : { screen: theme.bg, card: '#ffffff', chip: '#efe9e2', text: theme.ink, sub: theme.muted, icon: theme.ink, green: '#2e7d5b', thumb: '#e7ded2' };
}

const SLOT_TITLE: Record<string, string> = { lunch: 'Lunch', dinner: 'Dinner', sweet: 'Sweet break', collect: 'Click & Collect' };

function fmtMd(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString('en-GB', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

type IP = { color: string; size?: number };
function BackIcon({ color, size = 22 }: IP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}
function MapGoIcon({ color, size = 18 }: IP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <Path d="M9 4v14M15 6v14" />
    </Svg>
  );
}
function ForkKnifeIcon({ color, size = 18 }: IP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 3v5M9.5 3v5M8 3v18M8 8H6.5" />
      <Path d="M16 3c-1.5 2-1.5 6 0 8.5V21M16 11.5c1.5-2.5 1.5-6.5 0-8.5" />
    </Svg>
  );
}
function HeartIcon({ color, size = 18, fill = 'none' }: IP & { fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20C4 14.5 4 8.5 8 6.5c2-1 4 .5 4 2 0-1.5 2-3 4-2 4 2 4 8-4 13.5Z" />
    </Svg>
  );
}
function PinLetter({ letter, color, text }: { letter: string; color: string; text: string }) {
  return (
    <View style={{ width: 30, height: 34, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={30} height={34} viewBox="0 0 24 28" style={StyleSheet.absoluteFill} fill="none" stroke={color} strokeWidth={1.6}>
        <Path d="M12 27C12 27 4 18 4 10.5A8 8 0 0 1 20 10.5C20 18 12 27 12 27Z" fill="none" />
      </Svg>
      <Text style={{ color: text, fontWeight: '800', fontSize: 12, marginTop: -6 }}>{letter}</Text>
    </View>
  );
}

export default function RestaurantsScreen() {
  const { bundle, date } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const { slot } = useLocalSearchParams<{ slot?: string }>();
  const [favs, setFavs] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(FAVS_KEY).then((raw) => raw && setFavs(new Set(JSON.parse(raw))));
  }, []);

  function toggleFav(id: string) {
    setFavs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      AsyncStorage.setItem(FAVS_KEY, JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  }

  const restaurants = bundle?.restaurants ?? [];
  const poiById = new Map((bundle?.pois ?? []).map((p: Poi) => [p.id, p]));

  const slotName = slot ? SLOT_TITLE[slot] : undefined;
  const heading = slot === 'lunch' || slot === 'dinner' ? `${slotName} of ${fmtMd(date)}` : slotName ?? 'Our restaurants';
  const showSlotNote = slot === 'lunch' || slot === 'dinner' || slot === 'sweet';

  return (
    <View style={[styles.screen, { backgroundColor: pal.screen }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
        <Touchable onPress={() => router.back()} style={styles.backBtn}>
          <BackIcon color="#111" />
        </Touchable>
      </View>
      <Text style={[styles.heading, { color: pal.text }]}>{heading}</Text>
      {showSlotNote && (
        <View style={styles.noteRow}>
          <View style={[styles.dot, { backgroundColor: pal.green }]} />
          <Text style={[styles.note, { color: pal.green }]}>The restaurants displayed will be open during this time slot</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 30, gap: 16 }}>
        {restaurants.length === 0 && <Text style={{ color: pal.sub, textAlign: 'center', marginTop: 30 }}>Loading restaurants…</Text>}
        {restaurants.map((r) => {
          const poi = r.poiId ? poiById.get(r.poiId) : undefined;
          const letter = (poi?.mapZone ?? r.name).trim().charAt(0).toUpperCase();
          const faved = favs.has(r.id);
          return (
            <View key={r.id} style={[styles.card, { backgroundColor: pal.card }]}>
              <View style={styles.cardHead}>
                <View style={[styles.thumb, { backgroundColor: pal.thumb }]}>
                  <ForkKnifeIcon color={pal.sub} size={26} />
                </View>
                <View style={styles.nameRow}>
                  <PinLetter letter={letter} color={pal.text} text={pal.text} />
                  <Text style={[styles.name, { color: pal.text }]} numberOfLines={2}>{r.name}</Text>
                </View>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip pal={pal} Icon={MapGoIcon} label="Go to" onPress={() => router.push(`/map?focus=${r.id}`)} />
                <Chip pal={pal} Icon={ForkKnifeIcon} label="Menu" onPress={() => router.push(`/restaurant/${r.slug}`)} />
                <Chip
                  pal={pal}
                  label="Favourites"
                  onPress={() => toggleFav(r.id)}
                  render={(c) => <HeartIcon color={faved ? theme.brand : c} fill={faved ? theme.brand : 'none'} />}
                  active={faved}
                />
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Chip({
  pal, Icon, render, label, onPress, active,
}: {
  pal: ReturnType<typeof usePalette>;
  Icon?: (p: IP) => JSX.Element;
  render?: (color: string) => JSX.Element;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Touchable style={[styles.chip, { backgroundColor: pal.chip }]} onPress={onPress}>
      {render ? render(pal.icon) : Icon ? <Icon color={pal.icon} /> : null}
      <Text style={[styles.chipTxt, { color: active ? theme.brand : pal.text }]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: { paddingHorizontal: 14, paddingTop: 10 },
  backBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  noteRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 12, alignItems: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
  note: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  card: { borderRadius: 14, padding: 12, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  thumb: { width: 92, height: 74, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 20, fontWeight: '700' },
  chipRow: { gap: 10, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  chipTxt: { fontSize: 15, fontWeight: '600' },
});
