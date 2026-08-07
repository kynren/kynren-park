import { useEffect } from 'react';
import { View, StyleSheet, Dimensions, type ImageSourcePropType } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Circle, G } from 'react-native-svg';

// The five story crests (white artwork, shown over the night sky), in show order.
const LOGOS: ImageSourcePropType[] = [
  require('../assets/Lost Feather - float white-01.png'),
  require('../assets/Legend of the Wear WHITE v_2.png'),
  require('../assets/The Trusty Steed WHITE.png'),
  require('../assets/Land of the Vikings WHITE v_2.png'),
  require('../assets/Victorian Imaginariums WHITE.png'),
];
// The Kynren wordmark (metallic, with the built-in red cross).
const WORDMARK: ImageSourcePropType = require('../assets/kynren-wordmark.webp');

const GOLD = '#f0d79a';
const GOLD_DIM = '#d9a441';

const STARS: [number, number, number][] = [
  [0.12, 0.09, 1.4], [0.22, 0.15, 1], [0.34, 0.07, 1.6], [0.5, 0.12, 1], [0.63, 0.06, 1.4],
  [0.74, 0.14, 1], [0.9, 0.1, 1.4], [0.08, 0.22, 1], [0.42, 0.2, 1.1], [0.83, 0.2, 1.1],
];

// One crest logo in the montage — fades up, holds, fades out on its cue.
function LogoFrame({ src, delay, w, h }: { src: ImageSourcePropType; delay: number; w: number; h: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withDelay(160, withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) })),
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.92 + o.value * 0.08 }] }));
  return <Animated.Image source={src} resizeMode="contain" style={[{ position: 'absolute', width: w, height: h }, st]} />;
}

function Ember({ W, H, seed }: { W: number; H: number; seed: number }) {
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  const x = (seed * 97) % W;
  const dur = 4200 + (seed * 613) % 3000;
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false);
    o.value = withDelay((seed * 271) % 2500, withRepeat(withSequence(withTiming(0.7, { duration: dur * 0.3 }), withTiming(0, { duration: dur * 0.7 })), -1, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - y.value) * (H * 0.7) + H * 0.15 }], opacity: o.value }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: 0, width: 3, height: 3, borderRadius: 2, backgroundColor: GOLD }, st]} />;
}

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0.3);
  useEffect(() => { v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.3, { duration: 600 })), -1, true)); }, [delay, v]);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.8 + v.value * 0.35 }] }));
  return <Animated.View style={[styles.dot, st]} />;
}

/** Cinematic Kynren splash: night sky + keep, five crests draw in, then the mark. */
export function SplashSequence() {
  const { width: W, height: H } = Dimensions.get('window');
  const cross = useSharedValue(0);
  const word = useSharedValue(0);
  const rule = useSharedValue(0);
  const tag = useSharedValue(0);

  useEffect(() => {
    // The crest montage plays first (LogoFrame delays 500…1700ms), then the mark.
    cross.value = withDelay(2250, withSpring(1, { damping: 9, stiffness: 140 }));
    word.value = withDelay(2400, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    rule.value = withDelay(2750, withTiming(1, { duration: 800 }));
    tag.value = withDelay(3000, withTiming(1, { duration: 700 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The wordmark reveals with a fade + rise (word) and a gentle spring pop (cross).
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 24 }, { scale: 0.9 + cross.value * 0.1 }],
  }));
  const ruleStyle = useAnimatedStyle(() => ({ width: rule.value * Math.min(W * 0.62, 360) }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value }));
  const logoW = Math.min(W * 0.74, 380);
  const logoH = Math.min(H * 0.24, 220);
  const wmW = Math.min(W * 0.82, 440);
  const wmH = wmW * 0.46; // wordmark aspect ≈ 2.16:1

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#2a1846" /><Stop offset="0.5" stopColor="#1a1030" /><Stop offset="1" stopColor="#0a0616" />
          </LinearGradient>
          <RadialGradient id="moon" cx="50%" cy="13%" r="36%">
            <Stop offset="0" stopColor="#fbeecb" stopOpacity="0.85" /><Stop offset="0.5" stopColor="#efd79a" stopOpacity="0.28" /><Stop offset="1" stopColor="#efd79a" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="glow" cx="50%" cy="118%" r="70%">
            <Stop offset="0" stopColor="#8f1d21" stopOpacity="0.55" /><Stop offset="1" stopColor="#8f1d21" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={W} height={H} fill="url(#sky)" />
        <Rect width={W} height={H} fill="url(#moon)" />
        <Rect width={W} height={H} fill="url(#glow)" />
        {STARS.map((s, i) => <Circle key={i} cx={s[0] * W} cy={s[1] * H} r={s[2]} fill="#ffffff" opacity={0.7} />)}
        {/* hills + keep */}
        <Path d={`M0 ${H} L0 ${H - 96} Q${W * 0.22} ${H - 140} ${W * 0.5} ${H - 116} T${W} ${H - 124} L${W} ${H} Z`} fill="#0a0616" opacity={0.92} />
        <G transform={`translate(${W / 2 - 80} ${H - 176})`} fill="#0a0616">
          <Rect x={20} y={40} width={120} height={110} />
          <Rect x={0} y={58} width={26} height={92} /><Rect x={134} y={58} width={26} height={92} />
          <Path d="M20 40 l16 -22 l16 22 z" /><Path d="M108 40 l16 -22 l16 22 z" />
          <Path d="M0 58 l13 -18 l13 18 z" /><Path d="M134 58 l13 -18 l13 18 z" />
          <Rect x={72} y={96} width={16} height={54} />
        </G>
        <G transform={`translate(${W / 2 - 80} ${H - 176})`} fill={GOLD_DIM} opacity={0.85}>
          <Path d="M11 20 l5 -12 l5 12 z" /><Path d="M119 20 l5 -12 l5 12 z" />
        </G>
      </Svg>

      {[0, 1, 2, 3, 4, 5, 6, 7].map((s) => <Ember key={s} W={W} H={H} seed={s + 3} />)}

      <View style={styles.montage} pointerEvents="none">
        {LOGOS.map((src, i) => (
          <LogoFrame key={i} src={src} delay={500 + i * 300} w={logoW} h={logoH} />
        ))}
      </View>

      <View style={styles.center} pointerEvents="none">
        <Animated.Image source={WORDMARK} resizeMode="contain" style={[{ width: wmW, height: wmH }, wordStyle]} />
        <Animated.View style={[styles.rule, ruleStyle]} />
        <Animated.Text style={[styles.tag, tagStyle]}>THE STORIED LANDS</Animated.Text>
        <View style={styles.dots}><Dot delay={0} /><Dot delay={180} /><Dot delay={360} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  montage: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingTop: '6%' },
  rule: { height: 2, marginTop: 18, marginBottom: 14, backgroundColor: GOLD },
  tag: { fontSize: 13, letterSpacing: 6, color: GOLD, fontWeight: '600', paddingLeft: 6 },
  dots: { flexDirection: 'row', gap: 9, marginTop: 30 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD_DIM },
});
