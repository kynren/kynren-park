import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { io, type Socket } from 'socket.io-client';
import { Card } from '../components/ui/Controls';
import { Screen } from '../components/ui/Screen';
import { REALTIME_EVENTS } from '../lib/shared';
import { api, API_URL } from '../lib/api';
import { useAuth } from '../lib/auth';
import { fmtTimeUK, poundsFromCents } from '../lib/format';
import { featureGradient } from '../lib/theme';
import { useUI } from '../lib/ui';

interface Order {
  id: string;
  status: string;
  pickupSlot: string;
  totalCents: number;
  restaurant: { name: string };
  items: { id: string; quantity: number; menuItem: { name: string } }[];
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Order received',
  PREPARING: 'Being prepared',
  READY: 'Ready to collect',
  COLLECTED: 'Collected',
  CANCELLED: 'Cancelled',
};

export default function OrdersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { c } = useUI();
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const statusColor: Record<string, string> = { PENDING: c.sub, PREPARING: c.warn, READY: c.ok, COLLECTED: c.sub, CANCELLED: c.danger };

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
    <Screen title="My orders" colors={featureGradient.restaurants} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {orders.length === 0 ? (
        <Text style={[styles.muted, { color: c.sub }]}>No orders yet. Order ahead from the Restaurants tab and track it here.</Text>
      ) : (
        orders.map((o) => {
          const color = statusColor[o.status] ?? c.sub;
          return (
            <Card key={o.id} style={styles.card}>
              <View style={styles.top}>
                <Text style={[styles.restaurant, { color: c.text }]} numberOfLines={2}>{o.restaurant.name}</Text>
                <View style={[styles.badge, { backgroundColor: color }]}>
                  <Text style={styles.badgeText}>{STATUS_LABEL[o.status] ?? STATUS_LABEL.PENDING}</Text>
                </View>
              </View>
              <Text style={[styles.muted, { color: c.sub }]}>Pickup at {fmtTimeUK(new Date(o.pickupSlot))}</Text>
              {o.items.map((it) => (
                <Text key={it.id} style={[styles.line, { color: c.text }]}>
                  {it.quantity}× {it.menuItem.name}
                </Text>
              ))}
              <Text style={[styles.total, { color: c.link }]}>{poundsFromCents(o.totalCents)}</Text>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 14, lineHeight: 20 },
  card: { padding: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 },
  restaurant: { flex: 1, fontWeight: '800', fontSize: 16 },
  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  badgeText: { color: '#ffffff', fontSize: 11.5, fontWeight: '700' },
  line: { marginTop: 4, fontSize: 14.5 },
  total: { fontWeight: '800', marginTop: 10, fontSize: 16 },
});
