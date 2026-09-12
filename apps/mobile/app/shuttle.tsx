import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Touchable } from '../components/Touchable';
import { useSync } from '../lib/sync';
import { api } from '../lib/api';
import { theme } from '../lib/theme';
import { useThemePref } from '../lib/theme-context';

interface ShuttleStop {
  id: string;
  name: string;
  order: number;
  times: string[];
  poi: { name: string } | null;
}
interface ShuttleRoute {
  id: string;
  name: string;
  description: string | null;
  stops: ShuttleStop[];
}

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1a1a1a', text: '#ffffff', sub: '#9a9a9a', line: '#2a2a2a' }
    : { screen: theme.bg, card: '#ffffff', text: theme.ink, sub: theme.muted, line: theme.border };
}

export default function ShuttleScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { bundle } = useSync();
  const headerBg = bundle?.branding?.primary || theme.brand;
  const [routes, setRoutes] = useState<ShuttleRoute[] | null>(null);

  useEffect(() => {
    api<ShuttleRoute[]>('/shuttles').then(setRoutes).catch(() => setRoutes([]));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: pal.screen }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <Touchable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
        </Touchable>
        <Text style={styles.headerTitle}>Shuttle</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Text style={[styles.note, { color: pal.sub }]}>
          Scheduled departure times below — this is a fixed timetable, not live GPS tracking.
        </Text>

        {routes === null ? (
          <Text style={{ color: pal.sub }}>Loading…</Text>
        ) : routes.length === 0 ? (
          <Text style={{ color: pal.sub }}>No shuttle routes are set up yet.</Text>
        ) : (
          routes.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: pal.card, borderColor: pal.line }]}>
              <Text style={[styles.routeName, { color: pal.text }]}>{r.name}</Text>
              {r.description && <Text style={[styles.routeDesc, { color: pal.sub }]}>{r.description}</Text>}
              {r.stops.map((s) => (
                <View key={s.id} style={[styles.stopRow, { borderTopColor: pal.line }]}>
                  <Text style={[styles.stopName, { color: pal.text }]}>{s.name}</Text>
                  <Text style={[styles.stopTimes, { color: pal.sub }]}>
                    {s.times.length ? s.times.join(' · ') : 'No times set'}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  note: { fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 4 },
  routeName: { fontSize: 17, fontWeight: '800' },
  routeDesc: { fontSize: 13, marginTop: 2, marginBottom: 6 },
  stopRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  stopName: { fontSize: 14, fontWeight: '700' },
  stopTimes: { fontSize: 13 },
});
