import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { Card } from '../components/ui/Controls';
import { Screen } from '../components/ui/Screen';
import { useSync } from '../lib/sync';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useUI } from '../lib/ui';

const PREF_OPTIONS: { key: string; label: string; desc: string }[] = [
  { key: 'wheelchair', label: 'Wheelchair user', desc: 'Prioritise step-free routes and wheelchair-accessible attractions.' },
  { key: 'visual', label: 'Low vision / blind', desc: 'Highlight attractions with audio description.' },
  { key: 'hearing', label: 'Deaf / hard of hearing', desc: 'Highlight attractions with captioning or BSL.' },
  { key: 'sensory', label: 'Sensory sensitivities', desc: 'Surface sensory notes (noise, lighting, crowds) for each attraction.' },
];

export default function AccessibilityScreen() {
  const { c } = useUI();
  const { bundle } = useSync();
  const { user } = useAuth();

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;
    api<{ accessibilityPrefs?: Record<string, boolean> | null }>('/me').then((me) => {
      setPrefs(me.accessibilityPrefs ?? {});
    }).catch(() => undefined);
  }, [user]);

  async function togglePref(key: string) {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    try {
      await api('/me/accessibility', { method: 'PATCH', body: JSON.stringify({ [key]: next }) });
    } catch {
      setPrefs((p) => ({ ...p, [key]: !next })); // revert on failure
    }
  }

  const accessibleAttractions = (bundle?.attractions ?? []).filter((a) => a.wheelchairAccessible);
  const audioDescAttractions = (bundle?.attractions ?? []).filter((a) => a.hasAudioDescription);
  const captionedAttractions = (bundle?.attractions ?? []).filter((a) => a.hasCaptioning || a.hasBSL);
  const facilities = (bundle?.pois ?? []).filter((p) => p.type === 'ACCESSIBILITY');

  return (
    <Screen page="accessibility" title="Accessibility" subtitle="Your preferences and step-free information">
      {user ? (
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: c.text }]}>My preferences</Text>
          {PREF_OPTIONS.map((o) => (
            <View key={o.key} style={[styles.prefRow, { borderTopColor: c.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.prefLabel, { color: c.text }]}>{o.label}</Text>
                <Text style={[styles.prefDesc, { color: c.sub }]}>{o.desc}</Text>
              </View>
              <Switch
                value={!!prefs[o.key]}
                onValueChange={() => togglePref(o.key)}
                trackColor={{ true: c.primary, false: c.line }}
                thumbColor="#ffffff"
                accessibilityLabel={o.label}
              />
            </View>
          ))}
        </Card>
      ) : (
        <Text style={{ color: c.sub, fontSize: 14.5 }}>Sign in to save your accessibility preferences.</Text>
      )}

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: c.text }]}>Around the park</Text>
        <Text style={[styles.statRow, { color: c.sub }]}>{accessibleAttractions.length} wheelchair-accessible attraction{accessibleAttractions.length === 1 ? '' : 's'}</Text>
        <Text style={[styles.statRow, { color: c.sub }]}>{audioDescAttractions.length} with audio description</Text>
        <Text style={[styles.statRow, { color: c.sub }]}>{captionedAttractions.length} with captioning or BSL</Text>
        <Text style={[styles.statRow, { color: c.sub }]}>{facilities.length} accessibility facilit{facilities.length === 1 ? 'y' : 'ies'} marked on the map</Text>
      </Card>

      {facilities.length > 0 && (
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Accessibility facilities</Text>
          {facilities.map((f) => (
            <View key={f.id} style={[styles.facilityRow, { borderTopColor: c.line }]}>
              <Text style={[styles.prefLabel, { color: c.text }]}>{f.name}</Text>
              {f.description && <Text style={[styles.prefDesc, { color: c.sub }]}>{f.description}</Text>}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  prefLabel: { fontSize: 14.5, fontWeight: '700' },
  prefDesc: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  statRow: { fontSize: 14, marginTop: 8 },
  facilityRow: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
