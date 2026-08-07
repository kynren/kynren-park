'use client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'kynren_staff_token';
const STAFF_KEY = 'kynren_staff';

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStaff(): Staff | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STAFF_KEY);
  return raw ? (JSON.parse(raw) as Staff) : null;
}

export function setSession(token: string, staff: Staff) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(STAFF_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number, // 0 = network/unreachable
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    // fetch throws only on network-level failure (API down, wrong host, CORS).
    throw new ApiError(`Cannot reach the API at ${API_URL}. Is it running?`, 0);
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText);
    // Nest returns JSON errors ({ message, error, statusCode }); pull the message out.
    let message = raw;
    try {
      const j = JSON.parse(raw);
      if (j?.message) message = Array.isArray(j.message) ? j.message.join(', ') : j.message;
    } catch {
      /* not JSON — keep raw text */
    }
    // An expired/invalid staff session should return to login, not strand the
    // user on a dashboard where every call silently fails.
    if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      clearSession();
      window.location.replace('/login?expired=1');
    }
    throw new ApiError(message || `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
