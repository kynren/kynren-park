import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api, setToken, getToken, setRefreshToken, getRefreshToken } from './api';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on launch. The access token is short-lived (15 min), so
  // most re-opens land here with it already expired — api()'s own 401 retry
  // transparently redeems the (30-day, still-live) refresh token before this
  // /me call ever fails, which is what actually keeps a guest signed in
  // across app restarts instead of just within one 15-minute window.
  useEffect(() => {
    (async () => {
      const [token, refreshToken] = await Promise.all([getToken(), getRefreshToken()]);
      if (token || refreshToken) {
        try {
          const me = await api<AuthUser>('/me');
          setUser(me);
          registerPushToken().catch(() => undefined);
        } catch {
          await setToken(null);
          await setRefreshToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const applySession = useCallback(async (res: AuthResponse) => {
    await setToken(res.accessToken);
    await setRefreshToken(res.refreshToken);
    setUser(res.user);
    registerPushToken().catch(() => undefined);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await applySession(res);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
      await applySession(res);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      // Best-effort: revoke server-side so the refresh token can't be
      // redeemed again, but don't let an offline device block signing out.
      await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => undefined);
    }
    await setToken(null);
    await setRefreshToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Ask for notification permission and register this device's Expo push token
 * with the API so staff announcements and show-delay alerts can reach it.
 * Best-effort: silently no-ops on simulators or when permission is denied.
 */
export async function registerPushToken() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    let granted = status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    if (!granted) return;
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    // Public endpoint: registers the device even for guests, and links to the
    // signed-in user automatically when an auth token is present.
    await api('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token: tokenData.data, platform: Platform.OS }),
    });
  } catch {
    // Push not available in this environment — ignore.
  }
}
