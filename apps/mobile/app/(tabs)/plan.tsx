import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Touchable } from '../../components/Touchable';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Controls';
import { Icon } from '../../components/ui/Icon';
import { Screen } from '../../components/ui/Screen';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { serif, categoryColor, featureGradient } from '../../lib/theme';
import { useUI } from '../../lib/ui';
import { SkeletonRows } from '../../components/Shimmer';
import type { OptimizedItinerary } from '../../lib/shared';

export default function PlanScreen() {
  const { bundle, date } = useSync();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const { c } = useUI();
  const attractions = (bundle?.attractions ?? []).filter((a) => a.category !== 'EVENING_SHOW');
  const durationById = useMemo(
    () => new Map((bundle?.attractions ?? []).map((a) => [a.id, a.durationMins])),
    [bundle],
  );
  const nameById = useMemo(
    () => new Map((bundle?.attractions ?? []).map((a) => [a.id, a.name])),
    [bundle],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<OptimizedItinerary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const allOn = attractions.length > 0 && selected.size === attractions.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allOn ? new Set() : new Set(attractions.map((a) => a.id)));
  }

  async function optimize() {
    setLoading(true);
    setPlan(null);
    setSaved(false);
    try {
      const result = await api<OptimizedItinerary>('/itinerary/optimize', {
        method: 'POST',
        body: JSON.stringify({ date, attractionIds: [...selected], arrival: '10:30', departure: '18:00' }),
      });
      setPlan(result);
    } catch {
      setPlan({ date, stops: [], unschedulable: [] });
    } finally {
      setLoading(false);
    }
  }

  async function saveDay() {
    if (!plan || plan.stops.length === 0) return;
    if (!user) { router.push('/auth'); return; }
    setSaving(true);
    try {
      await api('/itinerary', {
        method: 'POST',
        body: JSON.stringify({ date, showSessionIds: plan.stops.map((s) => s.showSessionId) }),
      });
      setSaved(true);
    } catch {
      // offline or request failed — leave the plan on screen, let them retry
    } finally {
      setSaving(false);
    }
  }

  // Plan summary metrics.
  const summary = useMemo(() => {
    if (!plan || plan.stops.length === 0) return null;
    const first = plan.stops[0]!;
    const last = plan.stops[plan.stops.length - 1]!;
    const walkMins = Math.round(plan.stops.reduce((sum, s) => sum + s.walkSecondsFromPrev, 0) / 60);
    return { count: plan.stops.length, from: fmtTime(first.startTime), to: fmtTime(last.endTime), walkMins };
  }, [plan]);

  return (
    <Screen page="plan" title={t('plan.title')} subtitle="Build a walkable, clash-free day" colors={featureGradient.programme} padded={false} contentStyle={styles.body}>
      <Text style={[styles.muted, { color: c.sub }]}>
        Pick the shows you don’t want to miss and we’ll fit them into a walkable, clash-free timetable.
      </Text>

      <View>
        <View style={styles.pickHeader}>
          <Text style={[styles.pickHeaderLabel, { color: c.sub }]}>CHOOSE YOUR SHOWS</Text>
          <Touchable onPress={toggleAll} hitSlop={8}>
            <Text style={[styles.selectAll, { color: c.link }]}>{allOn ? 'Clear all' : 'Select all'}</Text>
          </Touchable>
        </View>

        <View style={{ gap: 10 }}>
          {!bundle && <SkeletonRows count={6} height={64} />}
          {attractions.map((a) => {
            const on = selected.has(a.id);
            return (
              <Card key={a.id} onPress={() => toggle(a.id)} style={[styles.pick, on && { backgroundColor: c.tint }]}>
                <View style={[styles.dot, { backgroundColor: categoryColor[a.category] ?? c.sub }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickText, { color: c.text }]}>{a.name}</Text>
                  <Text style={[styles.pickMeta, { color: c.sub }]}>
                    {a.category.toLowerCase().replace('_', ' ')} · {a.durationMins} min
                  </Text>
                </View>
                <View style={[styles.checkBox, { backgroundColor: on ? c.primary : c.tint }]}>
                  <Icon name={on ? 'check' : 'star'} color={on ? '#ffffff' : c.link} size={on ? 16 : 14} strokeWidth={on ? 3 : 1.8} />
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      <Button
        full
        label={`${t('plan.optimise')}${selected.size ? ` (${selected.size})` : ''}`}
        onPress={optimize}
        loading={loading}
        disabled={selected.size === 0}
      />

      {plan && (
        <View style={{ marginTop: 10 }}>
          <Text accessibilityRole="header" style={[styles.h2, { color: c.text }]}>Your day, planned</Text>

          {summary && (
            <Card style={styles.summary}>
              <Summary n={summary.count} label={summary.count === 1 ? 'show' : 'shows'} />
              <View style={[styles.summaryDivider, { backgroundColor: c.line }]} />
              <Summary n={`${summary.from}–${summary.to}`} label="your window" small />
              <View style={[styles.summaryDivider, { backgroundColor: c.line }]} />
              <Summary n={`${summary.walkMins}m`} label="walking" />
            </Card>
          )}

          {plan.stops.length === 0 && (
            <Card style={styles.emptyPlan}>
              <Text style={[styles.emptyTitle, { color: c.text }]}>Nothing could be scheduled</Text>
              <Text style={[styles.muted, { color: c.sub }]}>Try selecting fewer shows, or check you’re on an open day.</Text>
            </Card>
          )}

          {/* Connected timeline */}
          {plan.stops.map((s, i) => {
            const color = categoryColor[s.category] ?? c.link;
            const dur = durationById.get(s.attractionId);
            const isLast = i === plan.stops.length - 1;
            return (
              <View key={s.showSessionId}>
                {i > 0 && s.walkSecondsFromPrev > 0 && (
                  <View style={styles.walkRow}>
                    <View style={styles.walkConnector} />
                    <Text style={[styles.walk, { color: c.sub }]}>🚶 {Math.round(s.walkSecondsFromPrev / 60)} min walk</Text>
                  </View>
                )}
                <View style={styles.tlRow}>
                  <View style={styles.nodeCol}>
                    <View style={[styles.node, { backgroundColor: color }]}>
                      <Text style={styles.nodeNum}>{i + 1}</Text>
                    </View>
                    {!isLast && <View style={[styles.nodeLine, { backgroundColor: c.line }]} />}
                  </View>
                  <Card style={[styles.stopCard, { borderLeftColor: color }]}>
                    <View style={styles.stopHead}>
                      <Text style={[styles.stopTime, { color: c.text }]}>{fmtTime(s.startTime)}</Text>
                      {dur != null && <Text style={[styles.stopDur, { color: c.sub }]}>{dur} min</Text>}
                    </View>
                    <Text style={[styles.stopName, { color: c.text }]}>{s.attractionName}</Text>
                    <Text style={[styles.stopMeta, { color: c.sub }]}>Ends {fmtTime(s.endTime)} · {s.reminderMins} min reminder</Text>
                  </Card>
                </View>
              </View>
            );
          })}

          {plan.unschedulable.length > 0 && (
            <Card style={[styles.clashBox, { backgroundColor: c.tint }]}>
              <Text style={[styles.clashTitle, { color: c.text }]}>Couldn’t fit these in</Text>
              <Text style={[styles.muted, { color: c.sub }]}>{plan.unschedulable.map((id) => nameById.get(id) ?? id).join(', ')} — they clash with your other picks.</Text>
            </Card>
          )}

          {plan.stops.length > 0 && (
            saved ? (
              <Card style={[styles.savedBox, { backgroundColor: c.tint }]}>
                <Text style={[styles.savedText, { color: c.ok }]}>✓ Saved — we’ll remind you before each show starts.</Text>
              </Card>
            ) : (
              <Button full label={user ? 'Save my day & remind me' : 'Sign in to save & get reminders'} onPress={saveDay} loading={saving} style={{ marginTop: 20 }} />
            )
          )}
        </View>
      )}
    </Screen>
  );
}

function Summary({ n, label, small }: { n: number | string; label: string; small?: boolean }) {
  const { c } = useUI();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.summaryNum, { color: c.link }, small && { fontSize: 14 }]}>{n}</Text>
      <Text style={[styles.summaryLabel, { color: c.sub }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 18 },
  h2: { fontFamily: serif, fontSize: 16.5, fontWeight: '800', marginBottom: 12 },
  muted: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  pickHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  pickHeaderLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  selectAll: { fontWeight: '700', fontSize: 13.5 },
  pick: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  pickText: { fontSize: 15.5, fontWeight: '700' },
  pickMeta: { fontSize: 12.5, marginTop: 2, textTransform: 'capitalize' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  checkBox: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, marginBottom: 18 },
  summaryDivider: { width: 1, height: 28 },
  summaryNum: { fontFamily: serif, fontSize: 16.5, fontWeight: '800' },
  summaryLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  emptyPlan: { padding: 18 },
  emptyTitle: { fontWeight: '800', fontSize: 15.5 },
  tlRow: { flexDirection: 'row', gap: 12 },
  nodeCol: { width: 30, alignItems: 'center' },
  node: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  nodeNum: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  nodeLine: { flex: 1, width: 2, marginVertical: 2 },
  stopCard: { flex: 1, borderLeftWidth: 4, padding: 14, marginBottom: 4 },
  stopHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stopTime: { fontWeight: '800', fontSize: 16 },
  stopDur: { fontSize: 12, fontWeight: '600' },
  stopName: { fontWeight: '700', fontSize: 15, marginTop: 4 },
  stopMeta: { fontSize: 12.5, marginTop: 4 },
  walkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 26 },
  walkConnector: { width: 30, alignItems: 'center' },
  walk: { fontSize: 12.5 },
  clashBox: { padding: 14, marginTop: 12 },
  clashTitle: { fontWeight: '800', fontSize: 14.5 },
  savedBox: { padding: 14, marginTop: 20, alignItems: 'center' },
  savedText: { fontWeight: '700', fontSize: 13.5 },
});
