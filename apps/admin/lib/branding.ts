'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export interface Branding {
  appName: string; tagline: string; primary: string; accent: string; font?: string;
  logoUrl?: string | null; iconUrl?: string | null; faviconUrl?: string | null;
  splashType?: 'none' | 'photo' | 'gif' | 'video'; splashMediaUrl?: string | null;
  seasonOpens?: string | null;
}
export const DEFAULT_BRANDING: Branding = { appName: 'Kynren', tagline: 'The Storied Lands', primary: '#1b2b4b', accent: '#db0833', font: 'system' };

/** The park's own colours. */
export const BRAND_NAVY = '#1b2b4b';
export const BRAND_RED = '#db0833';
/** Older default colours that were saved before the official ones were chosen. The apps treat these as "not set". */
const LEGACY_COLOURS = new Set(['#8f1d21', '#8a1f31', '#e2862b', '#1f6b49', '#22b365', '#2f5b43']);
const isLegacy = (c?: string | null) => !!c && LEGACY_COLOURS.has(c.toLowerCase());

/** Swap any old default colours for the official navy and red. Reports whether anything was swapped. */
export function withOfficialColours<T extends { primary: string; accent: string }>(b: T): { value: T; changed: boolean } {
  const primary = isLegacy(b.primary) ? BRAND_NAVY : b.primary;
  const accent = isLegacy(b.accent) ? BRAND_RED : b.accent;
  return { value: { ...b, primary, accent }, changed: primary !== b.primary || accent !== b.accent };
}

const CACHE = 'kynren_branding';

/** Branding for chrome (sidebar/login). Cache-first, refreshed from the API. */
export function useBranding(): Branding {
  const [b, setB] = useState<Branding>(() => {
    if (typeof window === 'undefined') return DEFAULT_BRANDING;
    const raw = localStorage.getItem(CACHE);
    return raw ? { ...DEFAULT_BRANDING, ...JSON.parse(raw) } : DEFAULT_BRANDING;
  });
  useEffect(() => {
    api<Branding>('/branding')
      .then((v) => { setB({ ...DEFAULT_BRANDING, ...v }); localStorage.setItem(CACHE, JSON.stringify(v)); })
      .catch(() => undefined);
  }, []);
  return b;
}

/** Read a File as a data URL unchanged (keeps GIF animation; use for gifs/small media). */
export function rawDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** Resize an image File to a data URL (keeps aspect ratio, longest edge = maxDim). */
export function resizeToDataUrl(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('no canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
