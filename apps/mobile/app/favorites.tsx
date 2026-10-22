import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ManagedImage } from '../components/ManagedImage';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Controls';
import { Cover } from '../components/ui/Cover';
import { Icon } from '../components/ui/Icon';
import { Screen } from '../components/ui/Screen';
import { useSync, type Attraction } from '../lib/sync';
import { useFavoriteIds } from '../lib/favorites';
import { serif, featureGradient } from '../lib/theme';
import { useUI } from '../lib/ui';

export function AttractionListScreen({ page, title, label, emptyHeading, emptyBody, slot, ids }: {
  page: string; title: string; label: string; emptyHeading: string; emptyBody: string; slot: string; ids: Set<string> | null;
}) {
  const router = useRouter();
  const { c } = useUI();
  const { bundle } = useSync();
  const items: Attraction[] = ids ? (bundle?.attractions ?? []).filter((a) => ids.has(a.id)) : [];
  const hasItems = ids && items.length > 0;

  return (
    <Screen page={page} title={title} subtitle="Shows and places you have saved" colors={featureGradient.programme} scroll={!!hasItems} contentStyle={hasItems ? undefined : styles.emptyBox}>
      {hasItems ? (
        items.map((a) => (
          <Card key={a.id} style={styles.row} onPress={() => router.push(`/attraction/${a.slug}`)}>
            <Cover image={a.heroImage} color={featureGradient.programme.from} icon="star" height={58} width={58} radius={14} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{a.name}</Text>
              {a.tagline && <Text style={[styles.sub, { color: c.sub }]} numberOfLines={1}>{a.tagline}</Text>}
              <Text style={[styles.cat, { color: c.sub }]}>{a.category.replace('_', ' ').toLowerCase()}</Text>
            </View>
            <Icon name="chevron" color={c.placeholder} size={18} />
          </Card>
        ))
      ) : (
        <>
          <ManagedImage slot={slot} style={{ width: 150, height: 150, borderRadius: 20 }} fadeColor={c.screen} />
          <Text style={[styles.emptyLabel, { color: c.sub }]}>{label}</Text>
          <Text style={[styles.emptyHeading, { color: c.text }]}>{emptyHeading}</Text>
          <Text style={[styles.emptyBody, { color: c.sub }]}>{emptyBody}</Text>
          <Button label="Discover" onPress={() => router.push('/(tabs)/shows')} style={{ marginTop: 18, alignSelf: 'center' }} />
        </>
      )}
    </Screen>
  );
}

export default function FavoritesScreen() {
  const { ids } = useFavoriteIds();
  return (
    <AttractionListScreen
      page="favorites" title="My favourites" label="MY FAVOURITES" slot="favorites.empty"
      emptyHeading="Create your favourites list"
      emptyBody="Shows, restaurants and activities appear here when you mark them as favourites."
      ids={ids}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { width: 58, height: 58, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  name: { fontWeight: '800', fontSize: 15.5 },
  sub: { fontSize: 13, marginTop: 1 },
  cat: { fontSize: 11.5, marginTop: 2, textTransform: 'capitalize' },
  emptyBox: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 6 },
  emptyLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 18 },
  emptyHeading: { fontFamily: serif, fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  emptyBody: { fontSize: 14.5, textAlign: 'center', lineHeight: 21, marginTop: 6 },
});
