import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../../components/Touchable';
import { Button } from '../../components/ui/Button';
import { Card, SearchPill, SectionHeader } from '../../components/ui/Controls';
import { Icon, type IconName } from '../../components/ui/Icon';
import { RestaurantCard, useRestaurantFavs } from '../../components/ui/RestaurantCard';
import { ScreenHeader } from '../../components/ui/Header';
import { useSync } from '../../lib/sync';
import { featureGradient } from '../../lib/theme';
import { useUI } from '../../lib/ui';

const SLOTS: { slot: string; label: string; icon: IconName }[] = [
  { slot: 'lunch', label: 'Lunch', icon: 'fork' },
  { slot: 'dinner', label: 'Dinner', icon: 'star' },
  { slot: 'sweet', label: 'Sweet break', icon: 'heart' },
];

export default function RestaurantsTab() {
  const { bundle } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useUI();
  const { favs, toggle } = useRestaurantFavs();
  const restaurants = bundle?.restaurants ?? [];
  const collect = restaurants.filter((r) => r.clickCollect !== false && r.menuItems.length > 0).length;

  return (
    <View style={[styles.screen, { backgroundColor: c.screen }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <ScreenHeader title="Restaurants" colors={featureGradient.restaurants} overlap={27}>
          <SearchPill placeholder="Find a restaurant or a dish" onPress={() => router.navigate('/(tabs)/search?filter=food')} />
        </ScreenHeader>

        <View style={styles.slots}>
          {SLOTS.map((s) => (
            <Touchable key={s.slot} onPress={() => router.push(`/restaurants?slot=${s.slot}`)} accessibilityRole="button" accessibilityLabel={s.label} style={[styles.slot, { backgroundColor: c.card }]}>
              <View style={[styles.slotIcon, { backgroundColor: c.tint }]}>
                <Icon name={s.icon} color={c.link} size={22} />
              </View>
              <Text style={[styles.slotLabel, { color: c.text }]} numberOfLines={1}>{s.label}</Text>
            </Touchable>
          ))}
        </View>

        {collect > 0 && (
          <Card style={styles.collect}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.collectTitle, { color: c.text }]}>Click &amp; Collect</Text>
              <Text style={[styles.collectSub, { color: c.sub }]}>Order online, pick up on-site. Available only on the day of your visit.</Text>
              <Button size="sm" label="Order food" onPress={() => router.push('/restaurants?slot=collect')} style={{ marginTop: 12 }} />
            </View>
          </Card>
        )}

        <View style={{ marginTop: 26 }}>
          <SectionHeader title="Our restaurants" />
        </View>
        <View style={styles.list}>
          {restaurants.length === 0 && <Text style={[styles.empty, { color: c.sub }]}>Loading restaurants…</Text>}
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} r={r} faved={favs.has(r.id)} onFav={() => toggle(r.id)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  slots: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 20 },
  slot: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 18 },
  slotIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  slotLabel: { fontSize: 13, fontWeight: '700' },
  collect: { marginHorizontal: 20, marginTop: 16, padding: 18, flexDirection: 'row' },
  collectTitle: { fontSize: 17, fontWeight: '800' },
  collectSub: { fontSize: 13.5, lineHeight: 19, marginTop: 4 },
  list: { paddingHorizontal: 20, gap: 16, marginTop: 14 },
  empty: { textAlign: 'center', marginTop: 20 },
});
