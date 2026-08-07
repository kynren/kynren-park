import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ScrollView, View, Text, StyleSheet, Image } from 'react-native';
import { Touchable } from '../../components/Touchable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { theme, categoryColor, statusColor } from '../../lib/theme';
import { useThemePref } from '../../lib/theme-context';

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', text: '#ffffff', sub: '#9a9a9a', card: '#181818', line: '#262626', link: '#5aa9e6', chip: '#1f1f1f' }
    : { screen: '#ffffff', text: '#16324f', sub: '#6b6460', card: '#f6f3ef', line: '#e4ddd5', link: '#2b6cb0', chip: '#f1ece5' };
}

export default function AttractionDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle, date } = useSync();
  const { user } = useAuth();
  const router = useRouter();
  const pal = usePalette();
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
      <View style={[styles.center, { backgroundColor: pal.screen }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: pal.sub }}>Show not found.</Text>
      </View>
    );
  }

  const isRealToday = date === new Date().toISOString().slice(0, 10);
  const ref = isRealToday ? Date.now() : new Date(`${date}T00:00:00.000Z`).getTime();
  const next = sessions.find((s) => new Date(s.endTime).getTime() > ref && s.status !== 'CANCELLED');
  const statusLine = next ? `Next show at ${fmtTime(next.revisedStart ?? next.startTime)}` : 'No more shows today';

  const access: string[] = [];
  if (attraction.wheelchairAccessible) access.push('♿  Step-free access');
  if (attraction.hasAudioDescription) access.push('🔊  Audio described');
  if (attraction.hasCaptioning) access.push('💬  Captioned performances');
  if (attraction.hasBSL) access.push('🤟  BSL interpreted');

  return (
    <View style={[styles.screen, { backgroundColor: pal.screen }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Fixed compact top bar when there's no hero image — stays put while content scrolls. */}
      {!attraction.heroImage && (
        <View style={[styles.headerBar, { backgroundColor: categoryColor[attraction.category] ?? theme.brand, paddingTop: insets.top + 8 }]}>
          <Touchable style={styles.headerBack} onPress={() => router.back()} hitSlop={8}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
          </Touchable>
          <Text style={styles.headerTitle} numberOfLines={1}>{attraction.name}</Text>
        </View>
      )}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Full-bleed hero image scrolls with the content (back button floats over it). */}
        {attraction.heroImage ? (
          <View style={styles.hero}>
            <Image source={{ uri: attraction.heroImage }} style={styles.heroImg} resizeMode="contain" />
            <Touchable style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M15 5l-7 7 7 7" /></Svg>
            </Touchable>
          </View>
        ) : null}

        {/* Title block */}
        <View style={styles.pad}>
          <View style={styles.titleRow}>
            <Touchable onPress={toggleFavorite} hitSlop={8}>
              <Star filled={favorite} color={favorite ? theme.brand : pal.sub} />
            </Touchable>
            <Text style={[styles.title, { color: pal.text }]}>{attraction.name}</Text>
          </View>
          <Text style={[styles.place, { color: pal.sub }]}>Kynren – The Storied Lands</Text>
          <Text style={[styles.place, { color: pal.sub }]}>{attraction.category.replace('_', ' ').toLowerCase()}</Text>
          <Text style={[styles.status, { color: pal.text }]}>{statusLine}</Text>
        </View>

        {/* Showtimes */}
        <Divider color={pal.line} />
        <View style={styles.pad}>
          <Text style={[styles.centerH, { color: pal.text }]}>Today’s showtimes</Text>
          <Text style={[styles.centerSub, { color: pal.sub }]}>{fmtDateLong(date)}</Text>
          {sessions.length === 0 ? (
            <Text style={[styles.centerSub, { color: pal.sub, marginTop: 10 }]}>No sessions listed for this day.</Text>
          ) : (
            <View style={styles.times}>
              {sessions.map((s) => {
                const cancelled = s.status === 'CANCELLED';
                return (
                  <View key={s.id} style={[styles.timeChip, { backgroundColor: pal.chip, borderColor: pal.line }]}>
                    <Text style={[styles.timeChipTxt, { color: cancelled ? theme.danger : pal.text, textDecorationLine: cancelled ? 'line-through' : 'none' }]}>
                      {fmtTime(s.revisedStart ?? s.startTime)}
                    </Text>
                    {s.status !== 'SCHEDULED' && <View style={[styles.dot, { backgroundColor: statusColor[s.status] }]} />}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Find on Map */}
        <Divider color={pal.line} />
        <Touchable style={styles.findMap} onPress={() => router.push(`/map?focus=${attraction.id}`)}>
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={pal.text} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" /><Path d="M9 4v14M15 6v14" />
          </Svg>
          <Text style={[styles.findMapTxt, { color: pal.text }]}>Find on Map</Text>
        </Touchable>

        {/* Duration / suitability */}
        <Divider color={pal.line} />
        <View style={styles.pad}>
          <Text style={[styles.centerLabel, { color: pal.sub }]}>Duration</Text>
          <Text style={[styles.centerBig, { color: pal.text }]}>{attraction.durationMins} minutes</Text>
        </View>
        <Divider color={pal.line} />
        <View style={styles.pad}>
          <Text style={[styles.centerLabel, { color: pal.sub }]}>Suitable for</Text>
          <Text style={[styles.centerBig, { color: pal.text }]}>All ages</Text>
        </View>

        {/* Accessibility (expandable) */}
        <Divider color={pal.line} />
        <Touchable style={[styles.pad, styles.accessHead]} onPress={() => setShowAccess((v) => !v)}>
          <Text style={[styles.accessTitle, { color: pal.link }]}>Accessibility &amp; Other Information</Text>
          <Text style={{ color: pal.link, fontSize: 14 }}>{showAccess ? '▲' : '▼'}</Text>
        </Touchable>
        {showAccess && (
          <View style={styles.pad}>
            {access.length > 0 ? access.map((a) => <Text key={a} style={[styles.accessItem, { color: pal.text }]}>{a}</Text>) : <Text style={{ color: pal.sub }}>No specific accessibility features listed.</Text>}
            {attraction.sensoryNotes && <Text style={[styles.sensory, { color: pal.sub }]}>Sensory: {attraction.sensoryNotes}</Text>}
          </View>
        )}

        {/* Description */}
        <Divider color={pal.line} />
        <View style={styles.pad}>
          {attraction.tagline && <Text style={[styles.descLead, { color: pal.text }]}>{attraction.tagline}</Text>}
          <Text style={[styles.desc, { color: pal.text }]}>{attraction.synopsis}</Text>
        </View>

        {/* Mark as seen */}
        <View style={[styles.pad, { marginTop: 18 }]}>
          <Touchable style={[styles.seenBtn, { borderColor: seen ? theme.ok : pal.line }]} onPress={markSeen}>
            <Text style={[styles.seenTxt, { color: seen ? theme.ok : pal.text }]}>{seen ? '✓ Seen it' : 'Mark as seen'}</Text>
          </Touchable>
        </View>
      </ScrollView>
    </View>
  );
}

function Divider({ color }: { color: string }) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: 16 }} />;
}
function Star({ filled, color }: { filled: boolean; color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      <Path d="M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.2L12 17.8 6.1 20.4l1.3-6.2L2.7 9.6l6.3-.7Z" />
    </Svg>
  );
}
function fmtDateLong(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { width: '100%', height: 300, backgroundColor: '#0e1013' },
  heroImg: { width: '100%', height: 300 },
  heroFallback: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', paddingHorizontal: 20 },
  backBtn: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 14 },
  headerBack: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 19, fontWeight: '800' },
  pad: { paddingHorizontal: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  title: { flex: 1, fontSize: 26, fontWeight: '800' },
  place: { fontSize: 15, marginTop: 3 },
  status: { fontSize: 20, fontWeight: '800', marginTop: 10 },
  centerH: { textAlign: 'center', fontSize: 19, fontWeight: '800' },
  centerSub: { textAlign: 'center', fontSize: 13, marginTop: 3 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 14 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  timeChipTxt: { fontSize: 15, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  findMap: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  findMapTxt: { fontSize: 15, fontWeight: '700' },
  centerLabel: { textAlign: 'center', fontSize: 13 },
  centerBig: { textAlign: 'center', fontSize: 21, fontWeight: '800', marginTop: 4 },
  accessHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accessTitle: { fontSize: 17, fontWeight: '700' },
  accessItem: { fontSize: 15, marginBottom: 8 },
  sensory: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  descLead: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 15, lineHeight: 23 },
  seenBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  seenTxt: { fontWeight: '800', fontSize: 15 },
});
