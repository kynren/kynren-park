import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSync } from '../lib/sync';
import { theme } from '../lib/theme';
import { Touchable } from './Touchable';
import { selection } from '../lib/haptics';

const SEEN_KEY = 'kynren_walkthrough_seen';

// The first path segment matches the tab route name admin picks from
// (index | map | tickets | shows | food) — the tab group itself isn't part
// of the URL, so "/" (Home) resolves to "index".
function screenOf(path: string): string {
  const seg = (path || '/').split('/').filter(Boolean)[0];
  return seg || 'index';
}

/**
 * Admin-authored, first-time-only onboarding cards. Each step is tied to a tab
 * (screen) and a position on it; the first time a guest reaches that tab, its
 * unseen steps show one at a time until dismissed — never again after that,
 * tracked per device in AsyncStorage.
 */
export function Walkthrough() {
  const { bundle, loading } = useSync();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [seen, setSeen] = useState<Set<string> | null>(null); // null = not loaded from storage yet

  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY).then((raw) => setSeen(new Set(raw ? JSON.parse(raw) : [])));
  }, []);

  const screen = screenOf(pathname);
  const stepsForScreen = useMemo(
    () => (bundle?.walkthrough ?? []).filter((s) => s.screen === screen).sort((a, b) => a.order - b.order),
    [bundle, screen],
  );

  if (loading || !seen || stepsForScreen.length === 0) return null;
  const unseen = stepsForScreen.filter((s) => !seen.has(s.id));
  if (unseen.length === 0) return null;
  const step = unseen[0]!;
  const isLast = unseen.length === 1;

  function markSeen(ids: string[]) {
    setSeen((prev) => {
      const next = new Set(prev ?? []);
      for (const id of ids) next.add(id);
      AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  }
  const next = () => { selection(); markSeen([step.id]); };
  const skipAll = () => { selection(); markSeen((bundle?.walkthrough ?? []).map((s) => s.id)); };

  const posStyle =
    step.position === 'top' ? { top: insets.top + 66 }
    : step.position === 'center' ? { top: '42%' as const }
    : { bottom: 96 };

  return (
    <View style={[styles.wrap, posStyle]} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.body}>{step.body}</Text>
        <View style={styles.actions}>
          <Touchable onPress={skipAll} hitSlop={8}><Text style={styles.skip}>Skip</Text></Touchable>
          <Touchable style={styles.nextBtn} haptic="selection" onPress={next}>
            <Text style={styles.nextTxt}>{isLast ? 'Got it' : 'Next'}</Text>
          </Touchable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 300 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  title: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  body: { color: theme.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  skip: { color: theme.muted, fontWeight: '700', fontSize: 13 },
  nextBtn: { backgroundColor: theme.brand, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 },
  nextTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
