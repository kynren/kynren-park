import { useState } from 'react';
import { View, Image, StyleSheet, ScrollView, Dimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Full-bleed, swipeable hero gallery — a single image just fills the space;
 * two or more page horizontally with dot indicators (the active dot pill-
 * shaped, matching the reference detail-page pattern).
 */
export function ImageCarousel({ images, height }: { images: string[]; height: number }) {
  const [page, setPage] = useState(0);

  if (images.length === 0) return null;
  if (images.length === 1) {
    return (
      <View style={[styles.wrap, { height }]}>
        <Image source={{ uri: images[0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>
    );
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const p = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (p !== page) setPage(p);
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
      >
        {images.map((uri, i) => (
          <Image key={i} source={{ uri }} style={{ width: SCREEN_W, height }} resizeMode="cover" />
        ))}
      </ScrollView>
      <View style={styles.dots} pointerEvents="none">
        {images.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: '#0e1013' },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 18, backgroundColor: '#ffffff' },
});
