import { Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import { theme } from '../lib/theme';
import { selection } from '../lib/haptics';

/** A always-on-top FAB that opens the QR scanner from any screen. */
export function FloatingScanner() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // Hidden on the scanner itself and full-screen modals where it would intrude.
  if (pathname?.startsWith('/scan') || pathname?.startsWith('/auth') || pathname?.startsWith('/book')) return null;

  return (
    <Pressable
      style={[styles.fab, { bottom: insets.bottom + 136, right: 16 }]}
      onPress={() => { selection(); router.push('/scan'); }}
      accessibilityLabel="Scan a QR code"
    >
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 8V5a1 1 0 0 1 1-1h3" />
        <Path d="M16 4h3a1 1 0 0 1 1 1v3" />
        <Path d="M20 16v3a1 1 0 0 1-1 1h-3" />
        <Path d="M8 20H5a1 1 0 0 1-1-1v-3" />
        <Line x1="4" y1="12" x2="20" y2="12" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: theme.brand,
    alignItems: 'center', justifyContent: 'center', zIndex: 40,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 8,
  },
});
