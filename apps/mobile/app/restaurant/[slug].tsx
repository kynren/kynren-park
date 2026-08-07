import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useSync } from '../../lib/sync';
import { poundsFromCents } from '../../lib/format';
import { theme } from '../../lib/theme';

export default function RestaurantScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle } = useSync();
  const restaurant = bundle?.restaurants.find((r) => r.slug === slug);

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={{ color: theme.muted }}>Outlet not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: restaurant.name }} />
      <Text style={styles.h1}>{restaurant.name}</Text>
      {restaurant.cuisine && <Text style={styles.cuisine}>{restaurant.cuisine}</Text>}

      {restaurant.openingHours ? (
        <View style={styles.hoursChip}>
          <Text style={styles.hoursIcon}>🕑</Text>
          <Text style={styles.hoursTxt}>Available {restaurant.openingHours}</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Menu</Text>
      {restaurant.menuItems.length === 0 ? (
        <Text style={styles.muted}>Menu coming soon.</Text>
      ) : (
        restaurant.menuItems.map((m) => (
          <View key={m.id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{m.name}</Text>
              {m.description && <Text style={styles.muted}>{m.description}</Text>}
              {m.dietaryTags.length > 0 && (
                <View style={styles.tagRow}>
                  {m.dietaryTags.map((t) => (
                    <Text key={t} style={styles.tag}>{t}</Text>
                  ))}
                </View>
              )}
            </View>
            <Text style={styles.price}>{poundsFromCents(m.priceCents)}</Text>
          </View>
        ))
      )}

      <Text style={styles.note}>Order ahead is coming soon — for now, pay at the outlet.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  h1: { fontSize: 24, fontWeight: '800', color: theme.ink },
  cuisine: { color: theme.brand, fontWeight: '600', marginTop: 2 },
  hoursChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginTop: 12 },
  hoursIcon: { fontSize: 14 },
  hoursTxt: { color: theme.ink, fontWeight: '700', fontSize: 13 },
  section: { fontSize: 16, fontWeight: '700', color: theme.ink, marginTop: 22, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.card, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 8, gap: 12 },
  itemName: { fontWeight: '700', color: theme.ink, fontSize: 15 },
  muted: { color: theme.muted, fontSize: 13, marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  price: { color: theme.brand, fontWeight: '800', fontSize: 15 },
  tag: { fontSize: 11, color: theme.ok, backgroundColor: '#e7f3ee', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, textTransform: 'uppercase' },
  note: { color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 20 },
});
