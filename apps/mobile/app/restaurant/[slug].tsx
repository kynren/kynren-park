import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageCarousel } from '../../components/ImageCarousel';
import { CloseButton, IconBadge, TagChip, ActionPill, SectionLabel, ICONS, dk } from '../../components/DetailKit';
import { useSync } from '../../lib/sync';
import { poundsFromCents } from '../../lib/format';

const HERO_HEIGHT = 340;

export default function RestaurantScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const restaurant = bundle?.restaurants.find((r) => r.slug === slug);

  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: dk.sub }}>Outlet not found.</Text>
      </View>
    );
  }

  const images = restaurant.images?.length ? restaurant.images : restaurant.heroImage ? [restaurant.heroImage] : [];

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', top: insets.top + 8, right: 14, zIndex: 10 }}><CloseButton onPress={() => router.back()} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {images.length > 0 ? (
          <ImageCarousel images={images} height={HERO_HEIGHT} />
        ) : (
          <View style={{ height: insets.top + 52 }} />
        )}

        <View style={[styles.sheet, images.length > 0 && styles.sheetOverlap]}>
          <View style={styles.titleRow}>
            <IconBadge letter={restaurant.name[0]?.toUpperCase() ?? 'R'} />
            <Text style={styles.title}>{restaurant.name}</Text>
          </View>

          {restaurant.description ? <Text style={styles.desc}>{restaurant.description}</Text> : null}

          <View style={styles.tagRow}>
            {restaurant.cuisine ? <TagChip icon="🍴" label={restaurant.cuisine} /> : null}
          </View>

          <View style={styles.actionRow}>
            <ActionPill icon={ICONS.map} label="Go to" onPress={() => router.push(`/map?focus=${restaurant.id}`)} />
            <ActionPill icon={ICONS.menu} label="Menu" onPress={() => {}} />
          </View>

          {restaurant.openingHours ? (
            <>
              <SectionLabel>Schedules</SectionLabel>
              <View style={styles.hoursPill}><Text style={styles.hoursTxt}>From {restaurant.openingHours}</Text></View>
            </>
          ) : null}

          <SectionLabel>Menu</SectionLabel>
          {restaurant.menuItems.length === 0 ? (
            <Text style={styles.muted}>Menu coming soon.</Text>
          ) : (
            restaurant.menuItems.map((m) => (
              <View key={m.id} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{m.name}</Text>
                  {m.description && <Text style={styles.muted}>{m.description}</Text>}
                  {m.dietaryTags.length > 0 && (
                    <View style={styles.dietRow}>
                      {m.dietaryTags.map((t) => (
                        <Text key={t} style={styles.diet}>{t}</Text>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.price}>{poundsFromCents(m.priceCents)}</Text>
              </View>
            ))
          )}

          <Text style={styles.note}>Order ahead is coming soon — for now, pay at the outlet.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dk.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dk.bg },
  sheet: { backgroundColor: dk.sheet, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 },
  sheetOverlap: { marginTop: -22, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { flex: 1, color: dk.ink, fontSize: 24, fontWeight: '800' },
  desc: { color: dk.sub, fontSize: 14.5, lineHeight: 21, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  hoursPill: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, marginTop: 4 },
  hoursTxt: { color: '#111', fontWeight: '700', fontSize: 13.5 },
  item: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: dk.chip, borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  itemName: { fontWeight: '700', color: dk.ink, fontSize: 15 },
  muted: { color: dk.sub, fontSize: 13, marginTop: 2 },
  dietRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  diet: { fontSize: 11, color: '#7fd6ad', backgroundColor: 'rgba(127,214,173,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, textTransform: 'uppercase' },
  price: { color: dk.ink, fontWeight: '800', fontSize: 15 },
  note: { color: dk.sub, fontSize: 12, textAlign: 'center', marginTop: 20 },
});
