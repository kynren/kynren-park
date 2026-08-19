import { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Touchable } from '../../components/Touchable';
import { useSync } from '../../lib/sync';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { theme, categoryColor } from '../../lib/theme';
import { SkeletonRows } from '../../components/Shimmer';
import type { OptimizedItinerary } from '../../lib/shared';

export default function PlanScreen() {
  const { bundle, date } = useSync();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
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
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 44 }}>
      <Text style={styles.h1}>{t('plan.title')}</Text>
      <Text style={styles.muted}>
        Pick the shows you don’t want to miss and we’ll fit them into a walkable, clash-free timetable.
      </Text>

      <View style={styles.pickHeader}>
        <Text style={styles.pickHeaderLabel}>Choose your shows</Text>
        <Touchable onPress={toggleAll} hitSlop={8}>
          <Text style={styles.selectAll}>{allOn ? 'Clear all' : 'Select all'}</Text>
        </Touchable>
      </View>

      <View style={{ gap: 8 }}>
        {!bundle && <SkeletonRows count={6} height={64} />}
        {attractions.map((a) => {
          const on = selected.has(a.id);
          return (
            <Touchable key={a.id} style={[styles.pick, on && styles.pickOn]} onPress={() => toggle(a.id)}>
              <View style={[styles.dot, { backgroundColor: categoryColor[a.category] ?? theme.muted }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pickText, on && { fontWeight: '700' }]}>{a.name}</Text>
                <Text style={styles.pickMeta}>
                  {a.category.toLowerCase()} · ⏱ {a.durationMins} min
                </Text>
              </View>
              <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                <Text style={[styles.check, on && { color: '#fff' }]}>{on ? '✓' : '+'}</Text>
              </View>
            </Touchable>
          );
        })}
      </View>

      <Touchable style={[styles.cta, selected.size === 0 && styles.ctaDisabled]} onPress={optimize} disabled={loading || selected.size === 0}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>
            {t('plan.optimise')}
            {selected.size ? ` (${selected.size})` : ''}
          </Text>
        )}
      </Touchable>

      {plan && (
        <View style={{ marginTop: 26 }}>
          <Text style={styles.h2}>Your day, planned</Text>

          {summary && (
            <View style={styles.summary}>
              <Summary n={summary.count} label={summary.count === 1 ? 'show' : 'shows'} />
              <View style={styles.summaryDivider} />
              <Summary n={`${summary.from}–${summary.to}`} label="your window" small />
              <View style={styles.summaryDivider} />
              <Summary n={`${summary.walkMins}m`} label="walking" />
            </View>
          )}

          {plan.stops.length === 0 && (
            <View style={styles.emptyPlan}>
              <Text style={styles.emptyTitle}>Nothing could be scheduled</Text>
              <Text style={styles.muted}>Try selecting fewer shows, or check you’re on an open day.</Text>
            </View>
          )}

          {/* Connected timeline */}
          {plan.stops.map((s, i) => {
            const color = categoryColor[s.category] ?? theme.brand;
            const dur = durationById.get(s.attractionId);
            const isLast = i === plan.stops.length - 1;
            return (
              <View key={s.showSessionId}>
                {i > 0 && s.walkSecondsFromPrev > 0 && (
                  <View style={styles.walkRow}>
                    <View style={styles.walkConnector} />
                    <Text style={styles.walk}>🚶 {Math.round(s.walkSecondsFromPrev / 60)} min walk</Text>
                  </View>
                )}
                <View style={styles.tlRow}>
                  <View style={styles.nodeCol}>
                    <View style={[styles.node, { backgroundColor: color }]}>
                      <Text style={styles.nodeNum}>{i + 1}</Text>
                    </View>
                    {!isLast && <View style={styles.nodeLine} />}
                  </View>
                  <View style={[styles.stopCard, { borderLeftColor: color }]}>
                    <View style={styles.stopHead}>
                      <Text style={styles.stopTime}>{fmtTime(s.startTime)}</Text>
                      {dur != null && <Text style={styles.stopDur}>{dur} min</Text>}
                    </View>
                    <Text style={styles.stopName}>{s.attractionName}</Text>
                    <Text style={styles.stopMeta}>
                      Ends {fmtTime(s.endTime)} · 🔔 {s.reminderMins} min reminder
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {plan.unschedulable.length > 0 && (
            <View style={styles.clashBox}>
              <Text style={styles.clashTitle}>Couldn’t fit these in</Text>
              <Text style={styles.muted}>{plan.unschedulable.map((id) => nameById.get(id) ?? id).join(', ')} — they clash with your other picks.</Text>
            </View>
          )}

          {plan.stops.length > 0 && (
            saved ? (
              <View style={styles.savedBox}>
                <Text style={styles.savedText}>✓ Saved — we’ll remind you before each show starts.</Text>
              </View>
            ) : (
              <Touchable style={[styles.cta, styles.saveCta]} onPress={saveDay} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>{user ? 'Save my day & remind me' : 'Sign in to save & get reminders'}</Text>
                )}
              </Touchable>
            )
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Summary({ n, label, small }: { n: number | string; label: string; small?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.summaryNum, small && { fontSize: 13 }]}>{n}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800', color: theme.ink },
  h2: { fontSize: 17, fontWeight: '800', color: theme.ink, marginBottom: 12 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 4 },
  pickHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 20, marginBottom: 10 },
  pickHeaderLabel: { fontSize: 13, fontWeight: '700', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  selectAll: { color: theme.brand, fontWeight: '700', fontSize: 13 },
  pick: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, gap: 12 },
  pickOn: { borderColor: theme.brand, backgroundColor: '#fbf1f0' },
  pickText: { color: theme.ink, fontSize: 15, fontWeight: '600' },
  pickMeta: { color: theme.muted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  checkBox: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkBoxOn: { backgroundColor: theme.brand, borderColor: theme.brand },
  check: { color: theme.brand, fontWeight: '800', fontSize: 16 },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 18 },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  summary: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.border, paddingVertical: 14, marginBottom: 18 },
  summaryDivider: { width: 1, height: 28, backgroundColor: theme.border },
  summaryNum: { fontSize: 18, fontWeight: '800', color: theme.brand },
  summaryLabel: { fontSize: 11, color: theme.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  emptyPlan: { backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 18 },
  emptyTitle: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  tlRow: { flexDirection: 'row', gap: 12 },
  nodeCol: { width: 30, alignItems: 'center' },
  node: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  nodeNum: { color: '#fff', fontWeight: '800', fontSize: 14 },
  nodeLine: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 2 },
  stopCard: { flex: 1, backgroundColor: theme.card, borderRadius: 12, borderWidth: 1, borderColor: theme.border, borderLeftWidth: 4, padding: 14, marginBottom: 4 },
  stopHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stopTime: { fontWeight: '800', color: theme.ink, fontSize: 16 },
  stopDur: { color: theme.muted, fontSize: 12, fontWeight: '600' },
  stopName: { fontWeight: '700', color: theme.ink, fontSize: 15, marginTop: 4 },
  stopMeta: { color: theme.muted, fontSize: 12, marginTop: 4 },
  walkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 26 },
  walkConnector: { width: 30, alignItems: 'center' },
  walk: { color: theme.muted, fontSize: 12 },
  clashBox: { backgroundColor: '#fff7e6', borderRadius: 12, borderWidth: 1, borderColor: '#f0e2bf', padding: 14, marginTop: 12 },
  clashTitle: { fontWeight: '700', color: theme.ink, fontSize: 14 },
  saveCta: { marginTop: 20 },
  savedBox: { backgroundColor: '#eaf7ef', borderRadius: 12, borderWidth: 1, borderColor: '#bfe6cc', padding: 14, marginTop: 20, alignItems: 'center' },
  savedText: { color: '#1d7a42', fontWeight: '700', fontSize: 13.5 },
});
