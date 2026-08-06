import { ScrollView, View, Text, StyleSheet, RefreshControl, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path, Polygon, G } from 'react-native-svg';
import { useSync, type Session } from '../../lib/sync';
import { fmtTime } from '../../lib/format';
import { theme, categoryColor, statusColor } from '../../lib/theme';
import { useThemePref } from '../../lib/theme-context';
import { SkeletonRows } from '../../components/Shimmer';

const HERO_H = Math.min(520, Math.max(420, Dimensions.get('window').height * 0.56));

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#0c0c0c', text: '#ffffff', sub: '#b4b4b4', card: '#1b1b1b', line: '#262626', outline: '#ffffff' }
    : { screen: theme.bg, text: theme.ink, sub: theme.muted, card: '#ffffff', line: theme.border, outline: theme.ink };
}

export default function HomeScreen() {
  const { bundle, date, refresh } = useSync();
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const upcoming = useMemo(() => {
    const sessions = bundle?.sessions ?? [];
    const isRealToday = date === new Date().toISOString().slice(0, 10);
    const reference = isRealToday ? Date.now() : new Date(`${date}T00:00:00.000Z`).getTime();
    return sessions
      .filter((s) => new Date(s.endTime).getTime() > reference)
      .sort((a, b) => new Date(a.revisedStart ?? a.startTime).getTime() - new Date(b.revisedStart ?? b.startTime).getTime())
      .slice(0, 6);
  }, [bundle, date]);
  const alerts = (bundle?.sessions ?? []).filter((s) => s.status === 'DELAYED' || s.status === 'CANCELLED');

  const hours = useMemo(() => {
    const ss = bundle?.sessions ?? [];
    if (!ss.length) return null;
    let loI = ss[0]!.startTime, hiI = ss[0]!.endTime;
    for (const s of ss) {
      if (new Date(s.startTime) < new Date(loI)) loI = s.startTime;
      if (new Date(s.endTime) > new Date(hiI)) hiI = s.endTime;
    }
    return { open: fmtTime(loI), close: fmtTime(hiI) };
  }, [bundle]);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.screen }}>
    <ScrollView showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 36 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={pal.sub} />}
    >
      {/* Cinematic hero */}
      <View style={{ height: HERO_H }}>
        <HeroArt fade={pal.screen} />
        <View style={styles.heroOverlay}>
          <View style={{ flex: 1 }} />
          <Text style={styles.tagline}>An epic tale{'\n'}of England</Text>
        </View>
      </View>

      {/* Primary actions */}
      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/book')}>
          <Text style={styles.primaryTxt}>Buy tickets</Text>
        </Pressable>
        <Pressable style={[styles.outlineBtn, { borderColor: pal.outline }]} onPress={() => router.push('/auth')}>
          <Text style={[styles.outlineTxt, { color: pal.text }]}>Create an account</Text>
        </Pressable>
      </View>

      {/* Welcome + opening hours */}
      <View style={styles.welcomeRow}>
        <Text style={styles.wave}>👋</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.welcomeH, { color: pal.text }]}>Welcome</Text>
          <View style={styles.welcomeSub}>
            <View style={styles.greenDot} />
            <Text style={[styles.welcomeTxt, { color: pal.sub }]}>
              {hours ? `Today, the park will be open from ${hours.open} to ${hours.close}` : 'Plan your day at Kynren – The Storied Lands'}
            </Text>
          </View>
        </View>
      </View>

      {/* Add visit dates */}
      <Pressable style={[styles.visitCard, { backgroundColor: pal.card }]} onPress={() => router.push('/plan')}>
        <View style={styles.visitIcon}>
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={pal.text} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <Rect x="4" y="5" width="16" height="16" rx="2.4" />
            <Path d="M4 9.5h16M8 3v4M16 3v4M8 13h2M12 13h2M8 16.5h2" />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.visitTitle, { color: pal.text }]}>Add your visit dates</Text>
          <Text style={[styles.visitSub, { color: pal.sub }]}>Tell us the dates of your visit to Kynren</Text>
        </View>
        <Text style={[styles.chev, { color: pal.sub }]}>›</Text>
      </Pressable>

      {bundle?.announcements?.[0] && (
        <View style={[styles.notice, { backgroundColor: pal.card, borderColor: pal.line }]}>
          <Text style={[styles.noticeTitle, { color: pal.text }]}>📣 {bundle.announcements[0].title}</Text>
          <Text style={[styles.noticeBody, { color: pal.sub }]}>{bundle.announcements[0].body}</Text>
        </View>
      )}

      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionH, { color: pal.text }]}>Today’s changes</Text>
          {alerts.map((s) => (
            <View key={s.id} style={[styles.alert, { backgroundColor: pal.card, borderColor: pal.line, borderLeftColor: statusColor[s.status] }]}>
              <Text style={[styles.alertName, { color: pal.text }]}>{s.attraction.name}</Text>
              <Text style={[styles.alertMeta, { color: pal.sub }]}>
                {s.status === 'CANCELLED' ? 'Cancelled' : `Delayed to ${fmtTime(s.revisedStart ?? s.startTime)}`}
                {s.note ? ` · ${s.note}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionH, { color: pal.text }]}>Coming up</Text>
        {!bundle ? (
          <SkeletonRows count={5} height={62} />
        ) : upcoming.length === 0 ? (
          <Text style={{ color: pal.sub, fontSize: 13 }}>No more shows today.</Text>
        ) : (
          upcoming.map((s) => (
            <SessionRow key={s.id} session={s} pal={pal} onPress={() => router.push(`/attraction/${s.attraction.slug}`)} />
          ))
        )}
      </View>
    </ScrollView>

      {/* Fixed top bar over the hero (with a scrim so it stays readable) */}
      <View style={[styles.fixedBar, { height: insets.top + 58 }]} pointerEvents="box-none">
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="hscrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={insets.top + 58} fill="url(#hscrim)" />
        </Svg>
        <View style={[styles.fixedBarRow, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View>
            <Text style={styles.wordmark}>KYNREN</Text>
            <View style={styles.wordmarkRule} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable style={styles.avatar} onPress={() => router.push('/notifications')}>
              <Text style={{ fontSize: 17 }}>🔔</Text>
            </Pressable>
            <Pressable style={styles.avatar} onPress={() => router.push('/settings')}>
              <Text style={{ fontSize: 18 }}>👤</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function SessionRow({ session, pal, onPress }: { session: Session; pal: ReturnType<typeof usePalette>; onPress: () => void }) {
  return (
    <Pressable style={[styles.row, { backgroundColor: pal.card, borderColor: pal.line }]} onPress={onPress}>
      <View style={[styles.cat, { backgroundColor: categoryColor[session.attraction.category] ?? theme.muted }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, { color: pal.text }]}>{session.attraction.name}</Text>
        <Text style={{ color: pal.sub, fontSize: 13 }}>{fmtTime(session.revisedStart ?? session.startTime)}</Text>
      </View>
      {session.status !== 'SCHEDULED' && (
        <View style={[styles.badge, { backgroundColor: statusColor[session.status] }]}>
          <Text style={styles.badgeText}>{session.status}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Stylised dusk hero: night sky, moon, hills and the Kynren keep. */
function HeroArt({ fade }: { fade: string }) {
  const W = 375, H = 520;
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#243a63" />
          <Stop offset="0.42" stopColor="#5b2f45" />
          <Stop offset="0.72" stopColor="#341a20" />
          <Stop offset="1" stopColor="#120c0b" />
        </LinearGradient>
        {/* Dissolves the hero into the page background (no hard edge). */}
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={fade} stopOpacity="0" />
          <Stop offset="0.7" stopColor={fade} stopOpacity="0.55" />
          <Stop offset="1" stopColor={fade} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width={W} height={H} fill="url(#sky)" />

      {/* Moon + glow */}
      <Circle cx="292" cy="86" r="46" fill="#ffffff" opacity={0.06} />
      <Circle cx="292" cy="86" r="30" fill="#f5eed6" opacity={0.95} />

      {/* Stars */}
      {STARS.map(([x, y, r], i) => (
        <Circle key={i} cx={x} cy={y} r={r} fill="#ffffff" opacity={0.5 + (i % 3) * 0.18} />
      ))}

      {/* Distant hills */}
      <Path d={`M0 ${H * 0.6} C 90 ${H * 0.54}, 150 ${H * 0.62}, 230 ${H * 0.58} S 340 ${H * 0.55}, ${W} ${H * 0.6} L ${W} ${H} L 0 ${H} Z`} fill="#20321f" opacity={0.85} />
      <Path d={`M0 ${H * 0.68} C 110 ${H * 0.62}, 200 ${H * 0.72}, 300 ${H * 0.66} S ${W} ${H * 0.68}, ${W} ${H * 0.7} L ${W} ${H} L 0 ${H} Z`} fill="#182617" />

      {/* The keep silhouette */}
      <G fill="#0f0a0c">
        <Rect x={W / 2 - 46} y={H * 0.5} width={92} height={H * 0.5} />
        <Rect x={W / 2 - 70} y={H * 0.57} width={26} height={H * 0.43} />
        <Rect x={W / 2 + 44} y={H * 0.57} width={26} height={H * 0.43} />
        {/* battlements */}
        {[-70, -60, -50, -14, -2, 10, 44, 54, 64].map((dx, i) => (
          <Rect key={i} x={W / 2 + dx} y={H * 0.5 - 8} width={8} height={10} />
        ))}
        {/* central spire */}
        <Polygon points={`${W / 2},${H * 0.42} ${W / 2 - 16},${H * 0.5} ${W / 2 + 16},${H * 0.5}`} />
      </G>
      {/* flags */}
      <Polygon points={`${W / 2},${H * 0.42} ${W / 2},${H * 0.36} ${W / 2 + 16},${H * 0.385}`} fill={theme.brand} />

      {/* Fade the hero into the page background */}
      <Rect x="0" y={H * 0.55} width={W} height={H * 0.45} fill="url(#fade)" />
    </Svg>
  );
}

const STARS: [number, number, number][] = [
  [40, 70, 1.4], [80, 40, 1], [130, 90, 1.2], [180, 50, 1.5], [210, 110, 1],
  [60, 130, 1], [150, 150, 1.3], [330, 150, 1.2], [350, 60, 1], [250, 60, 1.4],
  [110, 190, 1], [300, 200, 1.2], [30, 200, 1.1], [200, 200, 1],
];

const styles = StyleSheet.create({
  screen: { flex: 1 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 18, paddingBottom: 20 },
  fixedBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  fixedBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 18, paddingBottom: 10 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  wordmark: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: 3 },
  wordmarkRule: { height: 3, width: 96, backgroundColor: '#fff', borderRadius: 2, marginTop: 3, opacity: 0.9 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  tagline: { color: '#fff', fontSize: 34, fontWeight: '800', lineHeight: 38, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 },
  actions: { paddingHorizontal: 18, marginTop: -6, gap: 12 },
  primaryBtn: { backgroundColor: theme.brand, borderRadius: 999, paddingVertical: 17, alignItems: 'center' },
  primaryTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  outlineBtn: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 16, alignItems: 'center' },
  outlineTxt: { fontSize: 16, fontWeight: '800' },
  welcomeRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, marginTop: 26, alignItems: 'flex-start' },
  wave: { fontSize: 26 },
  welcomeH: { fontSize: 24, fontWeight: '800' },
  welcomeSub: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'flex-start' },
  greenDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#3bbf6a', marginTop: 5 },
  welcomeTxt: { flex: 1, fontSize: 15, lineHeight: 21 },
  visitCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginTop: 18, borderRadius: 14, padding: 14, gap: 14 },
  visitIcon: { width: 54, height: 54, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,29,33,0.12)' },
  visitTitle: { fontSize: 18, fontWeight: '800' },
  visitSub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  chev: { fontSize: 26, marginLeft: 6 },
  notice: { marginHorizontal: 18, marginTop: 18, borderRadius: 12, padding: 14, borderWidth: 1 },
  noticeTitle: { fontWeight: '800' },
  noticeBody: { marginTop: 4, fontSize: 13 },
  section: { paddingHorizontal: 18, marginTop: 22, gap: 8 },
  sectionH: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  alert: { borderRadius: 10, padding: 12, borderLeftWidth: 5, borderWidth: 1 },
  alertName: { fontWeight: '700' },
  alertMeta: { fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, borderWidth: 1, gap: 12 },
  cat: { width: 6, height: 38, borderRadius: 3 },
  rowName: { fontWeight: '700', fontSize: 15 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
