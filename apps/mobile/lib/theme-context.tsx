import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'kynren_theme_pref';

interface ThemeCtx {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  scheme: 'light' | 'dark';
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
    });
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(KEY, p).catch(() => undefined);
  };

  const scheme: 'light' | 'dark' = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;

  return <Ctx.Provider value={{ pref, setPref, scheme }}>{children}</Ctx.Provider>;
}

export function useThemePref(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useThemePref must be used within ThemeProvider');
  return c;
}
