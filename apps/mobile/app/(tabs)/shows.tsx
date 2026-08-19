import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Image, Dimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../../components/Touchable';
import { useRouter } from 'expo-router';
import Svg, { Circle, Polyline, Line } from 'react-native-svg';
import { useSync, type Attraction, type Session } from '../../lib/sync';
import { useUnreadNotifications } from '../../lib/notifications';
import { fmtTime, ukNow, ukTodayStr } from '../../lib/format';
import { theme, categoryColor } from '../../lib/theme';
import { useThemePref } from '../../lib/theme-context';
import { SkeletonRows } from '../../components/Shimmer';

const HPAD = 14;
// Half the tick label's width (see styles.tick) — the leftmost/rightmost
// ticks are centred on the very edge of the scrollable ruler, so without this
// much lead-in/trail-out room their labels get clipped by the ScrollView's
// own bounds (only their right/left half was ever visible — "10h" showing as
// just "0h").
const TICK_PAD = 20;
// The tick mark + its label stack up to ~14+8+2+15 = 39px tall (marginTop:14
// tick mark, 8 tall, 2px gap, an 11pt label whose line-height alone can run
// ~15-18px on Android's default system font) inside what used to be a fixed
// 34px-tall row — a device with slightly taller line-height than assumed
// clips the bottom of every label. Sized with real headroom instead of the
// tightest math that happened to fit on one platform.
const RULER_H = 46;

function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? { screen: '#141414', rowA: '#1c1c1c', rowB: '#171717', text: '#ffffff', sub: '#9b9b9b', rule: '#3a3a3a', ruleText: '#8a8a8a', pill: '#f0f0f0', label: '#eaeaea', chip: '#2a2a2a', chipText: '#c9c9c9', header: '#141414' }
    : { screen: theme.bg, rowA: '#ffffff', rowB: '#f2ede6', text: theme.ink, sub: theme.muted, rule: '#d9d0c5', ruleText: theme.muted, pill: theme.brand, label: theme.ink, chip: '#efe9e2', chipText: theme.muted, header: theme.brand };
}

function minsUTC(iso: string) {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d}/${m}/${y}`;
}
function shiftDate(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function ClockIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="9" />
      <Polyline points="12 7 12 12 15.5 13.5" />
    </Svg>
  );
}

export default function ProgramScreen() {
  const { bundle, date, setDate } = useSync();
  const { count: unread } = useUnreadNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const dark = useThemePref().scheme === 'dark';
  const headerBg = dark ? pal.header : (bundle?.branding?.primary || pal.header);
  const [trackW, setTrackW] = useState(Dimensions.get('window').width - HPAD * 2);
  const today = ukTodayStr();
  // The programme always reflects the current day; the date is not selectable.
  useEffect(() => { setDate(today); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // Re-check which sessions have finished once a minute, so a show drops off
  // the timeline on its own while the screen stays open (not just on refresh).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const attractions = bundle?.attractions ?? [];
  // Once a session has ended for the day it comes off the timeline entirely —
  // an attraction with no sessions left today drops out of the list below too.
  const sessions = useMemo(() => {
    const nowMs = ukNow().getTime();
    return (bundle?.sessions ?? []).filter((s) => new Date(s.endTime).getTime() > nowMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, tick]);

  const byAttraction = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of sessions) {
      const arr = m.get(s.attractionId) ?? [];
      arr.push(s);
      m.set(s.attractionId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => minsUTC(a.revisedStart ?? a.startTime) - minsUTC(b.revisedStart ?? b.startTime));
    return m;
  }, [sessions]);

  // Daytime window drives the shared ruler; the late evening show would
  // otherwise stretch the axis and squash everything (its pill clamps right).
  const ruler = useMemo(() => {
    const day = sessions.filter((s) => s.attraction.category !== 'EVENING_SHOW');
    const basis = day.length > 0 ? day : sessions;
    if (basis.length === 0) return null;
    let lo = Infinity, hi = -Infinity;
    for (const s of basis) {
      lo = Math.min(lo, minsUTC(s.revisedStart ?? s.startTime));
      hi = Math.max(hi, minsUTC(s.endTime));
    }
    const start = Math.floor(lo / 60) * 60;
    const end = Math.max(start + 120, Math.ceil(hi / 60) * 60);
    const hours: number[] = [];
    for (let h = start; h <= end; h += 60) hours.push(h);
    return { start, end, hours };
  }, [sessions]);

  // Spread the day across a wide, horizontally-scrollable track so every show
  // time is readable (min 2.4px/min); falls back to the on-screen width. Adds
  // TICK_PAD of lead-in/trail-out room on each end (see its definition above)
  // so the first/last hour labels aren't clipped by the ScrollView's edges.
  const contentW = (ruler ? Math.max(trackW, Math.round((ruler.end - ruler.start) * 2.4)) : trackW) + TICK_PAD * 2;
  const pos = (min: number) => (ruler ? TICK_PAD + ((min - ruler.start) / (ruler.end - ruler.start)) * (contentW - TICK_PAD * 2) : 0);

  // Order: day attractions by sortOrder (numbered like the map), then evening show.
  const rows = useMemo(() => {
    const day = attractions.filter((a) => a.category !== 'EVENING_SHOW').sort((a, b) => a.sortOrder - b.sortOrder);
    const evening = attractions.filter((a) => a.category === 'EVENING_SHOW');
    return [
      ...day.map((a, i) => ({ a, badge: String(i + 1) })),
      ...evening.map((a) => ({ a, badge: '🌙' })),
    ].filter((r) => (byAttraction.get(r.a.id)?.length ?? 0) > 0);
  }, [attractions, byAttraction]);

  return (
    <View style={[styles.screen, { backgroundColor: pal.screen }]}>
      {/* Custom top bar — default brand colour, re-themed by branding.primary */}
      <View style={[styles.topBar, { backgroundColor: headerBg, paddingTop: insets.top + 8 }]}>
        <Text style={styles.brand}>KYNREN</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Touchable onPress={() => router.push('/notifications')} hitSlop={8} style={styles.avatar}>
            <Text style={{ fontSize: 16 }}>🔔</Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Touchable>
          <Touchable onPress={() => router.push('/profile')} hitSlop={8} style={styles.avatar}>
            <Text style={{ fontSize: 16 }}>👤</Text>
          </Touchable>
        </View>
      </View>

      {/* Date — locked to today, not selectable */}
      <View style={[styles.dateRow, { backgroundColor: pal.screen }]}>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.dateTxt, { color: pal.text }]}>{fmtDate(today)}</Text>
          <View style={styles.dateUnderline} />
        </View>
      </View>

      {/* Shared time ruler */}
      {ruler && (
        <View style={styles.rulerRow}>
          <View style={styles.clockCol}>
            <ClockIcon color={pal.text} />
          </View>
          <View style={styles.rulerTrack} onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={contentW > trackW}>
              <View style={{ width: contentW, height: RULER_H }}>
                <View style={[styles.rulerBase, { backgroundColor: pal.rule }]} />
                {ruler.hours.map((h) => (
                  <View key={h} style={[styles.tick, { left: pos(h) }]}>
                    <View style={[styles.tickMark, { backgroundColor: pal.rule }]} />
                    <Text style={[styles.tickTxt, { color: pal.ruleText }]}>{h / 60}h</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {!bundle ? (
          <View style={{ padding: 16 }}><SkeletonRows count={6} height={54} /></View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            {bundle?.nextProgramDate ? (
              <Text style={[styles.emptyBig, { color: pal.text }]}>The programme will be available from {fmtDate(bundle.nextProgramDate)}.</Text>
            ) : (
              <Text style={[styles.emptyBig, { color: pal.text }]}>The programme isn’t available yet.</Text>
            )}
          </View>
        ) : null}
        {bundle && rows.map((r, idx) => (
          <ProgramRow
            key={r.a.id}
            attraction={r.a}
            badge={r.badge}
            sessions={byAttraction.get(r.a.id) ?? []}
            pal={pal}
            pos={pos}
            trackW={trackW}
            contentW={contentW}
            bg={idx % 2 === 0 ? pal.rowA : pal.rowB}
            onPress={() => router.push(`/attraction/${r.a.slug}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ProgramRow({
  attraction, badge, sessions, pal, pos, trackW, contentW, bg, onPress,
}: {
  attraction: Attraction;
  badge: string;
  sessions: Session[];
  pal: ReturnType<typeof usePalette>;
  pos: (min: number) => number;
  trackW: number;
  contentW: number;
  bg: string;
  onPress: () => void;
}) {
  const continuous = sessions.length > 4;
  const isNew = attraction.sortOrder >= 90; // convention: high sortOrder flags "new" attractions

  return (
    <View style={[styles.row, { backgroundColor: bg }]}>
      <Touchable style={styles.rowHead} onPress={onPress}>
        <View style={styles.thumbWrap}>
          {attraction.heroImage ? (
            <Image source={{ uri: attraction.heroImage }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: categoryColor[attraction.category] ?? theme.muted }]} />
          )}
          <View style={styles.pinBadge}>
            <Text style={styles.pinBadgeTxt}>{badge}</Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: pal.text }]} numberOfLines={1}>{attraction.name}</Text>
            {isNew && <Text style={styles.newBadge}>NEW</Text>}
            <Text style={[styles.chevron, { color: pal.sub }]}>›</Text>
          </View>
          <View style={styles.subRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <ClockIcon color={pal.sub} size={14} />
              <Text style={[styles.sub, { color: pal.sub }]}>{attraction.durationMins} mins</Text>
            </View>
            <View style={[styles.countChip, { backgroundColor: pal.chip }]}>
              <Text style={[styles.countTxt, { color: pal.chipText }]}>+{sessions.length} ›</Text>
            </View>
          </View>
        </View>
      </Touchable>

      {/* Timeline track — horizontally scrollable; the show icon above stays put. */}
      <View style={styles.trackRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={contentW > trackW} contentContainerStyle={{ width: contentW, height: 40 }}>
          {continuous ? (
            (() => {
              const a = sessions[0]!, b = sessions[sessions.length - 1]!;
              const left = Math.max(0, pos(minsUTC(a.revisedStart ?? a.startTime)));
              const width = Math.max(40, pos(minsUTC(b.endTime)) - left);
              return (
                <View style={{ position: 'absolute', left }}>
                  <Text style={[styles.timeLbl, { color: pal.label }]} numberOfLines={1}>From {fmtTime(a.startTime)} to {fmtTime(b.endTime)}</Text>
                  <View style={[styles.lozenge, { width, backgroundColor: pal.pill }]} />
                </View>
              );
            })()
          ) : (
            sessions.map((s) => {
              const startMin = minsUTC(s.revisedStart ?? s.startTime);
              const durSpan = Math.max(10, minsUTC(s.endTime) - startMin);
              const x = pos(startMin);
              const pw = Math.max(30, Math.min(pos(startMin + durSpan) - x, 120));
              const cancelled = s.status === 'CANCELLED';
              return (
                <View key={s.id} style={{ position: 'absolute', left: Math.max(0, x) }}>
                  <Text style={[styles.timeLbl, { color: cancelled ? theme.danger : pal.label }]} numberOfLines={1}>{fmtTime(s.revisedStart ?? s.startTime)}</Text>
                  <View style={[styles.lozenge, { width: pw, backgroundColor: cancelled ? theme.danger : pal.pill, opacity: cancelled ? 0.5 : 1 }]} />
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: HPAD, paddingTop: 8, paddingBottom: 12 },
  brand: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#d9453d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#fff' },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, paddingVertical: 10 },
  dateArrow: { paddingHorizontal: 8 },
  dateArrowTxt: { fontSize: 26, fontWeight: '700' },
  dateTxt: { fontSize: 17, fontWeight: '800' },
  dateUnderline: { height: 3, width: 84, backgroundColor: theme.brand, borderRadius: 2, marginTop: 3 },
  rulerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: HPAD, paddingBottom: 6 },
  clockCol: { width: 30, paddingTop: 2 },
  rulerTrack: { flex: 1, height: RULER_H, position: 'relative' },
  rulerBase: { position: 'absolute', left: 0, right: 0, top: 22, height: 1 },
  tick: { position: 'absolute', alignItems: 'center', width: 40, marginLeft: -20 },
  tickMark: { width: 1, height: 8, marginTop: 14 },
  tickTxt: { fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  emptyWrap: { minHeight: 480, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyBig: { textAlign: 'center', fontSize: 19, fontWeight: '800', lineHeight: 26 },
  row: { paddingHorizontal: HPAD, paddingTop: 12, paddingBottom: 8 },
  rowHead: { flexDirection: 'row', gap: 12 },
  thumbWrap: { width: 52, height: 52 },
  thumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#333' },
  pinBadge: { position: 'absolute', top: -6, left: -6, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: theme.brand, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  pinBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  newBadge: { backgroundColor: theme.gold, color: '#3a2c00', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  chevron: { fontSize: 22, fontWeight: '400', marginLeft: 'auto' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sub: { fontSize: 13 },
  countChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  countTxt: { fontSize: 12, fontWeight: '700' },
  trackRow: { height: 40, marginTop: 8, position: 'relative' },
  timeLbl: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
  lozenge: { height: 11, borderRadius: 6 },
});
