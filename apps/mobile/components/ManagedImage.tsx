import { useEffect } from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSync } from '../lib/sync';
import { useThemePref } from '../lib/theme-context';

type Props = {
  slot: string;
  style?: StyleProp<ViewStyle>; // sizing for the frame (width/height/borderRadius)
  fallback?: ImageSourcePropType; // bundled default when the admin hasn't set one
  fadeColor?: string; // colour the edge fade blends into (screen background)
};

/**
 * A decorative image the super-admin controls per "slot": swap the picture
 * (light/dark), how it's fitted/positioned, an optional edge fade, and how it
 * enters on mount. Falls back to a bundled asset when nothing is configured.
 */
export function ManagedImage({ slot, style, fallback, fadeColor = '#ffffff' }: Props) {
  const { bundle } = useSync();
  const dark = useThemePref().scheme === 'dark';
  const cfg = bundle?.images?.[slot];

  const uri = (dark ? cfg?.imageUrlDark || cfg?.imageUrl : cfg?.imageUrl) || null;
  const source: ImageSourcePropType | null = uri ? { uri } : fallback ?? null;

  const anim = cfg?.animation ?? 'fade';
  const p = useSharedValue(anim === 'none' ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [p, uri]);

  const aStyle = useAnimatedStyle(() => {
    const v = p.value;
    switch (anim) {
      case 'none': return { opacity: 1 };
      case 'slide-up': return { opacity: v, transform: [{ translateY: (1 - v) * 28 }] };
      case 'slide-down': return { opacity: v, transform: [{ translateY: (1 - v) * -28 }] };
      case 'zoom': return { opacity: v, transform: [{ scale: 0.9 + v * 0.1 }] };
      default: return { opacity: v }; // fade
    }
  });

  if (!source) return <View style={style} />;

  const resizeMode = cfg?.fit === 'contain' ? 'contain' : 'cover';
  // Vertical alignment inside the frame (only meaningful for cover).
  const align: ViewStyle['justifyContent'] =
    cfg?.position === 'top' ? 'flex-start' : cfg?.position === 'bottom' ? 'flex-end' : 'center';

  return (
    <Animated.View style={[styles.frame, style, aStyle]}>
      <View style={[StyleSheet.absoluteFill, { justifyContent: align }]}>
        <Image source={source} resizeMode={resizeMode} style={resizeMode === 'cover' ? StyleSheet.absoluteFill : styles.contain} />
      </View>
      {cfg?.fade && cfg.fade !== 'none' && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id={`mi-${slot}`} x1="0" y1={cfg.fade === 'down' ? '0' : '1'} x2="0" y2={cfg.fade === 'down' ? '1' : '0'}>
              <Stop offset="0" stopColor={fadeColor} stopOpacity="0" />
              <Stop offset="0.72" stopColor={fadeColor} stopOpacity="0.55" />
              <Stop offset="1" stopColor={fadeColor} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#mi-${slot})`} />
        </Svg>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  contain: { width: '100%', height: '100%' },
});
