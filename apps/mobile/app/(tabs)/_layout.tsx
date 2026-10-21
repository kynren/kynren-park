import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../../components/Touchable';
import { Icon, type IconName } from '../../components/ui/Icon';
import { selection } from '../../lib/haptics';
import { shadow, useUI } from '../../lib/ui';

// The four places guests start from. Tickets, Programme and My Day are still real routes in this group - the menu and the
// Home cards open them - they just no longer take a tab.
const ITEMS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'search', label: 'Search', icon: 'search' },
  { name: 'map', label: 'Map', icon: 'pin' },
  { name: 'food', label: 'Restaurants', icon: 'fork' },
];

function TabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const { c, dark } = useUI();
  const current = state.routes[state.index].name;

  const go = (name: string) => {
    const route = state.routes.find((r: any) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) {
      selection();
      navigation.navigate(name);
    }
  };

  return (
    <View style={[styles.bar, shadow(2, dark, 'up'), { backgroundColor: c.tabBar, paddingBottom: Math.max(insets.bottom, 10) }]}>
      {ITEMS.map((item) => {
        const active = current === item.name;
        return (
          <Touchable
            key={item.name}
            style={styles.item}
            haptic="none"
            noRipple
            scaleTo={0.88}
            onPress={() => go(item.name)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
          >
            <Icon name={item.icon} color={active ? c.link : c.placeholder} size={25} strokeWidth={active ? 2.1 : 1.7} />
            <Text numberOfLines={1} style={[styles.label, { color: active ? c.link : c.sub, fontWeight: active ? '800' : '600' }]}>{item.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="food" options={{ title: 'Restaurants' }} />
      <Tabs.Screen name="shows" options={{ title: 'Programme', href: null }} />
      <Tabs.Screen name="tickets" options={{ title: 'Tickets', href: null }} />
      <Tabs.Screen name="plan" options={{ title: 'My Day', href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingTop: 12 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2, minHeight: 50 },
  label: { fontSize: 11 },
});
