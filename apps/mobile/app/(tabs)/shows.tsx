import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSync, type Attraction } from '../../lib/sync';
import { theme, categoryColor } from '../../lib/theme';

export default function ShowsScreen() {
  const { bundle } = useSync();
  const router = useRouter();
  const attractions = bundle?.attractions ?? [];

  return (
    <FlatList
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={attractions}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => <ShowCard attraction={item} onPress={() => router.push(`/attraction/${item.slug}`)} />}
      ListEmptyComponent={<Text style={{ color: theme.muted }}>Loading shows…</Text>}
    />
  );
}

function ShowCard({ attraction, onPress }: { attraction: Attraction; onPress: () => void }) {
  const access: string[] = [];
  if (attraction.wheelchairAccessible) access.push('♿ Step-free');
  if (attraction.hasAudioDescription) access.push('🔊 Audio described');
  if (attraction.hasCaptioning) access.push('💬 Captioned');
  if (attraction.hasBSL) access.push('🤟 BSL');

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={[styles.stripe, { backgroundColor: categoryColor[attraction.category] ?? theme.muted }]} />
      <View style={{ flex: 1, padding: 14 }}>
        <Text style={styles.name}>{attraction.name}</Text>
        {attraction.tagline && <Text style={styles.tagline}>{attraction.tagline}</Text>}
        <Text style={styles.synopsis} numberOfLines={2}>
          {attraction.synopsis}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>⏱ {attraction.durationMins} min</Text>
          {access.length > 0 && <Text style={styles.meta}>{access.join('  ')}</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: theme.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  stripe: { width: 8 },
  name: { fontSize: 17, fontWeight: '800', color: theme.ink },
  tagline: { color: theme.brand, fontWeight: '600', fontSize: 13, marginTop: 2 },
  synopsis: { color: theme.muted, fontSize: 13, marginTop: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 6 },
  meta: { color: theme.ink, fontSize: 12 },
});
