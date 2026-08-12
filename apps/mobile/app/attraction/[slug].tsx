import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageCarousel } from '../../components/ImageCarousel';
import { CloseButton, IconBadge, TagChip, ActionPill, SectionLabel, ICONS, dk } from '../../components/DetailKit';
import { Touchable } from '../../components/Touchable';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { statusColor } from '../../lib/theme';

const HERO_HEIGHT = 340;

export default function AttractionDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle, date } = useSync();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const attraction = bundle?.attractions.find((a) => a.slug === slug);
  const sessions = useMemo(
    () => (bundle?.sessions ?? []).filter((s) => s.attraction.slug === slug).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [bundle, slug],
  );

  const [favorite, setFavorite] = useState(false);
  const [seen, setSeen] = useState(false);
  const [showAccess, setShowAccess] = useState(false);

  useEffect(() => {
    if (!user || !attraction) return;
    api<{ attractionId: string }[]>('/me/favorites').then((f) => setFavorite(f.some((x) => x.attractionId === attraction.id))).catch(() => undefined);
    api<{ attractionId: string }[]>('/me/seen').then((s) => setSeen(s.some((x) => x.attractionId === attraction.id))).catch(() => undefined);
  }, [user, attraction?.id]);

  async function toggleFavorite() {
    if (!user) return router.push('/auth');
    if (!attraction) return;
    setFavorite((v) => !v);
    await api('/me/favorites', { method: 'POST', body: JSON.stringify({ attractionId: attraction.id }) }).catch(() => setFavorite((v) => !v));
  }
  async function markSeen() {
    if (!user) return router.push('/auth');
    if (!attraction) return;
    setSeen(true);
    await api('/me/seen', { method: 'POST', body: JSON.stringify({ attractionId: attraction.id }) }).catch(() => setSeen(false));
  }

  if (!attraction) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: dk.sub }}>Show not found.</Text>
      </View>
    );
  }

  const images = attraction.images?.length ? attraction.images : attraction.heroImage ? [attraction.heroImage] : [];

  const access: string[] = [];
  if (attraction.wheelchairAccessible) access.push('♿  Step-free access');
  if (attraction.hasAudioDescription) access.push('🔊  Audio described');
  if (attraction.hasCaptioning) access.push('💬  Captioned performances');
  if (attraction.hasBSL) access.push('🤟  BSL interpreted');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', top: insets.top + 8, right: 14, zIndex: 10 }}><CloseButton onPress={() => router.back()} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {images.length > 0 ? (
          <ImageCarousel images={images} height={HERO_HEIGHT} />
        ) : (
          <View style={{ height: insets.top + 52 }} />
        )}

        <View style={[styles.sheet, images.length > 0 && styles.sheetOverlap]}>
          <View style={styles.titleRow}>
            <IconBadge letter={attraction.name[0]?.toUpperCase() ?? 'S'} />
            <Text style={styles.title}>{attraction.name}</Text>
          </View>

          {(attraction.tagline || attraction.synopsis) && (
            <Text style={styles.desc}>{attraction.tagline ? `${attraction.tagline}\n\n` : ''}{attraction.synopsis}</Text>
          )}

          <View style={styles.tagRow}>
            <TagChip icon="🎭" label={attraction.category.replace('_', ' ').toLowerCase()} />
            <TagChip icon="⏱️" label={`${attraction.durationMins} min`} />
            {access.map((a) => <TagChip key={a} icon={a.split(' ')[0]} label={a.replace(/^\S+\s+/, '')} />)}
          </View>

          <View style={styles.actionRow}>
            <ActionPill icon={ICONS.map} label="Go to" onPress={() => router.push(`/map?focus=${attraction.id}`)} />
            <ActionPill icon={ICONS.heart} label={favorite ? 'Favourited' : 'Favourites'} onPress={toggleFavorite} />
            <ActionPill icon={ICONS.check} label={seen ? 'Seen it' : 'I did it'} onPress={markSeen} />
          </View>

          <SectionLabel>Schedules</SectionLabel>
          <Text style={styles.scheduleSub}>{fmtDateLong(date)}</Text>
          {sessions.length === 0 ? (
            <Text style={styles.muted}>No sessions listed for this day.</Text>
          ) : (
            <View style={styles.times}>
              {sessions.map((s) => {
                const cancelled = s.status === 'CANCELLED';
                return (
                  <View key={s.id} style={styles.timeChip}>
                    <Text style={[styles.timeChipTxt, cancelled && { textDecorationLine: 'line-through', color: '#e37b7b' }]}>
                      {fmtTime(s.revisedStart ?? s.startTime)}
                    </Text>
                    {s.status !== 'SCHEDULED' && <View style={[styles.dot, { backgroundColor: statusColor[s.status] }]} />}
                  </View>
                );
              })}
            </View>
          )}

          {/* Accessibility (expandable) */}
          <Touchable style={styles.accessHead} onPress={() => setShowAccess((v) => !v)}>
            <Text style={styles.accessTitle}>Accessibility &amp; Other Information</Text>
            <Text style={styles.accessChevron}>{showAccess ? '▲' : '▼'}</Text>
          </Touchable>
          {showAccess && (
            <View style={{ marginTop: 10 }}>
              {access.length > 0 ? access.map((a) => <Text key={a} style={styles.accessItem}>{a}</Text>) : <Text style={styles.muted}>No specific accessibility features listed.</Text>}
              {attraction.sensoryNotes && <Text style={styles.sensory}>Sensory: {attraction.sensoryNotes}</Text>}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function fmtDateLong(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dk.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dk.bg },
  sheet: { backgroundColor: dk.sheet, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 },
  sheetOverlap: { marginTop: -22, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { flex: 1, color: dk.ink, fontSize: 24, fontWeight: '800' },
  desc: { color: dk.sub, fontSize: 14.5, lineHeight: 21, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  scheduleSub: { color: dk.sub, fontSize: 12.5, marginTop: -4, marginBottom: 10 },
  muted: { color: dk.sub, fontSize: 13, marginTop: 2 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  timeChipTxt: { fontSize: 14.5, fontWeight: '800', color: '#111' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  accessHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: dk.line },
  accessTitle: { fontSize: 15.5, fontWeight: '700', color: '#7fb3e6' },
  accessChevron: { color: '#7fb3e6', fontSize: 13 },
  accessItem: { fontSize: 14.5, color: dk.ink, marginBottom: 8 },
  sensory: { fontSize: 13.5, color: dk.sub, marginTop: 4, lineHeight: 19 },
});
