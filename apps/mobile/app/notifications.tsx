import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSync, type Announcement } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { type PersonalNotification } from '../lib/notifications';
import { api } from '../lib/api';
import { theme } from '../lib/theme';
import { Touchable } from '../components/Touchable';

/** Is the announcement live right now (sent + inside its active window)? */
function isLive(a: Announcement, now: number) {
  if (!a.sentAt) return false;
  if (a.startAt && new Date(a.startAt).getTime() > now) return false;
  if (a.endAt && new Date(a.endAt).getTime() < now) return false;
  return true;
}

const TYPE_ICON: Record<string, string> = { session: '⏱️', order: '🍽️', reminder: '🔔' };

// A single feed merging park-wide announcements (public, from the offline
// bundle) with this guest's own delay/order/reminder history (personal,
// sign-in required) — sorted together by when each happened.
type Item =
  | { kind: 'announcement'; id: string; at: number; a: Announcement }
  | { kind: 'personal'; id: string; at: number; n: PersonalNotification };

export default function NotificationsScreen() {
  const { bundle, date } = useSync();
  const { user } = useAuth();
  const router = useRouter();
  // Seed from the offline bundle so there's always something to show offline.
  const [announcements, setAnnouncements] = useState<Announcement[]>(bundle?.announcements ?? []);
  const [personal, setPersonal] = useState<PersonalNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  async function load() {
    await Promise.all([
      api<Announcement[]>(`/announcements?date=${date}`).then(setAnnouncements).catch(() => undefined),
      user ? api<PersonalNotification[]>('/me/notifications').then(setPersonal).catch(() => undefined) : Promise.resolve(),
    ]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, user]);

  // Clear the bell badge once the guest has actually seen this screen.
  useEffect(() => {
    if (user) api('/me/notifications/read', { method: 'POST' }).catch(() => undefined);
  }, [user]);

  // Stop any speech when leaving the screen.
  useEffect(() => () => { Speech.stop(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function toggleSpeak(a: Announcement) {
    if (speakingId === a.id) {
      Speech.stop();
      setSpeakingId(null);
      return;
    }
    Speech.stop();
    setSpeakingId(a.id);
    Speech.speak(`${a.title}. ${a.body}`, {
      rate: 0.98,
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }

  const now = Date.now();
  const items: Item[] = [
    ...announcements.map((a): Item => ({ kind: 'announcement', id: `a:${a.id}`, at: new Date(a.sentAt ?? a.createdAt).getTime(), a })),
    ...personal.map((n): Item => ({ kind: 'personal', id: `n:${n.id}`, at: new Date(n.createdAt).getTime(), n })),
  ].sort((x, y) => y.at - x.at);

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {items.length === 0 ? (
        <Text style={styles.muted}>No notifications yet. Park announcements and your show reminders will appear here.</Text>
      ) : (
        items.map((item) => {
          if (item.kind === 'personal') {
            const n = item.n;
            return (
              <Touchable
                key={item.id}
                style={styles.card}
                disabled={!n.deepLink}
                onPress={() => n.deepLink && router.push(n.deepLink as never)}
              >
                <View style={styles.head}>
                  <Text style={styles.title}>{TYPE_ICON[n.type] ?? '🔔'} {n.title}</Text>
                </View>
                <Text style={styles.time}>{new Date(n.createdAt).toLocaleString('en-GB')}</Text>
                <Text style={styles.body}>{n.body}</Text>
              </Touchable>
            );
          }
          const a = item.a;
          const speaking = speakingId === a.id;
          const live = isLive(a, now);
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.title}>📣 {a.title}</Text>
                {live && <View style={styles.liveTag}><Text style={styles.liveTxt}>LIVE</Text></View>}
              </View>
              <Text style={styles.time}>{new Date(a.sentAt ?? a.createdAt).toLocaleString('en-GB')}</Text>
              <Text style={styles.body}>{a.body}</Text>
              <Touchable style={[styles.listen, speaking && styles.listenOn]} haptic="medium" onPress={() => toggleSpeak(a)} hitSlop={6}>
                <Text style={[styles.listenTxt, speaking && styles.listenTxtOn]}>{speaking ? '■ Stop' : '🔊 Listen'}</Text>
              </Touchable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.muted, fontSize: 14 },
  card: { backgroundColor: theme.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: '700', color: theme.ink, fontSize: 15, flex: 1 },
  liveTag: { backgroundColor: theme.brand, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  liveTxt: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 0.6 },
  time: { color: theme.muted, fontSize: 12, marginTop: 2 },
  body: { color: theme.ink, marginTop: 8, lineHeight: 20 },
  listen: { alignSelf: 'flex-start', marginTop: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.brand, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
  listenOn: { backgroundColor: theme.brand },
  listenTxt: { color: theme.brand, fontWeight: '800', fontSize: 13 },
  listenTxtOn: { color: '#fff' },
});
