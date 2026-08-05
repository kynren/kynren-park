import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { theme, categoryColor, statusColor } from '../../lib/theme';

export default function AttractionDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle } = useSync();
  const { user } = useAuth();
  const router = useRouter();
  const attraction = bundle?.attractions.find((a) => a.slug === slug);
  const sessions = (bundle?.sessions ?? []).filter((s) => s.attraction.slug === slug);

  const [favorite, setFavorite] = useState(false);
  const [seen, setSeen] = useState(false);

  // Load this attraction's favorite/seen state for the signed-in user.
  useEffect(() => {
    if (!user || !attraction) return;
    api<{ attractionId: string }[]>('/me/favorites')
      .then((f) => setFavorite(f.some((x) => x.attractionId === attraction.id)))
      .catch(() => undefined);
    api<{ attractionId: string }[]>('/me/seen')
      .then((s) => setSeen(s.some((x) => x.attractionId === attraction.id)))
      .catch(() => undefined);
  }, [user, attraction?.id]);

  async function toggleFavorite() {
    if (!user) return router.push('/auth');
    if (!attraction) return;
    setFavorite(true); // optimistic; endpoint is idempotent upsert
    await api('/me/favorites', { method: 'POST', body: JSON.stringify({ attractionId: attraction.id }) }).catch(() =>
      setFavorite(false),
    );
  }

  async function markSeen() {
    if (!user) return router.push('/auth');
    if (!attraction) return;
    setSeen(true);
    await api('/me/seen', { method: 'POST', body: JSON.stringify({ attractionId: attraction.id }) }).catch(() =>
      setSeen(false),
    );
  }

  if (!attraction) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.muted }}>Show not found.</Text>
      </View>
    );
  }

  const access: string[] = [];
  if (attraction.wheelchairAccessible) access.push('♿ Step-free access');
  if (attraction.hasAudioDescription) access.push('🔊 Audio described');
  if (attraction.hasCaptioning) access.push('💬 Captioned');
  if (attraction.hasBSL) access.push('🤟 BSL interpreted');

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: attraction.name }} />
      <View style={[styles.hero, { backgroundColor: categoryColor[attraction.category] ?? theme.brand }]}>
        <Text style={styles.heroCat}>{attraction.category.replace('_', ' ')}</Text>
        <Text style={styles.heroName}>{attraction.name}</Text>
        {attraction.tagline && <Text style={styles.heroTag}>{attraction.tagline}</Text>}
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, favorite && styles.actionOn]} onPress={toggleFavorite}>
          <Text style={[styles.actionText, favorite && styles.actionTextOn]}>{favorite ? '♥ Favourited' : '♡ Favourite'}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, seen && styles.actionOn]} onPress={markSeen}>
          <Text style={[styles.actionText, seen && styles.actionTextOn]}>{seen ? '✓ Seen' : 'Mark as seen'}</Text>
        </Pressable>
      </View>

      <Text style={styles.body}>{attraction.synopsis}</Text>
      <Text style={styles.meta}>⏱ Duration: {attraction.durationMins} minutes</Text>

      {access.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.h2}>Accessibility</Text>
          {access.map((a) => (
            <Text key={a} style={styles.access}>{a}</Text>
          ))}
        </View>
      )}
      {attraction.sensoryNotes && (
        <View style={styles.section}>
          <Text style={styles.h2}>Sensory notes</Text>
          <Text style={styles.muted}>{attraction.sensoryNotes}</Text>
        </View>
      )}

      <Text style={styles.h2}>Today’s times</Text>
      {sessions.length === 0 && <Text style={styles.muted}>No sessions listed for the selected day.</Text>}
      {sessions.map((s) => (
        <View key={s.id} style={styles.timeRow}>
          <Text style={styles.time}>{fmtTime(s.revisedStart ?? s.startTime)}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor[s.status] }]}>
            <Text style={styles.badgeText}>{s.status}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 16, padding: 20, marginBottom: 16 },
  heroCat: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6 },
  heroTag: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.card },
  actionOn: { borderColor: theme.brand, backgroundColor: '#fbf1f0' },
  actionText: { color: theme.ink, fontWeight: '600' },
  actionTextOn: { color: theme.brand },
  body: { color: theme.ink, fontSize: 15, lineHeight: 22 },
  meta: { color: theme.ink, marginTop: 12, fontWeight: '600' },
  section: { marginTop: 18 },
  h2: { fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 18, marginBottom: 8 },
  access: { color: theme.ink, fontSize: 14, marginBottom: 4 },
  muted: { color: theme.muted, fontSize: 14, lineHeight: 20 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8 },
  time: { fontWeight: '800', color: theme.ink, fontSize: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
