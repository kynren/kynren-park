import { useState, type JSX } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Touchable } from '../../components/Touchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSync } from '../../lib/sync';
import { theme } from '../../lib/theme';
import { useThemePref } from '../../lib/theme-context';

function useMealPalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1d1d1d', panel: '#2a2a2a', text: '#ffffff', sub: '#9a9a9a', line: '#262626', icon: '#e6e6e6' }
    : { screen: theme.bg, card: '#ffffff', panel: '#efe9e2', text: theme.ink, sub: theme.muted, line: theme.border, icon: theme.brand };
}

function fmtLong(ymd: string) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  const wd = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const md = d.toLocaleDateString('en-GB', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  return { wd, md };
}

// --- icons -----------------------------------------------------------------
type IP = { color: string; size?: number };
function ChefHat({ color, size = 30 }: IP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 15a4.2 4.2 0 0 1-1.2-8.1A3.4 3.4 0 0 1 12 5.4a3.4 3.4 0 0 1 6.2 1.5A4.2 4.2 0 0 1 17 15" />
      <Path d="M7 15h10v2.6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z" />
      <Path d="M20 5.5l1.4-1M20 8h1.6" />
    </Svg>
  );
}
function Cup({ color, size = 28 }: IP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 10h11v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <Path d="M16 11h1.8a2 2 0 0 1 0 4H16" />
      <Path d="M8 3c-.6 1 .6 2 0 3M11.5 3c-.6 1 .6 2 0 3" />
    </Svg>
  );
}
function Bag({ color, size = 30 }: IP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 8h11l-1 11a1.2 1.2 0 0 1-1.2 1.1H8.7A1.2 1.2 0 0 1 7.5 19Z" />
      <Path d="M6.5 8 8 4.6h8L17.5 8" />
      <Path d="M11 12.5l1-1 1 1M12 11.5v3" />
    </Svg>
  );
}
function Plate({ color, size = 30 }: IP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="8.5" />
      <Circle cx="12" cy="12" r="4.5" />
    </Svg>
  );
}

export default function MealScreen() {
  const { date } = useSync();
  const router = useRouter();
  const pal = useMealPalette();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(true);
  const { wd, md } = fmtLong(date);

  return (
    <View style={[styles.screen, { backgroundColor: pal.screen }]}>
      {/* Fixed top bar */}
      <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
        <Touchable onPress={() => router.push('/notifications')} style={styles.avatar}>
          <Text style={{ fontSize: 17 }}>🔔</Text>
        </Touchable>
        <Touchable onPress={() => router.push('/settings')} style={styles.avatar}>
          <Text style={{ fontSize: 17 }}>👤</Text>
        </Touchable>
      </View>
      <Text style={[styles.title, { color: pal.text }]}>Dining at Kynren</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Your meals */}
      <Touchable style={styles.sectionHead} onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.sectionLabel, { color: pal.text }]}>Your meals on {wd}, {md}</Text>
        <Text style={[styles.caret, { color: pal.sub }]}>{open ? '⌃' : '⌄'}</Text>
      </Touchable>

      {open && (
        <View style={styles.body}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <MealSlot label="Lunch" pal={pal} onPress={() => router.push('/restaurants?slot=lunch')} />
            <MealSlot label="Dinner" pal={pal} onPress={() => router.push('/restaurants?slot=dinner')} />
          </View>
          <Touchable style={[styles.sweet, { backgroundColor: pal.card }]} onPress={() => router.push('/restaurants?slot=sweet')}>
            <View style={[styles.sweetIcon, { backgroundColor: pal.panel }]}>
              <Cup color={pal.icon} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: pal.text }]}>Sweet break</Text>
              <Text style={[styles.rowSub, { color: pal.sub }]}>See available places</Text>
            </View>
            <Text style={[styles.chev, { color: pal.sub }]}>›</Text>
          </Touchable>
        </View>
      )}

      {/* Click & Collect */}
      <Text style={[styles.sectionLabel, styles.bodyPad, { color: pal.text, marginTop: 22 }]}>Click &amp; Collect</Text>
      <View style={styles.body}>
        <BigCard
          pal={pal}
          Icon={Bag}
          title={'Order online,\npick up on-site'}
          sub="Available only on the day of your visit"
          onPress={() => router.push('/restaurants?slot=collect')}
        />
      </View>

      {/* Book in our restaurants */}
      <Text style={[styles.sectionLabel, styles.bodyPad, { color: pal.text, marginTop: 22 }]}>Book in our restaurants</Text>
      <View style={styles.body}>
        <BigCard
          pal={pal}
          Icon={Plate}
          title={'Book in one of our\nrestaurants'}
          sub="Available online now"
          onPress={() => router.push('/restaurants')}
        />
      </View>
      </ScrollView>
    </View>
  );
}

function MealSlot({ label, pal, onPress }: { label: string; pal: ReturnType<typeof useMealPalette>; onPress: () => void }) {
  return (
    <Touchable style={[styles.slot, { backgroundColor: pal.card }]} onPress={onPress}>
      <View style={[styles.slotTop, { backgroundColor: pal.panel }]}>
        <ChefHat color={pal.icon} />
      </View>
      <View style={styles.slotBottom}>
        <Text style={[styles.slotLabel, { color: pal.text }]}>{label}</Text>
        <View style={styles.slotSubRow}>
          <Text style={[styles.rowSub, { color: pal.sub }]}>Add a restaurant</Text>
          <Text style={[styles.chev, { color: pal.sub }]}>›</Text>
        </View>
      </View>
    </Touchable>
  );
}

function BigCard({
  pal, Icon, title, sub, onPress,
}: {
  pal: ReturnType<typeof useMealPalette>;
  Icon: (p: IP) => JSX.Element;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Touchable style={[styles.bigCard, { backgroundColor: pal.card }]} onPress={onPress}>
      <View style={[styles.bigIcon, { backgroundColor: pal.panel }]}>
        <Icon color={pal.icon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.bigTitle, { color: pal.text }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: pal.sub, marginTop: 3 }]}>{sub}</Text>
      </View>
      <Text style={[styles.chev, { color: pal.sub }]}>›</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 27, fontWeight: '700', textAlign: 'center', marginTop: 6, marginBottom: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  sectionLabel: { fontSize: 20, fontWeight: '700' },
  bodyPad: { paddingHorizontal: 16 },
  caret: { fontSize: 20, fontWeight: '800' },
  body: { paddingHorizontal: 16, marginTop: 12, gap: 12 },
  slot: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  slotTop: { height: 92, alignItems: 'center', justifyContent: 'center' },
  slotBottom: { padding: 12 },
  slotLabel: { fontSize: 18, fontWeight: '800' },
  slotSubRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  sweet: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, gap: 12 },
  sweetIcon: { width: 54, height: 54, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 17, fontWeight: '800' },
  rowSub: { fontSize: 13 },
  chev: { fontSize: 24, marginLeft: 6 },
  bigCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, gap: 14 },
  bigIcon: { width: 62, height: 62, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bigTitle: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
});
