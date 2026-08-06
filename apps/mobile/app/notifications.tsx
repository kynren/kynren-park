import { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useSync, type Announcement } from '../lib/sync';
import { api } from '../lib/api';
import { theme } from '../lib/theme';

export default function NotificationsScreen() {
  const { bundle, date } = useSync();
  // Seed from the offline bundle so there's always something to show offline.
  const [items, setItems] = useState<Announcement[]>(bundle?.announcements ?? []);
  const [refreshing, setRefreshing] = useState(false);

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

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {items.length === 0 ? (
        <Text style={styles.muted}>No notifications yet. Park announcements and your show reminders will appear here.</Text>
      ) : (
        items.map((a) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.title}>📣 {a.title}</Text>
            <Text style={styles.time}>{new Date(a.createdAt).toLocaleString('en-GB')}</Text>
            <Text style={styles.body}>{a.body}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.muted, fontSize: 14 },
  card: { backgroundColor: theme.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  title: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  time: { color: theme.muted, fontSize: 12, marginTop: 2 },
  body: { color: theme.ink, marginTop: 8, lineHeight: 20 },
});
