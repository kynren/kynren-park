import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Touchable } from './Touchable';

// Shared dark-card visual language for shop/show/restaurant/facility detail
// pages: a full-bleed photo gallery with a near-black content sheet below it.
export const dk = {
  bg: '#121212',
  sheet: '#151515',
  ink: '#ffffff',
  sub: '#b7b3ad',
  line: '#2a2a2a',
  chip: '#232323',
  pill: '#262626',
};

export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Touchable style={styles.closeBtn} onPress={onPress} hitSlop={8}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M6 6l12 12M18 6L6 18" />
      </Svg>
    </Touchable>
  );
}

export function IconBadge({ letter, image, tint }: { letter: string; image?: string | null; tint?: string }) {
  return (
    <View style={[styles.badge, { borderColor: dk.line }]}>
      {image ? (
        <Image source={{ uri: image }} style={styles.badgeImg} />
      ) : (
        <Text style={[styles.badgeTxt, { color: tint ?? dk.ink }]}>{letter}</Text>
      )}
    </View>
  );
}

export function TagChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagIcon}>{icon}</Text>
      <Text style={styles.tagTxt}>{label}</Text>
    </View>
  );
}

export function ActionPill({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Touchable style={styles.actionPill} onPress={onPress}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {icon.split('|').map((d, i) => <Path key={i} d={d} />)}
      </Svg>
      <Text style={styles.actionTxt}>{label}</Text>
    </Touchable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export const ICONS = {
  map: 'M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z|M9 4v14M15 6v14',
  menu: 'M6 3v8a3 3 0 0 0 6 0V3|M9 11v10|M17 3c-1.5 2-1.5 6 0 8.5V21',
  heart: 'M12 21s-7-4.35-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 3.5C19 16.65 12 21 12 21z',
  check: 'M20 6L9 17l-5-5',
  clock: 'M12 8v4l3 2|M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
};

const styles = StyleSheet.create({
  closeBtn: { position: 'absolute', right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  badge: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  badgeImg: { width: '100%', height: '100%' },
  badgeTxt: { fontWeight: '800', fontSize: 18 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: dk.chip, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  tagIcon: { fontSize: 13 },
  tagTxt: { color: dk.sub, fontSize: 12.5, fontWeight: '600' },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: dk.pill, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 16, flex: 1, justifyContent: 'center' },
  actionTxt: { color: '#fff', fontWeight: '700', fontSize: 13.5 },
  sectionLabel: { color: dk.ink, fontSize: 17, fontWeight: '800', marginTop: 22, marginBottom: 10 },
});
