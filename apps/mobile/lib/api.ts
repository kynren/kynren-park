import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL resolution:
//  • Dev builds (__DEV__): honour EXPO_PUBLIC_API_URL from the local `.env`
//    (e.g. http://localhost:4010) so on-device dev hits your machine.
//  • Production builds / OTA updates: ALWAYS use app.json `extra.apiUrl`
//    (the hosted API). Gating the dev override behind __DEV__ lets Metro
//    dead-code-eliminate the localhost value, so it can never leak into a
//    production bundle regardless of which .env happens to be present at export.
// Trailing slashes are stripped so paths join cleanly.
const extraApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
export const API_URL = (
  __DEV__
    ? process.env.EXPO_PUBLIC_API_URL || extraApiUrl || 'http://localhost:4010'
    : extraApiUrl || 'https://app-park.kynren.com'
).replace(/\/+$/, '');

const TOKEN_KEY = 'kynren_access_token';
const REFRESH_KEY = 'kynren_refresh_token';

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}
export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_KEY);
}
export async function setRefreshToken(token: string | null) {
  if (token) await AsyncStorage.setItem(REFRESH_KEY, token);
  else await AsyncStorage.removeItem(REFRESH_KEY);
}

// The access token is short-lived (15 min) by design; the refresh token
// (30 days, rotated on every use) is what actually keeps a guest signed in.
// Concurrent 401s (a screen can fire several requests at once) must share
// one in-flight refresh rather than each redeeming the token separately —
// the endpoint rotates it per call, so only the first of a race would ever
// succeed and the rest would each look like a genuine logout.
let refreshing: Promise<string | null> | null = null;
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = await getRefreshToken();
      if (!rt) return null;
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) {
          // The refresh token itself is invalid/expired/revoked — this is a
          // genuine end of session, not a network blip. Clear both tokens.
          await setToken(null);
          await setRefreshToken(null);
          return null;
        }
        const data = (await res.json()) as { accessToken: string; refreshToken: string };
        await setToken(data.accessToken);
        await setRefreshToken(data.refreshToken);
        return data.accessToken;
      } catch {
        // Offline or the request itself failed — leave tokens alone so the
        // next call can just retry; don't punish a connectivity blip with a
        // forced logout.
        return null;
      }
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const doFetch = (tok: string | null) =>
    fetch(`${API_URL}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        ...(options.headers || {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    // refreshAccessToken() itself no-ops (returns null) when there's no
    // refresh token stored, so this is harmless for a genuinely signed-out
    // caller — no need to gate it on `token` being present here too.
    const fresh = await refreshAccessToken();
    if (fresh) res = await doFetch(fresh);
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
