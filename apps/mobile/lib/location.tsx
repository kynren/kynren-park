import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as Location from 'expo-location';
import { api, getToken } from './api';

export type Geo = { lat: number; lng: number };
type Perm = 'unknown' | 'granted' | 'denied';
type LocationState = { gps: Geo | null; ready: boolean; permission: Perm };

const Ctx = createContext<LocationState>({ gps: null, ready: false, permission: 'unknown' });

/** Read the guest's location anywhere in the app. */
export function useLocation() {
  return useContext(Ctx);
}

/**
 * Starts locating the guest as soon as the app boots (i.e. during the splash),
 * so screens like the map already have a fix by the time they open — the "you
 * are here" beacon then appears immediately instead of the app briefly acting
 * as if the guest isn't at the park while GPS is still warming up.
 *
 * Strategy: ask permission → use the instant last-known position → refine with
 * an accurate fix → keep it fresh with a lightweight watcher. Presence is
 * reported once for signed-in guests so staff can see who's in the park.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [gps, setGps] = useState<Geo | null>(null);
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<Perm>('unknown');
  const reported = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') { setPermission('denied'); setReady(true); return; }
        setPermission('granted');

        // Instant, cached fix so the map has something to show right away.
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (!cancelled && last) setGps({ lat: last.coords.latitude, lng: last.coords.longitude });
        } catch { /* ignore */ }

        // Accurate current fix.
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!cancelled) setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch { /* ignore */ }
        if (!cancelled) setReady(true);

        // Keep it current while the app is open (cheap, throttled).
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 },
          (pos) => { if (!cancelled) setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        );
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; sub?.remove(); };
  }, []);

  // Report presence once we have a fix and the guest is signed in.
  useEffect(() => {
    if (!gps || reported.current) return;
    (async () => {
      const token = await getToken();
      if (token) { reported.current = true; api('/me/presence', { method: 'POST', body: JSON.stringify(gps) }).catch(() => undefined); }
    })();
  }, [gps]);

  return <Ctx.Provider value={{ gps, ready, permission }}>{children}</Ctx.Provider>;
}
