import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './auth';
import { api } from './api';

export interface PersonalNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * Unread count for the signed-in guest's personal notifications (delay
 * alerts, order-ready, show reminders — see PushService.sendToUsers).
 * Refetches whenever the screen holding it regains focus, so the bell badge
 * in shows.tsx clears itself right after a visit to /notifications.
 */
export function useUnreadNotifications(): { count: number; refresh: () => void } {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!user) { setCount(0); return; }
    api<{ count: number }>('/me/notifications/unread-count')
      .then((r) => setCount(r.count))
      .catch(() => undefined);
  }, [user]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  return { count, refresh };
}
