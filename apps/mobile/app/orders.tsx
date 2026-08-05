import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { io, type Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '@kynren/shared';
import { api, API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtTime, poundsFromCents } from '../lib/format';
import { theme } from '../lib/theme';

interface Order {
  id: string;
  status: string;
  pickupSlot: string;
  totalCents: number;
  restaurant: { name: string };
  items: { id: string; quantity: number; menuItem: { name: string } }[];
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Order received', color: theme.muted },
  PREPARING: { label: 'Being prepared', color: theme.warn },
  READY: { label: 'Ready to collect', color: theme.ok },
  COLLECTED: { label: 'Collected', color: theme.muted },
  CANCELLED: { label: 'Cancelled', color: theme.danger },
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) router.replace('/auth');
  }, [user]);

  const load = useCallback(async () => {
    try {
      setOrders(await api<Order[]>('/orders'));
    } catch {
      // offline — keep what we have
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live status: when the kitchen advances an order, refresh.
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join', {}));
    socket.on(REALTIME_EVENTS.orderUpdated, (e: { id: string; status: string }) => {
      setOrders((prev) => prev.map((o) => (o.id === e.id ? { ...o, status: e.status } : o)));
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {orders.length === 0 ? (
        <Text style={styles.muted}>No orders yet. Order ahead from the Food tab and track it here.</Text>
      ) : (
        orders.map((o) => {
          const meta = STATUS_META[o.status] ?? STATUS_META.PENDING!;
          return (
            <View key={o.id} style={styles.card}>
              <View style={styles.top}>
                <Text style={styles.restaurant}>{o.restaurant.name}</Text>
                <View style={[styles.badge, { backgroundColor: meta.color }]}>
                  <Text style={styles.badgeText}>{meta.label}</Text>
                </View>
              </View>
              <Text style={styles.muted}>Pickup at {fmtTime(o.pickupSlot)}</Text>
              {o.items.map((it) => (
                <Text key={it.id} style={styles.line}>
                  {it.quantity}× {it.menuItem.name}
                </Text>
              ))}
              <Text style={styles.total}>{poundsFromCents(o.totalCents)}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  muted: { color: theme.muted, fontSize: 14 },
  card: { backgroundColor: theme.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  restaurant: { fontWeight: '800', color: theme.ink, fontSize: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  line: { color: theme.ink, marginTop: 4 },
  total: { fontWeight: '800', color: theme.brand, marginTop: 8 },
});
