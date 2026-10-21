import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Touchable } from '../Touchable';
import { Button } from './Button';
import { GradientFill } from './Gradient';
import { Icon } from './Icon';
import { shadow, useUI } from '../../lib/ui';
import { featureGradient } from '../../lib/theme';
import type { Restaurant } from '../../lib/sync';

const FAVS_KEY = 'kynren_fav_restaurants';

/** The restaurants a guest has hearted, kept on the device. */
export function useRestaurantFavs() {
  const [favs, setFavs] = useState<Set<string>>(new Set());
  useEffect(() => {
    AsyncStorage.getItem(FAVS_KEY).then((raw) => raw && setFavs(new Set(JSON.parse(raw)))).catch(() => undefined);
  }, []);
  const toggle = (id: string) =>
    setFavs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      AsyncStorage.setItem(FAVS_KEY, JSON.stringify([...next])).catch(() => undefined);
      return next;
    });
  return { favs, toggle };
}

/**
 * One restaurant: its photo (or the coral fork-and-knife panel), name and cuisine, then "See menu" beside the one action we
 * can really offer - ordering ahead, only when the place takes Click & Collect and has a menu.
 */
export function RestaurantCard({ r, faved, onFav }: { r: Restaurant; faved: boolean; onFav: () => void }) {
  const router = useRouter();
  const { c, dark } = useUI();
  const canOrder = r.clickCollect !== false && r.menuItems.length > 0;
  const open = () => router.push(`/restaurant/${r.slug}`);

  return (
    <View style={[styles.card, shadow(1, dark), { backgroundColor: c.card }]}>
      <Touchable onPress={open} accessibilityRole="button" accessibilityLabel={r.name}>
        <View style={styles.photo}>
          {r.heroImage ? (
            <Image source={{ uri: r.heroImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <>
              <GradientFill from={featureGradient.restaurants.from} to={featureGradient.restaurants.to} />
              <View style={styles.photoIcon}>
                <Icon name="fork" color="#ffffff" size={40} strokeWidth={1.6} />
              </View>
            </>
          )}
        </View>
      </Touchable>
      <Touchable onPress={onFav} hitSlop={10} accessibilityRole="button" accessibilityLabel={faved ? 'Remove from favourites' : 'Add to favourites'} style={[styles.heart, { backgroundColor: c.card }]}>
        <Icon name="heart" color={faved ? c.accent : c.sub} filled={faved} size={20} />
      </Touchable>
      <View style={styles.body}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>{r.name}</Text>
        {(r.cuisine || r.openingHours) && (
          <Text style={[styles.sub, { color: c.sub }]} numberOfLines={2}>{[r.cuisine, r.openingHours].filter(Boolean).join(' · ')}</Text>
        )}
        <View style={styles.actions}>
          <Button size="sm" variant="soft" label="See menu" onPress={open} />
          {canOrder && <Button size="sm" label="Order now" onPress={open} />}
          <Touchable onPress={() => router.push(`/map?focus=${r.id}`)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Show ${r.name} on the map`} style={[styles.go, { backgroundColor: c.tint }]}>
            <Icon name="pin" color={c.link} size={19} />
          </Touchable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden' },
  photo: { height: 132, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoIcon: { opacity: 0.9 },
  heart: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 4 },
  name: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 13.5, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  go: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
});
