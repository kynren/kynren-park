import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { useSync, type Announcement } from '../lib/sync';
import { theme } from '../lib/theme';
import { Touchable } from './Touchable';
import { tapMedium } from '../lib/haptics';

const DISMISS_KEY = 'kynren_announce_dismissed';

/** Is the announcement live right now (sent + inside its active window)? */
function isDue(a: Announcement, now: number) {
  if (!a.sentAt) return false;
  if (a.startAt && new Date(a.startAt).getTime() > now) return false;
  if (a.endAt && new Date(a.endAt).getTime() < now) return false;
  return true;
}

/**
 * Foreground megaphone that appears when a live announcement is due. Tapping it
 * reads the announcement aloud (text-to-speech) and shows the full text.
 */
export function AnnouncementMegaphone() {
  const { bundle } = useSync();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [tick, setTick] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((raw) => raw && setDismissed(new Set(JSON.parse(raw))));
  }, []);
  // Re-evaluate the active window every 30s so it appears/expires on time.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const due = useMemo(() => {
    const now = Date.now();
    return (bundle?.announcements ?? [])
      .filter((a) => isDue(a, now) && !dismissed.has(a.id))
      .sort((a, b) => new Date(b.sentAt ?? b.createdAt).getTime() - new Date(a.sentAt ?? a.createdAt).getTime())[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, dismissed, tick]);

  // Attention-grabbing shake + pulse while a due announcement waits.
  useEffect(() => {
    if (!due || open) { shake.stopAnimation(); pulse.stopAnimation(); return; }
    const s = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 120, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(shake, { toValue: -1, duration: 120, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(shake, { toValue: 0, duration: 120, useNativeDriver: true, easing: Easing.linear }),
        Animated.delay(1400),
      ]),
    );
    const p = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }));
    s.start(); p.start();
    return () => { s.stop(); p.stop(); };
  }, [due, open, shake, pulse]);

  if (!due) return null;

  const speak = () => {
    Speech.stop();
    setSpeaking(true);
    Speech.speak(`${due.title}. ${due.body}`, { rate: 0.98, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };
  const openAndSpeak = () => { tapMedium(); setOpen(true); speak(); };
  const dismiss = () => {
    Speech.stop(); setSpeaking(false); setOpen(false);
    setDismissed((prev) => {
      const next = new Set(prev).add(due.id);
      AsyncStorage.setItem(DISMISS_KEY, JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  };

  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] });

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {open && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardEyebrow}>📣 ANNOUNCEMENT</Text>
            <Pressable hitSlop={8} onPress={dismiss}><Text style={styles.close}>✕</Text></Pressable>
          </View>
          <Text style={styles.cardTitle}>{due.title}</Text>
          <Text style={styles.cardBody}>{due.body}</Text>
          <View style={styles.cardActions}>
            {speaking ? (
              <Touchable style={styles.playBtn} haptic="medium" onPress={() => { Speech.stop(); setSpeaking(false); }}>
                <Text style={styles.playTxt}>■ Stop</Text>
              </Touchable>
            ) : (
              <Touchable style={styles.playBtn} haptic="medium" onPress={speak}>
                <Text style={styles.playTxt}>🔊 Play again</Text>
              </Touchable>
            )}
            <Touchable style={styles.dismissBtn} onPress={dismiss}><Text style={styles.dismissTxt}>Dismiss</Text></Touchable>
          </View>
        </View>
      )}

      <Pressable onPress={openAndSpeak} style={styles.fabWrap}>
        <Animated.View style={[styles.pulseRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }] }]} />
        <Animated.View style={[styles.fab, { transform: [{ rotate }] }]}>
          <Text style={{ fontSize: 26 }}>📣</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, bottom: 96, alignItems: 'flex-end', zIndex: 200 },
  fabWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: theme.brand },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.brand, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 8 },
  card: { width: 280, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardEyebrow: { color: theme.brand, fontWeight: '800', fontSize: 11, letterSpacing: 0.6 },
  close: { color: theme.muted, fontSize: 15, fontWeight: '700' },
  cardTitle: { color: theme.ink, fontWeight: '800', fontSize: 16 },
  cardBody: { color: theme.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  playBtn: { flex: 1, backgroundColor: theme.brand, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  playTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  dismissBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  dismissTxt: { color: theme.ink, fontWeight: '700', fontSize: 13 },
});
