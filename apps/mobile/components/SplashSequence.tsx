import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Circle, G } from 'react-native-svg';

const GOLD = '#f0d79a';
const GOLD_DIM = '#d9a441';
const CROSS = '#e2202b';
const SERIF = Platform.select({ ios: 'Palatino', android: 'serif', default: 'serif' }) as string;

const STARS: [number, number, number][] = [
  [0.12, 0.09, 1.4], [0.22, 0.15, 1], [0.34, 0.07, 1.6], [0.5, 0.12, 1], [0.63, 0.06, 1.4],
  [0.74, 0.14, 1], [0.9, 0.1, 1.4], [0.08, 0.22, 1], [0.42, 0.2, 1.1], [0.83, 0.2, 1.1],
];

// Five story crests as gold line-art (faithful to the Kynren shows).
function Crest({ i, size }: { i: number; size: number }) {
  const p = { stroke: GOLD, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const inner = () => {
    switch (i) {
      case 0: return <><Path {...p} d="M45 8 C30 26 26 60 33 92 M45 8 C60 26 64 60 57 92 M45 8 C45 40 45 70 45 96 M35 34 L45 40 M55 34 L45 40 M32 52 L45 58 M58 52 L45 58 M31 72 L45 78 M59 72 L45 78 M45 96 L45 104" /></>; // feather
      case 1: return <><Path {...p} d="M14 40 C24 26 34 44 44 32 C54 20 66 34 76 26" /><Path {...p} d="M20 96 C20 74 40 74 40 58 C40 44 56 44 56 58 C56 72 44 72 44 84" /><Circle {...p} cx={30} cy={52} r={2} /><Path {...p} d="M10 92 q10 8 20 0 t20 0 t20 0 t10 0" /><Path {...p} d="M10 100 q10 8 20 0 t20 0 t20 0 t10 0" /></>; // worm on the water
      case 2: return <><Path {...p} d="M18 92 C14 62 22 34 48 24 C58 20 66 22 72 30 C66 30 60 34 60 42 C74 40 80 52 78 64 C70 60 64 62 60 70 C56 84 44 88 34 84 C40 80 40 72 34 70 C28 82 22 90 18 92 Z" /><Path {...p} d="M60 40 l8 -6" /></>; // horse
      case 3: return <><Path {...p} d="M16 78 C30 92 70 92 84 78 L88 66 L12 66 Z" /><Path {...p} d="M12 66 C12 44 88 44 88 66" /><Path {...p} d="M28 44 C28 20 72 20 72 44" /><Path {...p} d="M40 24 C40 8 60 8 60 24" /><Path {...p} d="M50 8 L50 -2 M20 60 l-8 -6 M80 60 l8 -6" /></>; // viking longship
      default: return <><Circle {...p} cx={50} cy={52} r={18} /><Path {...p} d="M50 34 L50 24 M50 80 L50 90 M32 52 L22 52 M68 52 L78 52 M37 39 L30 32 M63 39 L70 32 M37 65 L30 72 M63 65 L70 72" /><Path {...p} d="M26 96 q24 12 48 0" /></>; // imaginarium
    }
  };
  return <Svg width={size} height={size * 1.08} viewBox="0 0 100 108">{inner()}</Svg>;
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
  const crests = useSharedValue(0);
  const crestDim = useSharedValue(1);

  useEffect(() => {
    crests.value = withTiming(1, { duration: 700 });
    crestDim.value = withDelay(1450, withTiming(0.24, { duration: 900 }));
    cross.value = withDelay(1300, withSpring(1, { damping: 9, stiffness: 140 }));
    word.value = withDelay(1500, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    rule.value = withDelay(1850, withTiming(1, { duration: 800 }));
    tag.value = withDelay(2150, withTiming(1, { duration: 700 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crestsStyle = useAnimatedStyle(() => ({ opacity: crests.value * crestDim.value, transform: [{ translateY: (1 - crests.value) * 14 }] }));
  const crossStyle = useAnimatedStyle(() => ({ opacity: cross.value, transform: [{ scale: 0.4 + cross.value * 0.6 }] }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 24 }] }));
  const ruleStyle = useAnimatedStyle(() => ({ width: rule.value * Math.min(W * 0.62, 360) }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value }));
  const crestW = Math.min(W * 0.15, 78);

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

      <Animated.View style={[styles.crests, crestsStyle]} pointerEvents="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={styles.crest}><Crest i={i} size={crestW} /></View>
        ))}
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <Animated.View style={[styles.cross, crossStyle]}>
          <Svg width={92} height={92} viewBox="0 0 104 104">
            <Rect x={52 - 12} y={52 - 31} width={24} height={62} rx={6} fill={CROSS} />
            <Rect x={52 - 31} y={52 - 12} width={62} height={24} rx={6} fill={CROSS} />
          </Svg>
        </Animated.View>
        <Animated.Text style={[styles.word, wordStyle]}>KYNREN</Animated.Text>
        <Animated.View style={[styles.rule, ruleStyle]} />
        <Animated.Text style={[styles.tag, tagStyle]}>THE STORIED LANDS</Animated.Text>
        <View style={styles.dots}><Dot delay={0} /><Dot delay={180} /><Dot delay={360} /></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  crests: { position: 'absolute', top: '22%', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 12, paddingHorizontal: 12 },
  crest: { alignItems: 'center' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingTop: '6%' },
  cross: { marginBottom: 22 },
  word: { fontFamily: SERIF, color: '#f4efe6', fontSize: Math.min(Dimensions.get('window').width * 0.16, 96), fontWeight: '800', letterSpacing: 8, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 24, textShadowOffset: { width: 0, height: 2 } },
  rule: { height: 2, marginTop: 18, marginBottom: 14, backgroundColor: GOLD },
  tag: { fontSize: 13, letterSpacing: 6, color: GOLD, fontWeight: '600', paddingLeft: 6 },
  dots: { flexDirection: 'row', gap: 9, marginTop: 30 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD_DIM },
});
