import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSync, type Restaurant } from '../../lib/sync';
import { useI18n } from '../../lib/i18n';
import { theme } from '../../lib/theme';

const priceLabel: Record<string, string> = { BUDGET: '£', MODERATE: '££', PREMIUM: '£££' };

export default function FoodScreen() {
  const { bundle } = useSync();
  const { t } = useI18n();
  const router = useRouter();
  const restaurants = bundle?.restaurants ?? [];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.headerRow}>
        <Text style={styles.h1}>{t('food.title')}</Text>
        <Pressable onPress={() => router.push('/orders')}>
          <Text style={styles.link}>{t('food.myOrders')}</Text>
        </Pressable>
      </View>
      <Text style={styles.muted}>Order ahead with Click &amp; Collect — skip the queue and pick up when it’s ready.</Text>

      <View style={{ marginTop: 16, gap: 12 }}>
        {restaurants.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} onPress={() => router.push(`/restaurant/${r.slug}`)} />
        ))}
        {restaurants.length === 0 && <Text style={styles.muted}>Loading outlets…</Text>}
      </View>
    </ScrollView>
  );
}

function RestaurantCard({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{restaurant.name}</Text>
        <Text style={styles.cuisine}>
          {restaurant.cuisine}
          {restaurant.cuisine ? ' · ' : ''}
          {priceLabel[(restaurant as { priceRange?: string }).priceRange ?? 'MODERATE'] ?? ''}
        </Text>
        {restaurant.openingHours && <Text style={styles.muted}>🕑 {restaurant.openingHours}</Text>}
        <Text style={styles.count}>{restaurant.menuItems.length} items · Click &amp; Collect</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 22, fontWeight: '800', color: theme.ink },
  link: { color: theme.brand, fontWeight: '700' },
  muted: { color: theme.muted, fontSize: 13, marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border },
  name: { fontSize: 17, fontWeight: '800', color: theme.ink },
  cuisine: { color: theme.brand, fontWeight: '600', marginTop: 2, fontSize: 13 },
  count: { color: theme.ink, fontSize: 12, marginTop: 6 },
  chev: { fontSize: 28, color: theme.muted, marginLeft: 8 },
});
