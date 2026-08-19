import { useEffect, useState } from 'react';
import { useAuth } from './auth';
import { api } from './api';

/**
 * The signed-in guest's favourited attraction ids, server-backed via
 * /me/favorites (see attraction/[slug].tsx's toggleFavorite, the only place
 * that writes to it). Shared by the map's "Favourites" filter, Profile → My
 * favourites, and the Home screen's "Your favourites" section — previously
 * each read from its own disconnected local copy (or, on the map, one that
 * nothing ever wrote to), so a favourite starred on one screen silently
 * never appeared on another.
 */
export function useFavoriteIds(): { ids: Set<string>; loading: boolean } {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIds(new Set()); setLoading(false); return; }
    setLoading(true);
    api<{ attractionId: string }[]>('/me/favorites')
      .then((f) => setIds(new Set(f.map((x) => x.attractionId))))
      .catch(() => setIds(new Set()))
      .finally(() => setLoading(false));
  }, [user]);

  return { ids, loading };
}
