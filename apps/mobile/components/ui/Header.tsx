import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../Touchable';
import { GradientFill } from './Gradient';
import { Icon } from './Icon';
import { band, serif } from '../../lib/theme';
import { useUI } from '../../lib/ui';

/**
 * The top of a main screen: a menu button, the screen name in spaced capitals, and an optional slot on the right.
 * `sky` is the bright blue band the Home screen opens with; `light` sits straight on the screen background.
 * Anything passed as children (a search pill, usually) is laid out underneath and may overlap the band's edge.
 */
export function ScreenHeader({
  title,
  tone = 'light',
  right,
  onMenu,
  menuIcon = 'menu',
  children,
  overlap = 0,
  colors,
}: {
  title: string;
  tone?: 'sky' | 'light';
  right?: ReactNode;
  /** What the button on the left does; the menu drawer unless a screen says otherwise. */
  onMenu?: () => void;
  /** 'back' turns the left button into a back arrow for screens reached from elsewhere. */
  menuIcon?: 'menu' | 'back';
  children?: ReactNode;
  /** How far the children hang below the band. */
  overlap?: number;
  /** A feature's own gradient for the band (Restaurants is coral, Tickets navy); a 'sky' header without one uses the default blue. */
  colors?: { from: string; to: string };
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useUI();
  const bandColors = colors ?? (tone === 'sky' ? band : null);
  const sky = bandColors !== null;
  const ink = sky ? '#ffffff' : c.text;

  return (
    <View style={{ zIndex: 2, marginBottom: overlap ? 0 : 4 }}>
      {bandColors && (
        <View style={[StyleSheet.absoluteFill, { bottom: overlap ? -overlap : 0, overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }]}>
          <GradientFill from={bandColors.from} to={bandColors.to} vertical />
        </View>
      )}
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <Touchable style={styles.side} onPress={onMenu ?? (() => router.push('/menu'))} accessibilityRole="button" accessibilityLabel={menuIcon === 'back' ? 'Go back' : 'Open menu'} hitSlop={10}>
          <Icon name={menuIcon === 'back' ? 'back' : 'menu'} color={ink} size={26} />
        </Touchable>
        <Text accessibilityRole="header" style={[styles.title, { color: sky ? '#ffffff' : c.link }]}>{title.toUpperCase()}</Text>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
      </View>
      {children ? <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: overlap ? 0 : 6, marginBottom: overlap ? -overlap : 0 }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 },
  side: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  title: { fontFamily: serif, fontSize: 16, fontWeight: '700', letterSpacing: 2.5 },
});
