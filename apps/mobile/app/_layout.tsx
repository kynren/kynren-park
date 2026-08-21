import { Stack, useRouter } from 'expo-router';
import { useEffect, cloneElement } from 'react';
import { Alert, View, Text, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { AnnouncementMegaphone } from '../components/AnnouncementMegaphone';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { FloatingScanner } from '../components/FloatingScanner';
import { Walkthrough } from '../components/Walkthrough';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SyncProvider, useSync } from '../lib/sync';
import { LocationProvider } from '../lib/location';
import { AuthProvider, registerPushToken } from '../lib/auth';
import { I18nProvider } from '../lib/i18n';
import { ThemeProvider, useThemePref } from '../lib/theme-context';
import { theme } from '../lib/theme';

// Surface any UNCAUGHT error as a native popup, instead of a silent failure
// (or a red-box only in dev). Handled errors keep their own inline UI.
const g = global as unknown as {
  ErrorUtils?: { getGlobalHandler?: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler?: (h: (e: unknown, fatal?: boolean) => void) => void };
  __kynrenErrorHandler?: boolean;
};
if (g.ErrorUtils?.setGlobalHandler && !g.__kynrenErrorHandler) {
  g.__kynrenErrorHandler = true;
  const prev = g.ErrorUtils.getGlobalHandler?.();
  g.ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    const message = (error as Error)?.message ?? String(error);
    try {
      Alert.alert(
        isFatal ? 'Something went wrong' : 'Error',
        isFatal ? `${message}\n\nPlease restart the app.` : message,
      );
    } catch {
      /* ignore alert failures */
    }
    prev?.(error, isFatal);
  });
}

// Admin-selectable app font (branding.font) applied globally by patching the
// Text renderer to prepend a fontFamily — component styles still override it.
const FONT_FAMILY: Record<string, string | undefined> = {
  system: undefined,
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  rounded: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: undefined }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};
let brandFontFamily: string | undefined;
try {
  const TextAny = Text as unknown as { render?: (...a: unknown[]) => any; __brandPatched?: boolean };
  if (TextAny.render && !TextAny.__brandPatched) {
    TextAny.__brandPatched = true;
    const orig = TextAny.render;
    TextAny.render = function (this: unknown, ...args: unknown[]) {
      const el = orig.apply(this, args);
      if (!brandFontFamily || !el) return el;
      return cloneElement(el, { style: [{ fontFamily: brandFontFamily }, (el as any).props?.style] });
    };
  }
} catch {
  /* if the internal shape changes, silently skip custom fonts */
}

// Show notifications while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Turn an admin-entered NotificationTemplate/Announcement `deepLink` (free
 * text) into an in-app expo-router path. The backend's own generated
 * deepLinks are already bare paths ("/attraction/slug"), which pass through
 * unchanged, but the field is free text an admin can type anything into —
 * including a scheme-prefixed form like "kynren://attraction/slug" (the
 * scanner's QR codes use a similarly-shaped kynren:// scheme for a
 * different purpose, so typing that pattern here by mistake is plausible).
 * Strips a leading scheme if present. Returns null for empty input so a
 * blank deepLink is a no-op instead of navigating to "/".
 */
function resolveDeepLink(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  return withoutScheme.startsWith('/') ? withoutScheme : `/${withoutScheme}`;
}

function RootNav() {
  const { scheme } = useThemePref();
  const dark = scheme === 'dark';
  const router = useRouter();
  const { bundle } = useSync();
  const brandFont = bundle?.branding?.font ?? 'system';
  brandFontFamily = FONT_FAMILY[brandFont]; // read by the patched Text renderer

  // Register this device for push on launch (guests included); route on tap.
  useEffect(() => {
    registerPushToken().catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as { type?: string; deepLink?: string } | undefined;
      const path = data?.deepLink ? resolveDeepLink(data.deepLink) : null;
      if (path) {
        try {
          router.push(path as never);
        } catch {
          // Admin-entered deepLink didn't resolve to a real route — fail
          // quietly rather than crash on tap.
        }
      } else if (data?.type === 'announcement') {
        router.push('/notifications');
      }
    });
    return () => sub.remove();
  }, [router]);

  return (
    <View key={brandFont} style={{ flex: 1 }}>
      <StatusBar style={dark ? 'light' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: dark ? '#141414' : theme.brand },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: dark ? '#0c0c0c' : theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="attraction/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ title: 'Sign in', presentation: 'modal' }} />
        <Stack.Screen name="book" options={{ title: 'Book tickets', presentation: 'modal' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="restaurant/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="restaurants" options={{ headerShown: false }} />
        <Stack.Screen name="facility/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="shop/[slug]" options={{ headerShown: false }} />
        <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="favorites" options={{ headerShown: false }} />
        <Stack.Screen name="seen" options={{ headerShown: false }} />
        <Stack.Screen name="language" options={{ title: 'Language', presentation: 'modal' }} />
        <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
      <FloatingScanner />
      <AnnouncementMegaphone />
      <Walkthrough />
      <LoadingOverlay />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <SyncProvider>
              <ThemeProvider>
                <LocationProvider>
                  <RootNav />
                </LocationProvider>
              </ThemeProvider>
            </SyncProvider>
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
