import { ScrollView, View, Text, StyleSheet, Image } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Touchable } from '../components/Touchable';
import { ManagedImage } from '../components/ManagedImage';
import { useSync, type Attraction } from '../lib/sync';
import { useFavoriteIds } from '../lib/favorites';
import { theme } from '../lib/theme';
import { useThemePref } from '../lib/theme-context';

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1a1a1a', text: '#ffffff', sub: '#9a9a9a', line: '#2a2a2a' }
    : { screen: theme.bg, card: '#ffffff', text: theme.ink, sub: theme.muted, line: theme.border };
}

export function AttractionListScreen({ title, label, emptyHeading, emptyBody, slot, ids }: {
  title: string; label: string; emptyHeading: string; emptyBody: string; slot: string; ids: Set<string> | null;
}) {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { bundle } = useSync();
  const headerBg = bundle?.branding?.primary || theme.brand;
  const items: Attraction[] = ids ? (bundle?.attractions ?? []).filter((a) => ids.has(a.id)) : [];

  return (
    <View style={{ flex: 1, backgroundColor: pal.screen }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <Touchable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
        </Touchable>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {ids && items.length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
          {items.map((a) => (
            <Touchable key={a.id} style={[styles.row, { backgroundColor: pal.card, borderColor: pal.line }]} onPress={() => router.push(`/attraction/${a.slug}`)}>
              <View style={styles.thumb}>
                {a.heroImage ? <Image source={{ uri: a.heroImage }} style={styles.thumbImg} resizeMode="cover" /> : <Text style={{ fontSize: 22 }}>🎭</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: pal.text }]} numberOfLines={1}>{a.name}</Text>
                {a.tagline && <Text style={[styles.sub, { color: pal.sub }]} numberOfLines={1}>{a.tagline}</Text>}
                <Text style={[styles.cat, { color: pal.sub }]}>{a.category.replace('_', ' ').toLowerCase()}</Text>
              </View>
              <Text style={[styles.chev, { color: pal.sub }]}>›</Text>
            </Touchable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <ManagedImage slot={slot} style={{ width: 150, height: 150, borderRadius: 16 }} fadeColor={pal.screen} />
          <Text style={[styles.emptyLabel, { color: pal.sub }]}>{label}</Text>
          <Text style={[styles.emptyHeading, { color: pal.text }]}>{emptyHeading}</Text>
          <Text style={[styles.emptyBody, { color: pal.sub }]}>{emptyBody}</Text>
          <Touchable style={styles.discover} onPress={() => router.push('/(tabs)/shows')}><Text style={styles.discoverTxt}>Discover</Text></Touchable>
        </View>
      )}
    </View>
  );
}

export default function FavoritesScreen() {
  const { ids } = useFavoriteIds();
  return (
    <AttractionListScreen
      title="My favourites" label="MY FAVOURITES" slot="favorites.empty"
      emptyHeading="Create your favourites list"
      emptyBody="Shows, restaurants and activities appear here when you mark them as favourites."
      ids={ids}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, borderWidth: 1 },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  name: { fontWeight: '800', fontSize: 15 },
  sub: { fontSize: 13, marginTop: 1 },
  cat: { fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  chev: { fontSize: 24, marginLeft: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 6 },
  emptyLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 18 },
  emptyHeading: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  discover: { backgroundColor: theme.brand, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 40, marginTop: 22 },
  discoverTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
