import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../components/Touchable';
import { Button } from '../components/ui/Button';
import { GradientSurface } from '../components/ui/Gradient';
import { ManagedImage, useHasSlotImage } from '../components/ManagedImage';
import { HeaderArt } from '../components/ui/HeaderArt';
import { Icon, type IconName } from '../components/ui/Icon';
import { useAuth } from '../lib/auth';
import { useSync } from '../lib/sync';
import { serif, band } from '../lib/theme';
import { shadow, useUI } from '../lib/ui';

type Entry = { label: string; icon: IconName; to: Href; tab?: boolean };

const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Your visit',
    entries: [
      { label: 'My tickets', icon: 'ticket', to: '/(tabs)/tickets', tab: true },
      { label: 'Programme', icon: 'calendar', to: '/(tabs)/shows', tab: true },
      { label: 'My day', icon: 'star', to: '/(tabs)/plan', tab: true },
      { label: 'My orders', icon: 'fork', to: '/orders' },
    ],
  },
  {
    title: 'Around the park',
    entries: [
      { label: 'Scan a code', icon: 'scan', to: '/scan' },
      { label: 'Shuttle', icon: 'bus', to: '/shuttle' },
      { label: 'Accessibility', icon: 'access', to: '/accessibility' },
      { label: 'Favourites', icon: 'heart', to: '/favorites' },
      { label: 'Notifications', icon: 'bell', to: '/notifications' },
    ],
  },
  {
    title: 'You',
    entries: [
      { label: 'Find my bookings', icon: 'search', to: '/find-bookings' },
      { label: 'Profile', icon: 'user', to: '/profile' },
      { label: 'Language', icon: 'globe', to: '/language' },
      { label: 'Settings', icon: 'sliders', to: '/settings' },
    ],
  },
];

export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c, dark } = useUI();
  const { user } = useAuth();
  const { bundle } = useSync();
  const panelWidth = Math.min(340, Math.round(width * 0.86));
  const x = useSharedValue(-panelWidth);
  const hasPicture = useHasSlotImage('header.menu');

  useEffect(() => {
    x.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) });
  }, [x]);

  const panel = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: 1 + x.value / panelWidth }));

  // Where to go once the drawer has slid shut. Kept in a ref, not passed through the animation callback: that callback
  // runs on the UI thread, and a function cannot cross to the JS thread, so on a phone the destination was lost.
  const after = useRef<(() => void) | null>(null);
  const close = (then?: () => void) => {
    after.current = then ?? null;
    x.value = withTiming(-panelWidth, { duration: 200, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(finish)();
    });
  };
  const finish = () => {
    router.back();
    const go = after.current;
    after.current = null;
    if (go) setTimeout(go, 0);
  };

  const open = (entry: Entry) => close(() => (entry.tab ? router.navigate(entry.to) : router.push(entry.to)));
  const name = user?.name?.trim() || (user?.email ? user.email.split('@')[0] : '');

  return (
    <View style={StyleSheet.absoluteFill}>
      <Stack.Screen options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,15,30,0.5)' }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View style={[styles.panel, shadow(2, dark), { width: panelWidth, backgroundColor: c.card }, panel]}>
        <GradientSurface vertical from={band.from} to={band.to} style={[styles.top, { paddingTop: insets.top + 14 }]}>
          {hasPicture ? (
            <>
              <ManagedImage slot="header.menu" style={StyleSheet.absoluteFill} fadeColor={band.to} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.32)' }]} pointerEvents="none" />
            </>
          ) : (
            <HeaderArt />
          )}
          <View style={styles.topRow}>
            <Text style={styles.brand}>{(bundle?.branding?.appName ?? 'Kynren').toUpperCase()}</Text>
            <Touchable onPress={() => close()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close menu">
              <Icon name="close" color="#ffffff" size={24} />
            </Touchable>
          </View>
          {user ? (
            <Text style={styles.hello}>Hello{name ? `, ${name}` : ''}</Text>
          ) : (
            <>
              <Text style={styles.hello}>Welcome</Text>
              <Button size="sm" label="Sign in or create account" onPress={() => close(() => router.push('/auth'))} style={{ marginTop: 12 }} />
            </>
          )}
        </GradientSurface>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
          {GROUPS.map((group) => (
            <View key={group.title} style={{ marginTop: 14 }}>
              <Text style={[styles.groupTitle, { color: c.sub }]}>{group.title.toUpperCase()}</Text>
              {group.entries.map((entry) => (
                <Touchable key={entry.label} onPress={() => open(entry)} style={styles.row} accessibilityRole="button" accessibilityLabel={entry.label}>
                  <View style={[styles.iconWrap, { backgroundColor: c.tint }]}>
                    <Icon name={entry.icon} color={c.link} size={20} />
                  </View>
                  <Text style={[styles.label, { color: c.text }]}>{entry.label}</Text>
                  <Icon name="chevron" color={c.placeholder} size={18} />
                </Touchable>
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, borderTopRightRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  top: { paddingHorizontal: 22, paddingBottom: 58 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 3 },
  hello: { fontFamily: serif, color: '#ffffff', fontSize: 21, fontWeight: '800', marginTop: 18 },
  groupTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 22, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 10 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
});
