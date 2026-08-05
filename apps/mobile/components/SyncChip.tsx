import { View, Text, StyleSheet } from 'react-native';
import { useSync } from '../lib/sync';
import { fmtRelative } from '../lib/format';
import { theme } from '../lib/theme';

/** Always-visible trust indicator: are we live, or showing cached data? */
export function SyncChip() {
  const { online, lastSynced } = useSync();
  return (
    <View style={[styles.chip, { backgroundColor: online ? '#e7f3ee' : '#fdeeee' }]}>
      <View style={[styles.dot, { backgroundColor: online ? theme.ok : theme.danger }]} />
      <Text style={styles.text}>
        {online ? 'Live' : 'Offline'} · updated {fmtRelative(lastSynced)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, color: theme.ink },
});
