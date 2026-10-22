import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { useAuth } from './auth';

const KEY = 'kynren_prefs';

export type HomeView = 'cards' | 'list';
/** The lists on Home that each have their own cards-or-list choice. */
export type HomeList = 'comingUp' | 'favourites';

const isView = (v: unknown): v is HomeView => v === 'cards' || v === 'list';
const PREF: Record<HomeList, string> = { comingUp: 'homeViewComingUp', favourites: 'homeViewFavourites' };

type Prefs = Record<string, unknown>;
type Views = Record<HomeList, HomeView>;

async function readPhone(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Read each list's choice from a stored set of preferences. An older single `homeView` choice applies to both lists. */
function viewsFrom(p: Prefs | null | undefined): Partial<Views> {
  if (!p) return {};
  const out: Partial<Views> = {};
  for (const list of Object.keys(PREF) as HomeList[]) {
    const own = p[PREF[list]];
    if (isView(own)) out[list] = own;
    else if (isView(p.homeView)) out[list] = p.homeView;
  }
  return out;
}

/**
 * How Home shows "Coming up" and "Your favourites": each as picture cards or as a list, chosen separately. The guest's
 * choices are always kept on their phone, and also on their profile once they have an account, so they follow them to a
 * new phone. If they chose before signing in, those choices are carried onto the new profile.
 */
export function useHomeViews(): { views: Views; setView: (list: HomeList, view: HomeView) => void } {
  const { user } = useAuth();
  // A list is what guests see until they choose otherwise.
  const [views, setViews] = useState<Views>({ comingUp: 'list', favourites: 'list' });

  useEffect(() => {
    readPhone().then((p) => setViews((cur) => ({ ...cur, ...viewsFrom(p) })));
  }, []);

  useEffect(() => {
    if (!user) return;
    api<{ preferences?: Prefs | null }>('/me')
      .then(async (me) => {
        const saved = viewsFrom(me.preferences);
        if (Object.keys(saved).length) {
          setViews((cur) => ({ ...cur, ...saved }));
          const phone = await readPhone();
          AsyncStorage.setItem(KEY, JSON.stringify({ ...phone, ...flat(saved) })).catch(() => undefined);
        } else {
          const phone = viewsFrom(await readPhone());
          if (Object.keys(phone).length) api('/me/preferences', { method: 'PATCH', body: JSON.stringify(flat(phone)) }).catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }, [user?.id]);

  const setView = (list: HomeList, view: HomeView) => {
    setViews((cur) => ({ ...cur, [list]: view }));
    readPhone().then((phone) => AsyncStorage.setItem(KEY, JSON.stringify({ ...phone, [PREF[list]]: view })).catch(() => undefined));
    if (user) api('/me/preferences', { method: 'PATCH', body: JSON.stringify({ [PREF[list]]: view }) }).catch(() => undefined);
  };

  return { views, setView };
}

function flat(v: Partial<Views>): Prefs {
  const out: Prefs = {};
  for (const list of Object.keys(v) as HomeList[]) out[PREF[list]] = v[list];
  return out;
}
