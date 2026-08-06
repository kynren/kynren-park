import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Rect, Circle, Polyline } from 'react-native-svg';
import { theme } from '../../lib/theme';
import { useThemePref } from '../../lib/theme-context';
import { Touchable } from '../../components/Touchable';
import { selection } from '../../lib/haptics';

// The bottom bar adapts to the app theme: the dark bar is dark mode,
// a light bar in light mode.
function usePalette() {
  const dark = useThemePref().scheme === 'dark';
  return dark
    ? {
        bar: '#171717',
        inactive: '#b9b9b9',
        activeIcon: '#ffffff',
        activeLabel: '#ffffff',
        pill: '#000000',
        fabBg: '#171717',
        fabBorder: '#4d4d4d',
        fabInactive: '#d4d4d4',
      }
    : {
        bar: '#ffffff',
        inactive: '#8a827b',
        activeIcon: theme.brand,
        activeLabel: theme.brand,
        pill: '#f3ede6',
        fabBg: '#ffffff',
        fabBorder: theme.brand,
        fabInactive: '#8a827b',
      };
}

// --- Line icons (match the dark bottom-bar reference) ----------------------
type IconProps = { color: string; size?: number };

function HomeIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="2 9 12 4 22 9" />
      <Line x1="4" y1="10" x2="4" y2="18" />
      <Line x1="9" y1="10" x2="9" y2="18" />
      <Line x1="15" y1="10" x2="15" y2="18" />
      <Line x1="20" y1="10" x2="20" y2="18" />
      <Line x1="3" y1="18" x2="21" y2="18" />
      <Line x1="2.5" y1="21" x2="21.5" y2="21" />
    </Svg>
  );
}

function PinIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22C12 22 5 15 5 9.5A7 7 0 0 1 19 9.5C19 15 12 22 12 22Z" />
      <Circle cx="12" cy="9.5" r="2.4" fill={color} stroke="none" />
    </Svg>
  );
}

function TicketIcon({ color, size = 28, bg = '#171717' }: IconProps & { bg?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="7" width="18" height="10" rx="2.5" />
      <Circle cx="12" cy="7" r="1.6" fill={bg} stroke={color} strokeWidth={1.2} />
      <Circle cx="12" cy="17" r="1.6" fill={bg} stroke={color} strokeWidth={1.2} />
      <Line x1="12" y1="10" x2="12" y2="10.5" />
      <Line x1="12" y1="12" x2="12" y2="12.5" />
      <Line x1="12" y1="14" x2="12" y2="14.5" />
    </Svg>
  );
}

function CalendarIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="4" y="5" width="16" height="16" rx="2.4" />
      <Line x1="4" y1="9.5" x2="20" y2="9.5" />
      <Line x1="8" y1="3" x2="8" y2="6" />
      <Line x1="16" y1="3" x2="16" y2="6" />
      <Line x1="8" y1="13.5" x2="9" y2="13.5" />
      <Line x1="11.5" y1="13.5" x2="12.5" y2="13.5" />
      <Line x1="15" y1="13.5" x2="16" y2="13.5" />
      <Line x1="8" y1="17" x2="9" y2="17" />
      <Line x1="11.5" y1="17" x2="12.5" y2="17" />
    </Svg>
  );
}

function MealIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6.5 3V8M9.5 3V8M8 3V21M6.5 8H9.5" />
      <Path d="M16 3C14.5 5 14.5 9 16 11.5V21M16 11.5C17.5 9 17.5 5 16 3" />
    </Svg>
  );
}

const ITEMS: { name: string; label: string; Icon: (p: IconProps) => JSX.Element; center?: boolean }[] = [
  { name: 'index', label: 'Home', Icon: HomeIcon },
  { name: 'map', label: 'Plan', Icon: PinIcon },
  { name: 'tickets', label: 'Book', Icon: (p) => <TicketIcon {...p} />, center: true },
  { name: 'shows', label: 'Program', Icon: CalendarIcon },
  { name: 'food', label: 'Meal', Icon: MealIcon },
];

function KynrenTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  const current = state.routes[state.index].name;

  const go = (name: string) => {
    const route = state.routes.find((r: any) => r.name === name);
    if (!route) return;
    const focused = current === name;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) { selection(); navigation.navigate(name); }
  };

  return (
    <View style={[styles.bar, { backgroundColor: pal.bar, paddingBottom: insets.bottom, height: 60 + insets.bottom }]}>
      {ITEMS.map((item) => {
        const active = current === item.name;
        if (item.center) {
          return (
            <Touchable key={item.name} style={styles.item} haptic="none" noRipple onPress={() => go(item.name)}>
              <View style={[styles.fab, { backgroundColor: pal.fabBg, borderColor: pal.fabBorder }]}>
                <TicketIcon color={active ? pal.activeIcon : pal.fabInactive} size={30} bg={pal.fabBg} />
              </View>
              <Text style={[styles.label, { color: active ? pal.activeLabel : pal.inactive }, active && styles.labelActive]}>{item.label}</Text>
            </Touchable>
          );
        }
        return (
          <Touchable key={item.name} style={styles.item} haptic="none" noRipple scaleTo={0.9} onPress={() => go(item.name)}>
            <View style={[styles.iconWrap, active && { backgroundColor: pal.pill }]}>
              <item.Icon color={active ? pal.activeIcon : pal.inactive} size={23} />
            </View>
            <Text style={[styles.label, { color: active ? pal.activeLabel : pal.inactive }, active && styles.labelActive]}>{item.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <KynrenTabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.brand },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false }} />
      <Tabs.Screen name="shows" options={{ title: 'Programme', headerShown: false }} />
      <Tabs.Screen name="map" options={{ title: 'Plan Your Visit', headerShown: false }} />
      <Tabs.Screen name="food" options={{ title: 'Meal', headerShown: false }} />
      <Tabs.Screen name="plan" options={{ title: 'My Day' }} />
      <Tabs.Screen name="tickets" options={{ title: 'Book' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 0,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8, gap: 3 },
  iconWrap: { paddingHorizontal: 18, paddingVertical: 6, borderRadius: 18 },
  label: { fontSize: 11.5, fontWeight: '600' },
  labelActive: { fontWeight: '800' },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    marginBottom: 2,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 10,
  },
});
