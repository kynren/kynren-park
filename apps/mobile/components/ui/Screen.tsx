import type { ReactElement, ReactNode } from 'react';
import { ScrollView, type RefreshControlProps, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { KeyboardAvoid } from '../KeyboardAvoid';
import { ScreenHeader } from './Header';
import { useUI } from '../../lib/ui';

/**
 * The frame for every screen opened from the menu or a card: the app's header with a back arrow, then a padded scrolling body.
 * (Home, Search, Map, Restaurants, Programme and Tickets lay out their own headers.)
 */
export function Screen({
  title,
  children,
  colors,
  right,
  scroll = true,
  keyboard = false,
  padded = true,
  refreshControl,
  contentStyle,
  onBack,
}: {
  title: string;
  children: ReactNode;
  colors?: { from: string; to: string };
  right?: ReactNode;
  /** false for a body that scrolls itself (a list) or fills the screen. */
  scroll?: boolean;
  /** Keep fields above the keyboard. */
  keyboard?: boolean;
  padded?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  onBack?: () => void;
}) {
  const router = useRouter();
  const { c } = useUI();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')));

  const body = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
      style={styles.fill}
      contentContainerStyle={[padded && styles.padded, { paddingBottom: 40 }, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.fill, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: c.screen }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={title} tone="sky" colors={colors} menuIcon="back" onMenu={back} right={right} />
      {keyboard ? <KeyboardAvoid>{body}</KeyboardAvoid> : body}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
});
