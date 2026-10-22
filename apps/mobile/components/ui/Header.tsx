import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Touchable } from '../Touchable';
import { GradientFill } from './Gradient';
import { ManagedImage, useHasSlotImage } from '../ManagedImage';
import { HeaderArt } from './HeaderArt';
import { Icon } from './Icon';
import { band, serif } from '../../lib/theme';

/**
 * The top of every screen: a tall band in the feature's colour with the storybook landscape along its foot, a menu (or
 * back) button and an optional slot on the right, and the screen's name large in serif beneath them.
 * Anything passed as children (a search pill, usually) sits on the page just under the band.
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  onMenu,
  menuIcon = 'menu',
  children,
  colors = band,
  page,
}: {
  title: string;
  /** A short line under the title. */
  subtitle?: string;
  right?: ReactNode;
  /** What the button on the left does; the menu drawer unless a screen says otherwise. */
  onMenu?: () => void;
  /** 'back' turns the left button into a back arrow for screens reached from elsewhere. */
  menuIcon?: 'menu' | 'back';
  children?: ReactNode;
  /** A feature's own gradient for the band (Restaurants is burgundy, Tickets leather, Programme gold). */
  colors?: { from: string; to: string };
  /** The page's name in App Images: the admin's `header.<page>` picture, if set, replaces the plain colour band. */
  page?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slot = page ? `header.${page}` : '';
  const hasPicture = useHasSlotImage(slot);

  return (
    <View style={styles.wrap}>
      <View style={styles.band}>
        <View style={StyleSheet.absoluteFill}>
          <GradientFill from={colors.from} to={colors.to} vertical />
        </View>
        {hasPicture ? (
          <>
            <ManagedImage slot={slot} style={StyleSheet.absoluteFill} fadeColor={colors.to} />
            {/* a light veil keeps the title readable whatever the picture is */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.32)' }]} pointerEvents="none" />
          </>
        ) : (
          <HeaderArt />
        )}
        <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
          <Touchable style={styles.side} onPress={onMenu ?? (() => router.push('/menu'))} accessibilityRole="button" accessibilityLabel={menuIcon === 'back' ? 'Go back' : 'Open menu'} hitSlop={10}>
            <Icon name={menuIcon === 'back' ? 'back' : 'menu'} color="#ffffff" size={26} />
          </Touchable>
          <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
        </View>
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>{title}</Text>
          {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 2 },
  band: { overflow: 'hidden', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  side: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  titleBlock: { paddingHorizontal: 22, paddingTop: 4, paddingBottom: 50 },
  title: { fontFamily: serif, color: '#ffffff', fontSize: 28, fontWeight: '700', lineHeight: 33, textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  subtitle: { color: 'rgba(255,255,255,0.86)', fontSize: 14.5, lineHeight: 20, marginTop: 4 },
  children: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },
});
