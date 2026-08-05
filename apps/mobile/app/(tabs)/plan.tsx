import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useSync } from '../../lib/sync';
import { api } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { theme, categoryColor } from '../../lib/theme';
import type { OptimizedItinerary } from '@kynren/shared';

export default function PlanScreen() {
  const { bundle, date } = useSync();
  const { t } = useI18n();
  const attractions = (bundle?.attractions ?? []).filter((a) => a.category !== 'EVENING_SHOW');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<OptimizedItinerary | null>(null);
  const [loading, setLoading] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function optimize() {
    setLoading(true);
    setPlan(null);
    try {
      const result = await api<OptimizedItinerary>('/itinerary/optimize', {
        method: 'POST',
        body: JSON.stringify({
          date,
          attractionIds: [...selected],
          arrival: '10:30',
          departure: '18:00',
        }),
      });
      setPlan(result);
    } catch {
      setPlan({ date, stops: [], unschedulable: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.h1}>{t('plan.title')}</Text>
      <Text style={styles.muted}>
        Pick the shows you don’t want to miss and we’ll fit them into a walkable, clash-free timetable.
      </Text>

      <View style={{ marginTop: 14, gap: 8 }}>
        {attractions.map((a) => {
          const on = selected.has(a.id);
          return (
            <Pressable key={a.id} style={[styles.pick, on && styles.pickOn]} onPress={() => toggle(a.id)}>
              <View style={[styles.dot, { backgroundColor: categoryColor[a.category] ?? theme.muted }]} />
              <Text style={[styles.pickText, on && { fontWeight: '700' }]}>{a.name}</Text>
              <Text style={styles.check}>{on ? '✓' : '+'}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable style={styles.cta} onPress={optimize} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t('plan.optimise')}{selected.size ? ` (${selected.size})` : ''}</Text>}
      </Pressable>

      {plan && (
        <View style={{ marginTop: 24 }}>
          <Text style={styles.h2}>Your itinerary</Text>
          {plan.stops.length === 0 && <Text style={styles.muted}>No shows could be scheduled — try selecting fewer or check the date.</Text>}
          {plan.stops.map((s, i) => (
            <View key={s.showSessionId}>
              {s.walkSecondsFromPrev > 0 && (
                <Text style={styles.walk}>🚶 {Math.round(s.walkSecondsFromPrev / 60)} min walk</Text>
              )}
              <View style={styles.stop}>
                <Text style={styles.stopTime}>{fmtTime(s.startTime)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName}>{s.attractionName}</Text>
                  <Text style={styles.muted}>Ends {fmtTime(s.endTime)} · reminder {s.reminderMins} min before</Text>
                </View>
                <Text style={styles.stopNum}>{i + 1}</Text>
              </View>
            </View>
          ))}
          {plan.unschedulable.length > 0 && (
            <Text style={[styles.muted, { marginTop: 10 }]}>
              Couldn’t fit: {plan.unschedulable.join(', ')}. They clash with your other picks.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 22, fontWeight: '800', color: theme.ink },
  h2: { fontSize: 16, fontWeight: '700', color: theme.ink, marginBottom: 10 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 4 },
  pick: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 14, gap: 12 },
  pickOn: { borderColor: theme.brand, backgroundColor: '#fbf1f0' },
  pickText: { flex: 1, color: theme.ink, fontSize: 15 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  check: { color: theme.brand, fontWeight: '800', fontSize: 18 },
  cta: { backgroundColor: theme.brand, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 18 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  walk: { color: theme.muted, fontSize: 12, marginLeft: 8, marginVertical: 4 },
  stop: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, gap: 12 },
  stopTime: { fontWeight: '800', color: theme.brand, fontSize: 15, width: 52 },
  stopName: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  stopNum: { color: theme.muted, fontWeight: '700' },
});
