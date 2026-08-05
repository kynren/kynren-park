import { Tabs, useRouter } from 'expo-router';
import { Text, Pressable } from 'react-native';
import { theme } from '../../lib/theme';
import { useI18n } from '../../lib/i18n';

// Emoji tab icons keep the app dependency-light (no icon font native setup).
function Icon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

function NotificationsBell() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/notifications')} hitSlop={12} style={{ paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 20 }}>🔔</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.brand },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab.today'),
          tabBarIcon: ({ color }) => <Icon emoji="🏰" color={color} />,
          headerRight: () => <NotificationsBell />,
        }}
      />
      <Tabs.Screen
        name="shows"
        options={{ title: t('tab.shows'), tabBarIcon: ({ color }) => <Icon emoji="🎭" color={color} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: t('tab.map'), tabBarIcon: ({ color }) => <Icon emoji="🗺️" color={color} /> }}
      />
      <Tabs.Screen
        name="food"
        options={{ title: t('tab.food'), tabBarIcon: ({ color }) => <Icon emoji="🍽️" color={color} /> }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: t('tab.plan'), tabBarIcon: ({ color }) => <Icon emoji="📋" color={color} /> }}
      />
      <Tabs.Screen
        name="tickets"
        options={{ title: t('tab.tickets'), tabBarIcon: ({ color }) => <Icon emoji="🎟️" color={color} /> }}
      />
    </Tabs>
  );
}
