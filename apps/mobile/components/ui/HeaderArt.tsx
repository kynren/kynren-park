import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';

const W = 375;
const H = 96;
const KX = 318;

/**
 * The storybook landscape along the bottom of a header band: two rolling hills, the keep on the right and a few stars.
 * Drawn in translucent white and black so it takes on whatever colour the band behind it is. It measures its own width,
 * because a percentage-sized SVG is only measured once on a phone.
 */
export function HeaderArt() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return (
    <View style={styles.art} pointerEvents="none" onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMax slice">
          <G fill="#ffffff" opacity={0.5}>
            <Circle cx="48" cy="22" r="1.6" />
            <Circle cx="132" cy="40" r="1.2" />
            <Circle cx="212" cy="16" r="1.8" />
            <Circle cx="268" cy="34" r="1.2" />
            <Circle cx="352" cy="14" r="1.5" />
          </G>
          <Path d={`M0 ${H * 0.7} C 70 ${H * 0.5}, 140 ${H * 0.78}, 220 ${H * 0.62} S 340 ${H * 0.52}, ${W} ${H * 0.6} L ${W} ${H} L 0 ${H} Z`} fill="#ffffff" opacity={0.1} />
          <G fill="#000000" opacity={0.2}>
            <Rect x={KX - 22} y={H * 0.52} width={44} height={H * 0.48} />
            <Rect x={KX - 34} y={H * 0.62} width={14} height={H * 0.38} />
            <Rect x={KX + 20} y={H * 0.62} width={14} height={H * 0.38} />
            {[-34, -28, -22, -6, 0, 6, 20, 26, 32].map((dx, i) => (
              <Rect key={i} x={KX + dx} y={H * 0.52 - 4} width={4} height={5} />
            ))}
            <Polygon points={`${KX},${H * 0.28} ${KX - 8},${H * 0.52} ${KX + 8},${H * 0.52}`} />
          </G>
          <Path d={`M0 ${H * 0.84} C 90 ${H * 0.7}, 170 ${H * 0.92}, 260 ${H * 0.8} S ${W - 20} ${H * 0.78}, ${W} ${H * 0.82} L ${W} ${H} L 0 ${H} Z`} fill="#000000" opacity={0.22} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  art: { position: 'absolute', left: 0, right: 0, bottom: 0, height: H },
});
