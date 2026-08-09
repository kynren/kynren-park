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

/**
 * Turn an error into a friendly, human sentence for on-screen banners.
 * Authorisation failures (403) get a clear "you don't have access" message
 * instead of a raw "Missing permission: …" string.
 */
export function friendlyError(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Your session has expired — please sign in again.';
    if (e.status === 403) return 'You don’t have access to this — ask an administrator if you need it.';
    if (e.status === 404) return 'This isn’t available.';
    if (e.status === 0) return 'Can’t reach the server. Check your connection and try again.';
    if (e.status >= 500) return 'The server ran into a problem. Please try again shortly.';
    return e.message || fallback;
  }
  return fallback;
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
    // Authorisation failures are shown to humans, so replace the raw
    // "Missing permission: …" text with a friendly sentence at the source.
    if (res.status === 403) {
      message = 'You don’t have access to this — ask an administrator if you need it.';
    }
    throw new ApiError(message || `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Like `api`, but sends a JSON body via XMLHttpRequest so upload progress can be
 * reported (fetch can't). Use for anything that ships a large payload (e.g. an
 * image data URL) where the user should see a progress toast.
 */
export function apiUpload<T = unknown>(
  path: string,
  body: unknown,
  opts: { method?: string; onProgress?: (pct: number) => void } = {},
): Promise<T> {
  const token = getToken();
  const method = opts.method ?? 'PATCH';
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_URL}/api${path}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress!((e.loaded / e.total) * 100); };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204 || !xhr.responseText) return resolve(undefined as T);
        try { resolve(JSON.parse(xhr.responseText) as T); } catch { resolve(undefined as T); }
        return;
      }
      let message = xhr.responseText;
      try { const j = JSON.parse(xhr.responseText); if (j?.message) message = Array.isArray(j.message) ? j.message.join(', ') : j.message; } catch { /* keep raw */ }
      if (xhr.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        clearSession();
        window.location.replace('/login?expired=1');
      }
      if (xhr.status === 403) message = 'You don’t have access to this — ask an administrator if you need it.';
      reject(new ApiError(message || `Request failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError(`Cannot reach the API at ${API_URL}. Is it running?`, 0));
    xhr.send(JSON.stringify(body));
  });
}
