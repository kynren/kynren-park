import { PageBackdrop } from '../components/ui/PageBackdrop';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { RestaurantCard, useRestaurantFavs } from '../components/ui/RestaurantCard';
import { ScreenHeader } from '../components/ui/Header';
import { Reveal } from '../components/ui/Reveal';
import { useSync } from '../lib/sync';
import { featureGradient } from '../lib/theme';
import { useUI } from '../lib/ui';

const SLOT_TITLE: Record<string, string> = { lunch: 'Lunch', dinner: 'Dinner', sweet: 'Sweet break', collect: 'Click & Collect' };

function fmtMd(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString('en-GB', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default function RestaurantsScreen() {
  const { bundle, date } = useSync();
  const router = useRouter();
  const { c } = useUI();
  const { slot } = useLocalSearchParams<{ slot?: string }>();
  const { favs, toggle } = useRestaurantFavs();

  const all = bundle?.restaurants ?? [];
  // Click & Collect lists only the places that can really take an order.
  const restaurants = slot === 'collect' ? all.filter((r) => r.clickCollect !== false && r.menuItems.length > 0) : all;
  const slotName = slot ? SLOT_TITLE[slot] : undefined;
  const heading = slot === 'lunch' || slot === 'dinner' ? `${slotName} of ${fmtMd(date)}` : slotName ?? 'Our restaurants';

  return (
    <View style={[styles.screen, { backgroundColor: c.screen }]}>
      <PageBackdrop page="restaurants" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <ScreenHeader page="restaurants"
          title={heading}
          colors={featureGradient.restaurants}
          onMenu={() => router.back()}
          menuIcon="back"
        />
        <View style={styles.list}>
          {restaurants.length === 0 && <Text style={[styles.empty, { color: c.sub }]}>{all.length === 0 ? 'Loading restaurants…' : 'Nothing to show here yet.'}</Text>}
          {restaurants.map((r, i) => (
            <Reveal key={r.id} index={i}>
              <RestaurantCard r={r} faved={favs.has(r.id)} onFav={() => toggle(r.id)} />
            </Reveal>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: 20, gap: 16, marginTop: 20 },
  empty: { textAlign: 'center', marginTop: 20 },
});
