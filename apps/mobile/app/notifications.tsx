import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useSync, type Announcement } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { type PersonalNotification } from '../lib/notifications';
import { api } from '../lib/api';
import { Touchable } from '../components/Touchable';
import { Card } from '../components/ui/Controls';
import { Icon, type IconName } from '../components/ui/Icon';
import { Screen } from '../components/ui/Screen';
import { useUI } from '../lib/ui';

/** Is the announcement live right now (sent + inside its active window)? */
function isLive(a: Announcement, now: number) {
  if (!a.sentAt) return false;
  if (a.startAt && new Date(a.startAt).getTime() > now) return false;
  if (a.endAt && new Date(a.endAt).getTime() < now) return false;
  return true;
}

const TYPE_ICON: Record<string, IconName> = { session: 'calendar', order: 'fork', reminder: 'bell' };

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
  const { c } = useUI();
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
    <Screen title="Notifications" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {items.length === 0 ? (
        <Text style={[styles.muted, { color: c.sub }]}>No notifications yet. Park announcements and your show reminders will appear here.</Text>
      ) : (
        items.map((item) => {
          if (item.kind === 'personal') {
            const n = item.n;
            return (
              <Card key={item.id} style={styles.card} onPress={n.deepLink ? () => router.push(n.deepLink as never) : undefined}>
                <View style={styles.head}>
                  <View style={[styles.icon, { backgroundColor: c.tint }]}>
                    <Icon name={TYPE_ICON[n.type] ?? 'bell'} color={c.link} size={18} />
                  </View>
                  <Text style={[styles.title, { color: c.text }]}>{n.title}</Text>
                </View>
                <Text style={[styles.time, { color: c.sub }]}>{new Date(n.createdAt).toLocaleString('en-GB')}</Text>
                <Text style={[styles.body, { color: c.text }]}>{n.body}</Text>
              </Card>
            );
          }
          const a = item.a;
          const speaking = speakingId === a.id;
          const live = isLive(a, now);
          return (
            <Card key={item.id} style={styles.card}>
              <View style={styles.head}>
                <View style={[styles.icon, { backgroundColor: c.tint }]}>
                  <Icon name="bell" color={c.link} size={18} />
                </View>
                <Text style={[styles.title, { color: c.text }]}>{a.title}</Text>
                {live && <View style={[styles.liveTag, { backgroundColor: c.accent }]}><Text style={styles.liveTxt}>LIVE</Text></View>}
              </View>
              <Text style={[styles.time, { color: c.sub }]}>{new Date(a.sentAt ?? a.createdAt).toLocaleString('en-GB')}</Text>
              <Text style={[styles.body, { color: c.text }]}>{a.body}</Text>
              <Touchable
                style={[styles.listen, { backgroundColor: speaking ? c.primary : c.tint }]}
                haptic="medium"
                onPress={() => toggleSpeak(a)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={speaking ? 'Stop reading aloud' : 'Listen to this announcement'}
              >
                <Text style={[styles.listenTxt, { color: speaking ? '#ffffff' : c.link }]}>{speaking ? '■ Stop' : '🔊 Listen'}</Text>
              </Touchable>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '800', fontSize: 15.5, flex: 1 },
  liveTag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  liveTxt: { color: '#ffffff', fontWeight: '800', fontSize: 10, letterSpacing: 0.6 },
  time: { fontSize: 12, marginTop: 8 },
  body: { marginTop: 6, lineHeight: 21, fontSize: 14.5 },
  listen: { alignSelf: 'flex-start', marginTop: 12, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  listenTxt: { fontWeight: '800', fontSize: 13 },
});
