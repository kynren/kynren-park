import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL resolution:
//  1. EXPO_PUBLIC_API_URL — set per-environment (local `.env` for dev, the EAS
//     build profile's env for preview/production builds).
//  2. app.json `extra.apiUrl` — the built-in fallback (points at production).
// Trailing slashes are stripped so paths join cleanly.
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  'https://api.kynren.com'
).replace(/\/+$/, '');

const TOKEN_KEY = 'kynren_access_token';

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
