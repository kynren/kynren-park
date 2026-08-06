import React, { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, type Socket } from 'socket.io-client';
import { REALTIME_EVENTS, type SessionUpdatedEvent } from './shared';
import { API_URL } from './api';

// --- Bundle shape (mirrors GET /api/sync/bundle) ---------------------------
export interface Poi {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  lat: number;
  lng: number;
  mapZone?: string | null;
  color?: string | null;
  icon?: string | null;
}
export interface MapConfig {
  markerColor: string;
  markerStyle: string;
  mapImageUrl?: string | null;
}
export interface ParkMap {
  id: string;
  name: string;
  imageUrl?: string | null;
  isDefault: boolean;
}
export interface Attraction {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline?: string | null;
  synopsis: string;
  durationMins: number;
  heroImage?: string | null;
  poiId?: string | null;
  wheelchairAccessible: boolean;
  hasAudioDescription: boolean;
  hasCaptioning: boolean;
  hasBSL: boolean;
  sensoryNotes?: string | null;
  sortOrder: number;
}
export interface Session {
  id: string;
  attractionId: string;
  startTime: string;
  endTime: string;
  status: string;
  revisedStart: string | null;
  note: string | null;
  attraction: { id: string; slug: string; name: string; category: string };
}
export interface MenuItem { id: string; name: string; description?: string | null; priceCents: number; dietaryTags: string[]; }
export interface Restaurant { id: string; slug: string; name: string; cuisine?: string | null; openingHours?: string | null; menuItems: MenuItem[]; poiId?: string | null; }
export interface TicketType { id: string; name: string; category: string; priceCents: number; description?: string | null; }
export interface ContentPage { id: string; slug: string; title: string; body: string; category?: string | null; }
export interface Announcement { id: string; title: string; body: string; createdAt: string; }

export interface Bundle {
  date: string;
  generatedAt: string;
  attractions: Attraction[];
  pois: Poi[];
  restaurants: Restaurant[];
  ticketTypes: TicketType[];
  content: ContentPage[];
  announcements: Announcement[];
  sessions: Session[];
  mapConfig?: MapConfig | null;
  defaultMap?: ParkMap | null;
}

interface SyncState {
  bundle: Bundle | null;
  lastSynced: Date | null;
  online: boolean;
  loading: boolean;
  date: string;
  setDate: (d: string) => void;
  refresh: () => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);
const bundleKey = (date: string) => `kynren_bundle_${date}`;
const etagKey = (date: string) => `kynren_etag_${date}`;

// Opening day is a sensible default so the demo has data out of the box.
const DEFAULT_DATE = '2026-07-18';

export function SyncProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(DEFAULT_DATE);
  const socketRef = useRef<Socket | null>(null);

  // 1) Instant load from cache (works fully offline).
  useEffect(() => {
    (async () => {
      setLoading(true);
      const cached = await AsyncStorage.getItem(bundleKey(date));
      if (cached) {
        setBundle(JSON.parse(cached));
        const gen = await AsyncStorage.getItem(`${bundleKey(date)}_at`);
        if (gen) setLastSynced(new Date(gen));
      }
      setLoading(false);
      refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // 2) Network refresh with ETag (cheap 304 when unchanged).
  const refresh = useCallback(async () => {
    try {
      const etag = await AsyncStorage.getItem(etagKey(date));
      const res = await fetch(`${API_URL}/api/sync/bundle?date=${date}`, {
        headers: etag ? { 'If-None-Match': etag } : {},
      });
      setOnline(true);
      if (res.status === 304) {
        setLastSynced(new Date());
        return;
      }
      if (!res.ok) return;
      const data = (await res.json()) as Bundle;
      const newEtag = res.headers.get('etag');
      setBundle(data);
      const now = new Date();
      setLastSynced(now);
      await AsyncStorage.setItem(bundleKey(date), JSON.stringify(data));
      await AsyncStorage.setItem(`${bundleKey(date)}_at`, now.toISOString());
      if (newEtag) await AsyncStorage.setItem(etagKey(date), newEtag);
    } catch {
      // Offline: keep serving the cached bundle.
      setOnline(false);
    }
  }, [date]);

  // 3) Realtime patches: apply live schedule changes to the cached bundle.
  useEffect(() => {
    const socket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setOnline(true);
      socket.emit('join', { date });
    });
    socket.on('disconnect', () => setOnline(false));
    socket.on(REALTIME_EVENTS.sessionUpdated, (e: SessionUpdatedEvent) => {
      setBundle((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          sessions: prev.sessions.map((s) =>
            s.id === e.id ? { ...s, status: e.status, revisedStart: e.revisedStart, note: e.note } : s,
          ),
        };
        AsyncStorage.setItem(bundleKey(date), JSON.stringify(next)).catch(() => undefined);
        return next;
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [date]);

  return (
    <SyncContext.Provider value={{ bundle, lastSynced, online, loading, date, setDate, refresh }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
