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
