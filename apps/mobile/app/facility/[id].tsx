import { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseButton, IconBadge, TagChip, ActionPill, SectionLabel, DetailHero, ICONS, useDK, type DK } from '../../components/DetailKit';
import { useSync } from '../../lib/sync';
import { serif } from '../../lib/theme';

const HERO_HEIGHT = 300;
const TYPE_LABEL: Record<string, string> = {
  RESTROOM: 'Restrooms', FIRST_AID: 'First aid', SHOP: 'Shop', PARKING: 'Parking',
  ACCESSIBILITY: 'Accessibility', BABY_CHANGING: 'Baby changing', PICNIC: 'Picnic area',
  ENTRANCE: 'Entrance', INFO: 'Information', HELP: 'Help point',
};
const TYPE_EMOJI: Record<string, string> = {
  RESTROOM: '🚻', FIRST_AID: '➕', SHOP: '🛍️', PARKING: '🅿️', ACCESSIBILITY: '♿',
  BABY_CHANGING: '🍼', PICNIC: '🧺', ENTRANCE: '🚪', INFO: 'ℹ️', HELP: '❓',
};

export default function FacilityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bundle } = useSync();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dk = useDK();
  const styles = useMemo(() => makeStyles(dk), [dk]);
  const poi = bundle?.pois.find((p) => p.id === id);

  if (!poi) {
    return <View style={styles.center}><Stack.Screen options={{ headerShown: false }} /><Text style={{ color: dk.sub }}>Place not found.</Text></View>;
  }

  const images = poi.images?.length ? poi.images : poi.heroImage ? [poi.heroImage] : [];
  const label = TYPE_LABEL[poi.type] ?? poi.type.replace('_', ' ');
  const emoji = poi.icon || TYPE_EMOJI[poi.type] || '📍';

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />
      <View style={{ position: 'absolute', top: insets.top + 8, right: 14, zIndex: 10 }}><CloseButton onPress={() => router.back()} /></View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <DetailHero images={images} height={HERO_HEIGHT} />

        <View style={[styles.sheet, styles.sheetOverlap]}>
          <View style={styles.titleRow}>
            <IconBadge letter={emoji} tint={poi.color ?? undefined} />
            <Text style={styles.title}>{poi.name}</Text>
          </View>

          {poi.description ? <Text style={styles.desc}>{poi.description}</Text> : null}

          <View style={styles.tagRow}>
            <TagChip icon={emoji} label={label} />
          </View>

          <View style={styles.actionRow}>
            <ActionPill icon={ICONS.map} label="Go to" onPress={() => router.push(`/map?focus=${poi.id}`)} />
          </View>

          {poi.openingHours ? (
            <>
              <SectionLabel>Schedules</SectionLabel>
              <View style={styles.hoursPill}><Text style={styles.hoursTxt}>From {poi.openingHours}</Text></View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (dk: DK) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: dk.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dk.bg },
  sheet: { backgroundColor: dk.sheet, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 },
  sheetOverlap: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { fontFamily: serif, flex: 1, color: dk.ink, fontSize: 24, fontWeight: '800' },
  desc: { color: dk.sub, fontSize: 14.5, lineHeight: 21, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  hoursPill: { alignSelf: 'flex-start', backgroundColor: dk.pill, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16, marginTop: 4 },
  hoursTxt: { color: dk.link, fontWeight: '700', fontSize: 13.5 },
});
