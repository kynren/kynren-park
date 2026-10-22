import type { ReactNode } from 'react';
import { Image, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GradientFill } from './Gradient';
import { HeaderArt } from './HeaderArt';
import { Icon, type IconName } from './Icon';

/** Mix a #rrggbb colour with black (amount < 0) or white (amount > 0). */
function shade(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const mix = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  const out = (mix((n >> 16) & 255) << 16) | (mix((n >> 8) & 255) << 8) | mix(n & 255);
  return `#${out.toString(16).padStart(6, '0')}`;
}

/**
 * The picture at the top of a card or the left of a row: the photo when there is one, otherwise an illustrated panel in
 * the thing's own colour with the park's hills along the bottom. `scrim` darkens the foot so white text over it stays readable.
 */
export function Cover({
  image,
  color = '#2f5b43',
  icon = 'star',
  height = 150,
  width,
  radius = 0,
  scrim = false,
  art = true,
  children,
  style,
}: {
  image?: string | null;
  color?: string;
  icon?: IconName;
  height?: number;
  width?: number;
  radius?: number;
  scrim?: boolean;
  art?: boolean;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ height, width, borderRadius: radius, overflow: 'hidden' }, style]}>
      {image ? (
        <>
          {/* The whole picture is shown, nothing cropped off: it is fitted inside the box, and the space left over is filled
              with a soft, dimmed copy of the same picture so there are no bare bars. */}
          {Platform.OS === 'web' ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1612' }]} />
          ) : (
            <>
              <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={22} accessibilityIgnoresInvertColors />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
            </>
          )}
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="contain" accessibilityIgnoresInvertColors />
        </>
      ) : (
        <>
          <GradientFill from={shade(color, -0.35)} to={shade(color, 0.12)} vertical />
          {art && height >= 90 ? <HeaderArt /> : null}
          <View style={[styles.glyph, height >= 160 && { paddingBottom: Math.round(height * 0.34) }]} pointerEvents="none">
            <Icon name={icon} color="rgba(255,255,255,0.55)" size={Math.min(54, Math.round(height * 0.38))} strokeWidth={1.4} />
          </View>
        </>
      )}
      {scrim && (
        <View style={[StyleSheet.absoluteFill, { top: '35%' }]} pointerEvents="none">
          <GradientFill from="#000000" to="#000000" vertical fromOpacity={0} toOpacity={0.72} />
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingBottom: 14 },
});
