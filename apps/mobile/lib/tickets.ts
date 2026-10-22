import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { useAuth } from './auth';

const PARK_KEY = 'kynren_tickets';
const BOOKING_KEY = 'kynren_booking_tickets';
const DEAD = /CANCEL|REFUND|VOID|EXPIRE/i;

/** One ticket the guest can show at the gate, whichever way it was bought. */
export interface TicketItem {
  /** The code in the QR; unique, so it doubles as the ticket's id in the app. */
  id: string;
  kind: 'park' | 'booking';
  title: string;
  /** The price band, e.g. "Adult". */
  priceName: string | null;
  /** The day it is for, as given (an ISO date or a yyyy-mm-dd). */
  date: string | null;
  holder: string | null;
  /** The booking reference it belongs to. */
  reference: string;
  code: string;
  status: string | null;
  bookedOn: string | null;
  /** Other things in the same booking, e.g. "2 × Parking". */
  extras: string[];
}

interface CachedTicket { id: string; reference: string; ticketType: string; visitDate: string; qrToken: string }
interface GuestTicket { barcode: string | null; status: string | null; night: string | null; holder: string | null }
interface GuestLine { kind: string; name: string; priceName: string | null; quantity: number; tickets: GuestTicket[] }
interface GuestOrder { reference: string; status: string; placedAt: string; lines: GuestLine[] }
interface LinkedOrder { reference: string; order: Partial<GuestOrder> | null }

function fromBookings(orders: LinkedOrder[]): TicketItem[] {
  const out: TicketItem[] = [];
  for (const o of orders) {
    const lines = o.order?.lines ?? [];
    const extras = lines.filter((l) => l.kind !== 'TICKET').map((l) => `${l.quantity} × ${l.name}`);
    for (const line of lines) {
      if (line.kind !== 'TICKET') continue;
      for (const tk of line.tickets) {
        if (!tk.barcode || DEAD.test(tk.status ?? '')) continue;
        out.push({
          id: tk.barcode,
          kind: 'booking',
          title: line.name,
          priceName: line.priceName,
          date: tk.night,
          holder: tk.holder,
          reference: o.reference,
          code: tk.barcode,
          status: tk.status ? tk.status.toLowerCase() : null,
          bookedOn: o.order?.placedAt ?? null,
          extras,
        });
      }
    }
  }
  return out;
}

function fromPark(tickets: CachedTicket[]): TicketItem[] {
  return tickets.map((t) => ({
    id: t.id, kind: 'park', title: t.ticketType, priceName: null, date: t.visitDate, holder: null,
    reference: t.reference, code: t.qrToken, status: null, bookedOn: null, extras: [],
  }));
}

/** "24 Oct 2026" for an ISO date; anything else is shown as it came. */
export function ticketDay(date: string | null): string | null {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(date)) return date;
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whether the ticket's day has gone (tickets with no usable date count as still to come). */
export function ticketIsPast(date: string | null): boolean {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return false;
  const end = new Date(date.slice(0, 10) + 'T23:59:59');
  return end.getTime() < Date.now();
}

/**
 * Every ticket the guest holds: those saved on this phone from an in-app booking, and the tickets in any bookings linked to
 * their account. The linked ones are kept on the phone too, so the list and each ticket still open with no signal.
 */
export function useTickets(): { tickets: TicketItem[]; loading: boolean; reload: () => Promise<void> } {
  const { user } = useAuth();
  const [park, setPark] = useState<TicketItem[]>([]);
  const [booking, setBooking] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    const orders = await api<LinkedOrder[]>('/smeetz/my-orders');
    const items = fromBookings(orders);
    setBooking(items);
    AsyncStorage.setItem(BOOKING_KEY, JSON.stringify(items)).catch(() => undefined);
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    await loadBookings().catch(() => undefined);
  }, [user, loadBookings]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(PARK_KEY);
          if (alive) setPark(fromPark(raw ? JSON.parse(raw) : []));
        } catch {
          if (alive) setPark([]);
        }
        if (!user) {
          if (alive) { setBooking([]); setLoading(false); }
          AsyncStorage.removeItem(BOOKING_KEY).catch(() => undefined);
          return;
        }
        try {
          const cached = await AsyncStorage.getItem(BOOKING_KEY);
          if (alive && cached) setBooking(JSON.parse(cached));
        } catch { /* nothing cached */ }
        if (alive) setLoading(false);
        // what is stored at once, then look again for bookings made since
        await loadBookings().catch(() => undefined);
        api('/smeetz/refresh', { method: 'POST' })
          .then(() => (alive ? loadBookings() : undefined))
          .catch(() => undefined);
      })();
      return () => { alive = false; };
    }, [user, loadBookings]),
  );

  return { tickets: [...booking, ...park], loading, reload };
}

/** Link a booking by its reference. Throws if it can't be found. */
export async function linkBooking(reference: string): Promise<void> {
  await api('/smeetz/link', { method: 'POST', body: JSON.stringify({ reference }) });
}
