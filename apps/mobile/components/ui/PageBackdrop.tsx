import { StyleSheet, View } from 'react-native';
import { ManagedImage, useHasSlotImage } from '../ManagedImage';
import { useUI } from '../../lib/ui';

/**
 * The picture the admin has set behind a whole page (System → App Images → Page backgrounds). It is softened with the page
 * colour so cards and text on top stay easy to read. Draws nothing when no picture is set.
 */
export function PageBackdrop({ page }: { page: string }) {
  const slot = `screen.${page}`;
  const has = useHasSlotImage(slot);
  const { c } = useUI();
  if (!has) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ManagedImage slot={slot} style={StyleSheet.absoluteFill} fadeColor={c.screen} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.screen, opacity: 0.86 }]} />
    </View>
  );
}
