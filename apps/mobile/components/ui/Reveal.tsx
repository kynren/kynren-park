import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

/** Fades and lifts a card in as its screen opens, each a beat after the one before. Skipped when the system asks for less motion. */
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 70).duration(420).reduceMotion(ReduceMotion.System)} style={style}>
      {children}
    </Animated.View>
  );
}
