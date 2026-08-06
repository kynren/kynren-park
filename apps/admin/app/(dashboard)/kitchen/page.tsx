'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, API_URL } from '../../../lib/api';
import { confirmDelete } from '../../../lib/confirm';
import { REALTIME_EVENTS } from '@kynren/shared';

interface Restaurant {
  id: string;
  name: string;
}
interface Order {
  id: string;
  status: string;
  pickupSlot: string;
  totalCents: number;
  items: { id: string; quantity: number; menuItem: { name: string } }[];
}

const NEXT: Record<string, string | null> = {
  PENDING: 'PREPARING',
  PREPARING: 'READY',
  READY: 'COLLECTED',
  COLLECTED: null,
};
const fmt = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
const pounds = (c: number) => `£${(c / 100).toFixed(2)}`;

export default function KitchenPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    api<Restaurant[]>('/restaurants').then((r) => {
      setRestaurants(r);
      if (r[0]) setRestaurantId(r[0].id);
    });
  }, []);

  const load = useCallback(async (id: string) => {
    if (!id) return;
    setOrders(await api<Order[]>(`/kitchen/orders?restaurantId=${id}`));
  }, []);

  useEffect(() => {
    load(restaurantId);
  }, [restaurantId, load]);

  // Live: refresh the queue whenever any order changes.
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on(REALTIME_EVENTS.orderUpdated, () => load(restaurantId));
    return () => {
      socket.disconnect();
    };
  }, [restaurantId, load]);

  async function advance(order: Order) {
    const next = NEXT[order.status];
    if (!next) return;
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    await api(`/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) }).catch(() =>
      load(restaurantId),
    );
    if (next === 'COLLECTED') load(restaurantId);
  }

  async function cancel(order: Order) {
    if (!(await confirmDelete('Cancel this order?', 'Cancel order?', { confirmLabel: 'Cancel order', danger: true }))) return;
    await api(`/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }) });
    load(restaurantId);
  }

  return (
    <div>
      <h1>Kitchen — Click &amp; Collect</h1>
      <p className="subtitle">Live order queue. Advancing to “Ready” notifies the guest’s app automatically.</p>

      <div className="toolbar">
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <button className="act" onClick={() => load(restaurantId)}>Refresh</button>
        <span className="live">
          <span className="dot" style={{ background: connected ? 'var(--ok)' : 'var(--muted)' }} />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div className="board">
        {orders.length === 0 && <div className="card">No open orders.</div>}
        {orders.map((o) => (
          <div key={o.id} className={`session ${o.status === 'READY' ? 'SCHEDULED' : o.status === 'PREPARING' ? 'DELAYED' : 'FULL'}`}>
            <div>
              <div className="time">{fmt(o.pickupSlot)}</div>
              <div className="cat">pickup</div>
            </div>
            <div>
              <div className="name">{o.items.map((i) => `${i.quantity}× ${i.menuItem.name}`).join(', ')}</div>
              <div className="cat">{pounds(o.totalCents)}</div>
            </div>
            <div className="actions">
              <span className={`badge ${o.status === 'READY' ? 'SCHEDULED' : o.status === 'PREPARING' ? 'DELAYED' : 'FULL'}`}>{o.status}</span>
              {NEXT[o.status] && (
                <button className="act" onClick={() => advance(o)}>
                  → {NEXT[o.status]}
                </button>
              )}
              <button className="act" onClick={() => cancel(o)}>Cancel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
