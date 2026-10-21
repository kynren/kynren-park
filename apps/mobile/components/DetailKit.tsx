import { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageCarousel } from './ImageCarousel';
import { Touchable } from './Touchable';
import { GradientFill } from './ui/Gradient';
import { serif, band } from '../lib/theme';
import { useUI } from '../lib/ui';

// Shared visual language for the shop / show / restaurant / facility detail pages: a full-bleed photo (or the feature's own
// gradient when there is none) with a rounded white sheet rising over it.
export type DK = {
  bg: string;
  sheet: string;
  ink: string;
  sub: string;
  line: string;
  chip: string;
  pill: string;
  primary: string;
  /** Primary as text or an icon on a tinted surface (lighter in dark mode). */
  link: string;
  dark: boolean;
};

export function useDK(): DK {
  const { c, dark } = useUI();
  return useMemo(
    () => ({ bg: c.screen, sheet: c.card, ink: c.text, sub: c.sub, line: c.line, chip: c.soft, pill: c.tint, primary: c.primary, link: c.link, dark }),
    [c, dark],
  );
}

/** The top of a detail page: the photo gallery, or a gradient band (with room for the close button) when there are no photos. */
export function DetailHero({ images, height, colors = band }: { images: string[]; height: number; colors?: { from: string; to: string } }) {
  const insets = useSafeAreaInsets();
  if (images.length > 0) return <ImageCarousel images={images} height={height} />;
  return (
    <View style={{ height: insets.top + 120, overflow: 'hidden' }}>
      <GradientFill from={colors.from} to={colors.to} vertical />
    </View>
  );
}

export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Touchable style={styles.closeBtn} onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 6l12 12M18 6L6 18" />
      </Svg>
    </Touchable>
  );
}

export function IconBadge({ letter, image, tint }: { letter: string; image?: string | null; tint?: string }) {
  const dk = useDK();
  return (
    <View style={[styles.badge, { backgroundColor: dk.pill }]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.badgeImg} />
      ) : (
        <Text style={[styles.badgeTxt, { color: tint ?? dk.link }]}>{letter}</Text>
      )}
    </View>
  );
}

export function TagChip({ icon, label }: { icon: string; label: string }) {
  const dk = useDK();
  return (
    <View style={[styles.tag, { backgroundColor: dk.chip }]}>
      <Text style={styles.tagIcon}>{icon}</Text>
      <Text style={[styles.tagTxt, { color: dk.sub }]}>{label}</Text>
    </View>
  );
}

export function ActionPill({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const dk = useDK();
  return (
    <Touchable style={[styles.actionPill, { backgroundColor: dk.pill }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={dk.link} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {icon.split('|').map((d, i) => <Path key={i} d={d} />)}
      </Svg>
      <Text style={[styles.actionTxt, { color: dk.link }]}>{label}</Text>
    </Touchable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const dk = useDK();
  return <Text accessibilityRole="header" style={[styles.sectionLabel, { color: dk.ink }]}>{children}</Text>;
}

export const ICONS = {
  map: 'M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z|M9 4v14M15 6v14',
  menu: 'M6 3v8a3 3 0 0 0 6 0V3|M9 11v10|M17 3c-1.5 2-1.5 6 0 8.5V21',
  heart: 'M12 21s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 3.5C19 16.65 12 21 12 21z',
  check: 'M20 6L9 17l-5-5',
  clock: 'M12 8v4l3 2|M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
};

const styles = StyleSheet.create({
  closeBtn: { position: 'absolute', right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(15,31,75,0.55)', alignItems: 'center', justifyContent: 'center' },
  badge: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badgeImg: { width: '100%', height: '100%' },
  badgeTxt: { fontWeight: '800', fontSize: 18 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13 },
  tagIcon: { fontSize: 13 },
  tagTxt: { fontSize: 12.5, fontWeight: '600' },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, flex: 1, justifyContent: 'center' },
  actionTxt: { fontWeight: '700', fontSize: 13.5 },
  sectionLabel: { fontFamily: serif, fontSize: 19, fontWeight: '800', marginTop: 24, marginBottom: 10 },
});
