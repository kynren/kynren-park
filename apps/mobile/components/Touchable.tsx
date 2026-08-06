import { forwardRef } from 'react';
import { Pressable, Platform, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { tapLight, tapMedium, selection } from '../lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type HapticKind = 'light' | 'medium' | 'selection' | 'none';
const fire = (k: HapticKind) => {
  if (k === 'light') tapLight();
  else if (k === 'medium') tapMedium();
  else if (k === 'selection') selection();
};

export interface TouchableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Native press feedback: how far it scales down (default 0.96). */
  scaleTo?: number;
  /** Haptic on press-in (default 'light'). Use 'none' to disable. */
  haptic?: HapticKind;
  /** Android ripple colour. Defaults to a subtle translucent black/white. */
  rippleColor?: string;
  /** Turn off the ripple (e.g. for pill buttons where scale is enough). */
  noRipple?: boolean;
}

/**
 * Drop-in replacement for Pressable that actually feels native:
 * a spring scale-down on the UI thread, an Android ripple, and a haptic tap.
 */
export const Touchable = forwardRef<any, TouchableProps>(function Touchable(
  { style, scaleTo = 0.96, haptic = 'light', rippleColor, noRipple, onPressIn, onPressOut, disabled, children, ...rest },
  ref,
) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const ripple =
    Platform.OS === 'android' && !noRipple
      ? { color: rippleColor ?? 'rgba(0,0,0,0.12)', borderless: false, foreground: true }
      : undefined;

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      android_ripple={ripple}
      onPressIn={(e) => {
        if (!disabled) { scale.value = withTiming(scaleTo, { duration: 90 }); if (haptic !== 'none') fire(haptic); }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        onPressOut?.(e);
      }}
      style={[
        animStyle,
        // On iOS there's no ripple, so a slight opacity drop reinforces the press.
        ({ pressed }) => (Platform.OS === 'ios' && pressed ? { opacity: 0.85 } : null),
        style as any,
      ]}
      {...rest}
    >
      {children as any}
    </AnimatedPressable>
  );
});
