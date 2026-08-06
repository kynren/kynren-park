import { Stack } from 'expo-router';
import { Alert, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AnnouncementMegaphone } from '../components/AnnouncementMegaphone';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SyncProvider } from '../lib/sync';
import { AuthProvider } from '../lib/auth';
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

// Show notifications while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function RootNav() {
  const { scheme } = useThemePref();
  const dark = scheme === 'dark';
  return (
    <View style={{ flex: 1 }}>
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
        <Stack.Screen name="restaurant/[slug]" options={{ title: 'Menu' }} />
        <Stack.Screen name="restaurants" options={{ headerShown: false }} />
        <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="language" options={{ title: 'Language', presentation: 'modal' }} />
      </Stack>
      <AnnouncementMegaphone />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <SyncProvider>
            <ThemeProvider>
              <RootNav />
            </ThemeProvider>
          </SyncProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
