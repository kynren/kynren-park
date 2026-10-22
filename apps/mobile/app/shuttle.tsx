import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from '../components/ui/Controls';
import { Screen } from '../components/ui/Screen';
import { api } from '../lib/api';
import { useUI } from '../lib/ui';

interface ShuttleStop {
  id: string;
  name: string;
  order: number;
  times: string[];
  poi: { name: string } | null;
}
interface ShuttleRoute {
  id: string;
  name: string;
  description: string | null;
  stops: ShuttleStop[];
}

export default function ShuttleScreen() {
  const { c } = useUI();
  const [routes, setRoutes] = useState<ShuttleRoute[] | null>(null);

  useEffect(() => {
    api<ShuttleRoute[]>('/shuttles').then(setRoutes).catch(() => setRoutes([]));
  }, []);

  return (
    <Screen page="shuttle" title="Shuttle" subtitle="Timetable and stops">
      <Text style={[styles.note, { color: c.sub }]}>
        Scheduled departure times below — this is a fixed timetable, not live GPS tracking.
      </Text>

      {routes === null ? (
        <Text style={{ color: c.sub }}>Loading…</Text>
      ) : routes.length === 0 ? (
        <Text style={{ color: c.sub }}>No shuttle routes are set up yet.</Text>
      ) : (
        routes.map((r) => (
          <Card key={r.id} style={styles.card}>
            <Text style={[styles.routeName, { color: c.text }]}>{r.name}</Text>
            {r.description && <Text style={[styles.routeDesc, { color: c.sub }]}>{r.description}</Text>}
            {r.stops.map((s) => (
              <View key={s.id} style={[styles.stopRow, { borderTopColor: c.line }]}>
                <Text style={[styles.stopName, { color: c.text }]}>{s.name}</Text>
                <Text style={[styles.stopTimes, { color: c.sub }]}>{s.times.length ? s.times.join(' · ') : 'No times set'}</Text>
              </View>
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 13.5, lineHeight: 19 },
  card: { padding: 18, gap: 4 },
  routeName: { fontSize: 18, fontWeight: '800' },
  routeDesc: { fontSize: 13.5, marginTop: 2, marginBottom: 6 },
  stopRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  stopName: { fontSize: 14.5, fontWeight: '700' },
  stopTimes: { fontSize: 13.5 },
});
