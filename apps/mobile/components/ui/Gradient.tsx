import { useId, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * A gradient that fills its parent, drawn with SVG: expo-linear-gradient is not in the installed app, and adding a native
 * module would mean a store build instead of an over-the-air update.
 *
 * It measures its parent and draws at that exact size. A percentage-sized SVG is only measured once on a phone, so inside a
 * box that grows afterwards (a menu header that fills with the guest's name, say) the gradient stayed at its first, smaller size.
 */
export function GradientFill({ from, to, vertical = false, fromOpacity = 1, toOpacity = 1 }: { from: string; to: string; vertical?: boolean; fromOpacity?: number; toOpacity?: number }) {
  const id = useId().replace(/:/g, '');
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((cur) => (cur && cur.w === width && cur.h === height ? cur : { w: width, h: height }));
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size && size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
              <Stop offset="0" stopColor={from} stopOpacity={fromOpacity} />
              <Stop offset="1" stopColor={to} stopOpacity={toOpacity} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
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
