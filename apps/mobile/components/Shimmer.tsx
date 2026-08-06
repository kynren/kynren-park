import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle, type StyleProp } from 'react-native';
import { useThemePref } from '../lib/theme-context';

/** A single pulsing skeleton block. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const dark = useThemePref().scheme === 'dark';
  const a = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ backgroundColor: dark ? '#26262b' : '#e7e1d9', borderRadius: 8, opacity: a }, style]} />;
}

/** A vertical stack of card-shaped skeletons — the single loading treatment per screen. */
export function SkeletonRows({ count = 5, height = 62 }: { count?: number; height?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} style={{ height, borderRadius: 12 }} />
      ))}
    </View>
  );
}
