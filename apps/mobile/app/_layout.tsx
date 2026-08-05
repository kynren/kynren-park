import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SyncProvider } from '../lib/sync';
import { AuthProvider } from '../lib/auth';
import { I18nProvider } from '../lib/i18n';
import { theme } from '../lib/theme';

// Show notifications while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
      <AuthProvider>
        <SyncProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.brand },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="attraction/[slug]" options={{ title: 'Show' }} />
            <Stack.Screen name="auth" options={{ title: 'Sign in', presentation: 'modal' }} />
            <Stack.Screen name="book" options={{ title: 'Book tickets', presentation: 'modal' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="restaurant/[slug]" options={{ title: 'Menu' }} />
            <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
            <Stack.Screen name="language" options={{ title: 'Language', presentation: 'modal' }} />
          </Stack>
        </SyncProvider>
      </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
