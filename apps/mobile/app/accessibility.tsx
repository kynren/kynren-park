import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Switch } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Touchable } from '../components/Touchable';
import { useSync } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { theme } from '../lib/theme';
import { useThemePref } from '../lib/theme-context';

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', card: '#1a1a1a', text: '#ffffff', sub: '#9a9a9a', line: '#2a2a2a' }
    : { screen: theme.bg, card: '#ffffff', text: theme.ink, sub: theme.muted, line: theme.border };
}

const PREF_OPTIONS: { key: string; label: string; desc: string }[] = [
  { key: 'wheelchair', label: 'Wheelchair user', desc: 'Prioritise step-free routes and wheelchair-accessible attractions.' },
  { key: 'visual', label: 'Low vision / blind', desc: 'Highlight attractions with audio description.' },
  { key: 'hearing', label: 'Deaf / hard of hearing', desc: 'Highlight attractions with captioning or BSL.' },
  { key: 'sensory', label: 'Sensory sensitivities', desc: 'Surface sensory notes (noise, lighting, crowds) for each attraction.' },
];

export default function AccessibilityScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { bundle } = useSync();
  const { user } = useAuth();
  const headerBg = bundle?.branding?.primary || theme.brand;

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    api<{ accessibilityPrefs?: Record<string, boolean> | null }>('/me').then((me) => {
      setPrefs(me.accessibilityPrefs ?? {});
    }).catch(() => undefined);
  }, [user]);

  async function togglePref(key: string) {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    try {
      await api('/me/accessibility', { method: 'PATCH', body: JSON.stringify({ [key]: next }) });
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next })); // revert on failure
    }
  }

  const accessibleAttractions = (bundle?.attractions ?? []).filter((a) => a.wheelchairAccessible);
  const audioDescAttractions = (bundle?.attractions ?? []).filter((a) => a.hasAudioDescription);
  const captionedAttractions = (bundle?.attractions ?? []).filter((a) => a.hasCaptioning || a.hasBSL);
  const facilities = (bundle?.pois ?? []).filter((p) => p.type === 'ACCESSIBILITY');

  return (
    <View style={{ flex: 1, backgroundColor: pal.screen }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <Touchable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
        </Touchable>
        <Text style={styles.headerTitle}>Accessibility</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        {user ? (
          <View style={[styles.card, { backgroundColor: pal.card, borderColor: pal.line }]}>
            <Text style={[styles.cardTitle, { color: pal.text }]}>My preferences</Text>
            {PREF_OPTIONS.map((o) => (
              <View key={o.key} style={[styles.prefRow, { borderTopColor: pal.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prefLabel, { color: pal.text }]}>{o.label}</Text>
                  <Text style={[styles.prefDesc, { color: pal.sub }]}>{o.desc}</Text>
                </View>
                <Switch value={!!prefs[o.key]} onValueChange={() => togglePref(o.key)} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: pal.sub }}>Sign in to save your accessibility preferences.</Text>
        )}

        <View style={[styles.card, { backgroundColor: pal.card, borderColor: pal.line }]}>
          <Text style={[styles.cardTitle, { color: pal.text }]}>Around the park</Text>
          <Text style={[styles.statRow, { color: pal.sub }]}>{accessibleAttractions.length} wheelchair-accessible attraction{accessibleAttractions.length === 1 ? '' : 's'}</Text>
          <Text style={[styles.statRow, { color: pal.sub }]}>{audioDescAttractions.length} with audio description</Text>
          <Text style={[styles.statRow, { color: pal.sub }]}>{captionedAttractions.length} with captioning or BSL</Text>
          <Text style={[styles.statRow, { color: pal.sub }]}>{facilities.length} accessibility facilit{facilities.length === 1 ? 'y' : 'ies'} marked on the map</Text>
        </View>

        {facilities.length > 0 && (
          <View style={[styles.card, { backgroundColor: pal.card, borderColor: pal.line }]}>
            <Text style={[styles.cardTitle, { color: pal.text }]}>Accessibility facilities</Text>
            {facilities.map((f) => (
              <View key={f.id} style={[styles.facilityRow, { borderTopColor: pal.line }]}>
                <Text style={[styles.prefLabel, { color: pal.text }]}>{f.name}</Text>
                {f.description && <Text style={[styles.prefDesc, { color: pal.sub }]}>{f.description}</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  card: { borderRadius: 14, padding: 16, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  prefLabel: { fontSize: 14, fontWeight: '700' },
  prefDesc: { fontSize: 12, marginTop: 2 },
  statRow: { fontSize: 14, marginTop: 8 },
  facilityRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
