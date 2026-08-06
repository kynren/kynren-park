import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl, Pressable } from 'react-native';
import * as Speech from 'expo-speech';
import { useSync, type Announcement } from '../lib/sync';
import { api } from '../lib/api';
import { theme } from '../lib/theme';

/** Is the announcement live right now (sent + inside its active window)? */
function isLive(a: Announcement, now: number) {
  if (!a.sentAt) return false;
  if (a.startAt && new Date(a.startAt).getTime() > now) return false;
  if (a.endAt && new Date(a.endAt).getTime() < now) return false;
  return true;
}

export default function NotificationsScreen() {
  const { bundle, date } = useSync();
  // Seed from the offline bundle so there's always something to show offline.
  const [items, setItems] = useState<Announcement[]>(bundle?.announcements ?? []);
  const [refreshing, setRefreshing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<Announcement[]>(`/announcements?date=${date}`);
      setItems(data);
    } catch {
      // Offline — keep the cached announcements.
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {items.length === 0 ? (
        <Text style={styles.muted}>No notifications yet. Park announcements and your show reminders will appear here.</Text>
      ) : (
        items.map((a) => {
          const speaking = speakingId === a.id;
          const live = isLive(a, now);
          return (
            <View key={a.id} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.title}>📣 {a.title}</Text>
                {live && <View style={styles.liveTag}><Text style={styles.liveTxt}>LIVE</Text></View>}
              </View>
              <Text style={styles.time}>{new Date(a.sentAt ?? a.createdAt).toLocaleString('en-GB')}</Text>
              <Text style={styles.body}>{a.body}</Text>
              <Pressable style={[styles.listen, speaking && styles.listenOn]} onPress={() => toggleSpeak(a)} hitSlop={6}>
                <Text style={[styles.listenTxt, speaking && styles.listenTxtOn]}>{speaking ? '■ Stop' : '🔊 Listen'}</Text>
              </Pressable>
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
