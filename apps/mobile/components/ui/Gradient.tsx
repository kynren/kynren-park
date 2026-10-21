import { useId, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A gradient that fills its parent, drawn with SVG: expo-linear-gradient is not in the installed app, and adding a native
 * module would mean a store build instead of an over-the-air update.
 */
export function GradientFill({ from, to, vertical = false }: { from: string; to: string; vertical?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Wraps children on a gradient surface (a header, a promo card). */
export function GradientSurface({ children, style, from, to, vertical }: { children?: ReactNode; style?: StyleProp<ViewStyle>; from: string; to: string; vertical?: boolean }) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <GradientFill from={from} to={to} vertical={vertical} />
      {children}
    </View>
  );
}
