import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Image, Dimensions, type LayoutChangeEvent } from 'react-native';
import { Touchable } from '../../components/Touchable';
import { useRouter } from 'expo-router';
import { useSync, type Attraction, type Session } from '../../lib/sync';
import { useUnreadNotifications } from '../../lib/notifications';
import { fmtTime, ukNow, ukTodayStr } from '../../lib/format';
import { serif, theme, categoryColor } from '../../lib/theme';
import { SkeletonRows } from '../../components/Shimmer';
import { Card } from '../../components/ui/Controls';
import { ScreenHeader } from '../../components/ui/Header';
import { Icon } from '../../components/ui/Icon';
import { useUI, type UIColors } from '../../lib/ui';

// Screen edge, then the card's own padding: the ruler and every show's timeline sit inside identical cards, so their
// hours line up (the old ruler was offset from the rows by the width of its clock icon).
const EDGE = 20;
const CARD_PAD = 14;
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

function minsUTC(iso: string) {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
function fmtDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d}/${m}/${y}`;
}

export default function ProgramScreen() {
  const { bundle, setDate } = useSync();
  const { count: unread } = useUnreadNotifications();
  const router = useRouter();
  const { c } = useUI();
  const [trackW, setTrackW] = useState(Dimensions.get('window').width - (EDGE + CARD_PAD) * 2);
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
    <View style={[styles.screen, { backgroundColor: c.screen }]}>
      <ScreenHeader
        title="Programme"
        right={
          <Touchable onPress={() => router.push('/notifications')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Notifications">
            <Icon name="bell" color={c.text} size={24} />
            {unread > 0 && (
              <View style={[styles.badge, { borderColor: c.screen }]}>
                <Text style={styles.badgeTxt}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            )}
          </Touchable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 28, gap: 14 }}>
        {/* Today's date (the programme is always today) and the shared time ruler */}
        {ruler && (
          <Card style={styles.rulerCard}>
            <View style={styles.rulerHead}>
              <Icon name="calendar" color={c.link} size={18} />
              <Text style={[styles.dateTxt, { color: c.text }]}>Today · {fmtDate(today)}</Text>
            </View>
            <View style={styles.rulerTrack} onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={contentW > trackW}>
                <View style={{ width: contentW, height: RULER_H }}>
                  <View style={[styles.rulerBase, { backgroundColor: c.line }]} />
                  {ruler.hours.map((h) => (
                    <View key={h} style={[styles.tick, { left: pos(h) }]}>
                      <View style={[styles.tickMark, { backgroundColor: c.line }]} />
                      <Text style={[styles.tickTxt, { color: c.sub }]}>{h / 60}h</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Card>
        )}

        {!bundle ? (
          <View style={{ padding: EDGE }}><SkeletonRows count={6} height={54} /></View>
        ) : rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            {bundle?.nextProgramDate ? (
              <Text style={[styles.emptyBig, { color: c.text }]}>The programme will be available from {fmtDate(bundle.nextProgramDate)}.</Text>
            ) : (
              <Text style={[styles.emptyBig, { color: c.text }]}>The programme isn’t available yet.</Text>
            )}
          </View>
        ) : null}
        {bundle && rows.map((r) => (
          <ProgramRow
            key={r.a.id}
            attraction={r.a}
            badge={r.badge}
            sessions={byAttraction.get(r.a.id) ?? []}
            c={c}
            pos={pos}
            trackW={trackW}
            contentW={contentW}
            onPress={() => router.push(`/attraction/${r.a.slug}`)}
            onMap={() => router.push(`/map?focus=${r.a.id}`)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ProgramRow({
  attraction, badge, sessions, c, pos, trackW, contentW, onPress, onMap,
}: {
  attraction: Attraction;
  badge: string;
  sessions: Session[];
  c: UIColors;
  pos: (min: number) => number;
  trackW: number;
  contentW: number;
  onPress: () => void;
  onMap: () => void;
}) {
  const continuous = sessions.length > 4;
  const isNew = attraction.sortOrder >= 90; // convention: high sortOrder flags "new" attractions
  // What guests most need to know at a glance: is it still on?
  const cancelledCount = sessions.filter((x) => x.status === 'CANCELLED').length;
  const status = sessions.length > 0 && cancelledCount === sessions.length ? { label: 'Cancelled', color: theme.danger }
    : cancelledCount > 0 ? { label: 'Some times cancelled', color: theme.danger }
      : sessions.some((x) => x.status === 'DELAYED') ? { label: 'Delayed', color: theme.warn }
        : null;

  return (
    <Card style={styles.rowCard}>
      <Touchable style={styles.rowHead} onPress={onPress}>
        <View style={styles.thumbWrap}>
          {attraction.heroImage ? (
            <Image source={{ uri: attraction.heroImage }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: categoryColor[attraction.category] ?? theme.muted }]} />
          )}
          <View style={[styles.pinBadge, { backgroundColor: c.primary, borderColor: c.card }]}>
            <Text style={styles.pinBadgeTxt}>{badge}</Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{attraction.name}</Text>
            {isNew && <Text style={styles.newBadge}>NEW</Text>}
          </View>
          <View style={styles.subRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="calendar" color={c.sub} size={14} />
              <Text style={[styles.sub, { color: c.sub }]}>{attraction.durationMins} mins</Text>
            </View>
            <View style={[styles.countChip, { backgroundColor: c.tint }]}>
              <Text style={[styles.countTxt, { color: c.link }]}>{sessions.length} {sessions.length === 1 ? 'time' : 'times'}</Text>
            </View>
          </View>
          {status && <Text style={[styles.statusTxt, { color: status.color }]}>{status.label}</Text>}
        </View>
        <Touchable onPress={onMap} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Show ${attraction.name} on the map`} style={[styles.mapBtn, { backgroundColor: c.tint }]}>
          <Icon name="pin" color={c.link} size={19} />
        </Touchable>
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
                  <Text style={[styles.timeLbl, { color: c.text }]} numberOfLines={1}>From {fmtTime(a.startTime)} to {fmtTime(b.endTime)}</Text>
                  <View style={[styles.lozenge, { width, backgroundColor: c.primary }]} />
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
                  <Text style={[styles.timeLbl, { color: cancelled ? theme.danger : c.text }]} numberOfLines={1}>{fmtTime(s.revisedStart ?? s.startTime)}</Text>
                  <View style={[styles.lozenge, { width: pw, backgroundColor: cancelled ? theme.danger : c.primary, opacity: cancelled ? 0.5 : 1 }]} />
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#d9453d', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5 },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  rulerCard: { marginHorizontal: EDGE, marginTop: 4, padding: CARD_PAD },
  rulerHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dateTxt: { fontSize: 15, fontWeight: '800' },
  rulerTrack: { height: RULER_H, position: 'relative' },
  rulerBase: { position: 'absolute', left: 0, right: 0, top: 22, height: 1 },
  tick: { position: 'absolute', alignItems: 'center', width: 40, marginLeft: -20 },
  tickMark: { width: 1, height: 8, marginTop: 14 },
  tickTxt: { fontSize: 11, marginTop: 2 },
  emptyWrap: { minHeight: 380, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyBig: { fontFamily: serif, textAlign: 'center', fontSize: 19, fontWeight: '800', lineHeight: 26 },
  rowCard: { marginHorizontal: EDGE, padding: CARD_PAD },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumbWrap: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#333' },
  pinBadge: { position: 'absolute', top: -6, left: -6, minWidth: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  pinBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16.5, fontWeight: '800', flexShrink: 1 },
  newBadge: { backgroundColor: theme.gold, color: '#3a2c00', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  sub: { fontSize: 13 },
  statusTxt: { fontSize: 12.5, fontWeight: '800', marginTop: 6 },
  mapBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  countChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  countTxt: { fontSize: 12, fontWeight: '700' },
  trackRow: { height: 40, marginTop: 10, position: 'relative' },
  timeLbl: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
  lozenge: { height: 11, borderRadius: 6 },
});
