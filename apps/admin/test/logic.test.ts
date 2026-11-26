import { afterEach, describe, expect, it, vi } from 'vitest';
import { withOfficialColours, BRAND_NAVY, BRAND_RED } from '../lib/branding';
import { todayUk } from '../lib/dates';
import { DESTINATIONS } from '../lib/nav';

afterEach(() => vi.useRealTimers());

describe('withOfficialColours', () => {
  it('swaps every old default for the park navy and red', () => {
    for (const old of ['#8f1d21', '#8a1f31', '#e2862b', '#1f6b49', '#22b365', '#2f5b43']) {
      const { value, changed } = withOfficialColours({ primary: old, accent: old });
      expect(value).toEqual({ primary: BRAND_NAVY, accent: BRAND_RED });
      expect(changed).toBe(true);
    }
  });

  it('ignores letter case when recognising an old default', () => {
    expect(withOfficialColours({ primary: '#8A1F31', accent: '#DB0833' }).value.primary).toBe(BRAND_NAVY);
  });

  it('keeps colours somebody chose on purpose and says nothing changed', () => {
    const r = withOfficialColours({ primary: '#123456', accent: '#abcdef', extra: 1 });
    expect(r.value).toEqual({ primary: '#123456', accent: '#abcdef', extra: 1 });
    expect(r.changed).toBe(false);
  });

  it('only swaps the colour that is old', () => {
    const r = withOfficialColours({ primary: '#8a1f31', accent: '#abcdef' });
    expect(r.value).toEqual({ primary: BRAND_NAVY, accent: '#abcdef' });
  });
});

describe('todayUk', () => {
  it('is a plain YYYY-MM-DD date', () => {
    expect(todayUk()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('follows the park clock, not the browser clock', () => {
    vi.useFakeTimers();
    // 23:30 UTC in July is already 00:30 the next day in England (summer time)
    vi.setSystemTime(new Date('2026-07-18T23:30:00Z'));
    expect(todayUk()).toBe('2026-07-19');
    // 23:30 UTC in November is still the same day (GMT)
    vi.setSystemTime(new Date('2026-11-25T23:30:00Z'));
    expect(todayUk()).toBe('2026-11-25');
  });
});

describe('page search destinations', () => {
  it('lists every page once', () => {
    const hrefs = DESTINATIONS.map((d) => d.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('puts every System page behind the system permission', () => {
    for (const d of DESTINATIONS.filter((x) => x.href.startsWith('/system'))) expect(d.perm).toBe('system');
  });

  it('only uses permissions the console knows about', () => {
    const known = new Set(['schedule', 'food', 'content', 'manage', 'announce', 'analytics', 'system']);
    for (const d of DESTINATIONS) if (d.perm) expect(known.has(d.perm)).toBe(true);
  });
});
