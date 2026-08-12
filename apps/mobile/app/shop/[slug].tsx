import { View, Text, StyleSheet, Image, StatusBar, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageCarousel } from '../../components/ImageCarousel';
import { CloseButton, IconBadge, TagChip, ActionPill, SectionLabel, ICONS, dk } from '../../components/DetailKit';
import { useSync } from '../../lib/sync';
import { poundsFromCents } from '../../lib/format';

const HERO_HEIGHT = 320;

export default function ShopScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { bundle } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const shop = bundle?.shops?.find((s) => s.slug === slug);

  if (!shop) {
    return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><Text style={{ color: dk.sub }}>Shop not found.</Text></View>;
  }

  const images = shop.images?.length ? shop.images : shop.heroImage ? [shop.heroImage] : [];

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
          <IconBadge letter={shop.name[0]?.toUpperCase() ?? 'S'} />
          <Text style={styles.title}>{shop.name}</Text>
        </View>

        {shop.description ? <Text style={styles.desc}>{shop.description}</Text> : null}

        <View style={styles.tagRow}>
          {shop.category ? <TagChip icon="🛍️" label={shop.category} /> : null}
        </View>

        <View style={styles.actionRow}>
          <ActionPill icon={ICONS.map} label="Go to" onPress={() => router.push(`/map?focus=${shop.poiId ?? shop.id}`)} />
          <ActionPill icon={ICONS.menu} label="Products" onPress={() => {}} />
        </View>

        {shop.openingHours ? (
          <>
            <SectionLabel>Schedules</SectionLabel>
            <View style={styles.hoursPill}><Text style={styles.hoursTxt}>From {shop.openingHours}</Text></View>
          </>
        ) : null}

        <SectionLabel>What’s in store</SectionLabel>
        {(!shop.items || shop.items.length === 0) ? (
          <Text style={styles.muted}>Product list coming soon.</Text>
        ) : (
          shop.items.map((it) => (
            <View key={it.id} style={styles.item}>
              <View style={styles.thumbWrap}>
                {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} /> : <Text style={{ fontSize: 20 }}>🛍️</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                {it.description ? <Text style={styles.muted}>{it.description}</Text> : null}
                {it.variants && it.variants.length > 0 ? (
                  <Text style={styles.variants}>{it.variants.map((v) => v.name).join(' · ')}</Text>
                ) : null}
              </View>
              <Text style={styles.price}>{poundsFromCents(it.priceCents)}</Text>
            </View>
          ))
        )}
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
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: dk.chip, borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  thumbWrap: { width: 52, height: 52, borderRadius: 8, backgroundColor: dk.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  itemName: { fontWeight: '700', color: dk.ink, fontSize: 15 },
  muted: { color: dk.sub, fontSize: 13, marginTop: 2 },
  variants: { color: dk.sub, fontSize: 12, marginTop: 4 },
  price: { color: dk.ink, fontWeight: '800', fontSize: 15 },
});
