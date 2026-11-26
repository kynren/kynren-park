import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Newer Node versions ship their own (unusable) localStorage global that hides jsdom's, so give the tests a simple one.
function memoryStorage(): Storage {
  let data: Record<string, string> = {};
  return {
    get length() { return Object.keys(data).length; },
    clear: () => { data = {}; },
    getItem: (k: string) => (k in data ? data[k] : null),
    key: (i: number) => Object.keys(data)[i] ?? null,
    removeItem: (k: string) => { delete data[k]; },
    setItem: (k: string, v: string) => { data[k] = String(v); },
  };
}
const storage = memoryStorage();
Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.useRealTimers();
});

// jsdom has no matchMedia; the header asks it whether the device prefers dark.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom does not lay anything out, so it has no scrollIntoView either.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;
