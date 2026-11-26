import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/app-settings/map' }));
vi.mock('@kynren/shared', () => ({ fitGeoCalibration: () => ({ ok: false, error: 'Mark at least 3 landmarks.' }) }));

const calls: { path: string; method: string }[] = [];
vi.mock('../lib/api', () => ({
  API_URL: 'http://test',
  friendlyError: (_e: unknown, fallback = 'Something went wrong.') => fallback,
  api: async (path: string, options: { method?: string } = {}) => {
    calls.push({ path, method: options.method ?? 'GET' });
    if (path === '/admin/map-config') return { markerColor: '#e5544b', markerStyle: 'pulse', mapImageUrl: null, initialZoom: 2, maxZoom: 8, centerLat: null, centerLng: null, popupAnimation: 'scale' };
    if (path === '/admin/pois' && options.method === 'POST') return { id: 'p-new', name: 'New hotspot', type: 'INFO', lat: 54.67, lng: -1.68, mapZone: null, image: null, color: null };
    return [];
  },
  apiUpload: async () => ({}),
}));
vi.mock('../components/QrButton', () => ({ QrButton: () => null }));
vi.mock('../components/GalleryEditor', () => ({ GalleryEditor: () => null }));

import MapPage from '../app/(dashboard)/app-settings/map/page';

// jsdom lays nothing out, so give the map editor a size to work with.
const realRect = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  calls.length = 0;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.classList.contains('mapcanvas')) return { x: 0, y: 0, left: 0, top: 0, right: 700, bottom: 500, width: 700, height: 500, toJSON: () => ({}) } as DOMRect;
    return realRect.call(this);
  };
});

const canvas = (c: HTMLElement) => c.querySelector('.mapcanvas') as HTMLElement;
const created = () => calls.filter((c) => c.path === '/admin/pois' && c.method === 'POST');

describe('Map editor: settings tabs', () => {
  it('shows one group of settings at a time', async () => {
    render(<MapPage />);
    const cards = () => [...document.querySelectorAll('.mapcards .editcard')].map((c) => [c.querySelector('h3')!.textContent, !(c as HTMLElement).hidden]);
    await waitFor(() => expect(cards().length).toBe(4));
    expect(cards()).toEqual([['Base maps', true], ['Real-world position', false], ['Guest marker & map', false], ['Initial mobile view', false]]);

    fireEvent.click(screen.getByRole('tab', { name: /Real-world position/ }));
    expect(cards()).toEqual([['Base maps', false], ['Real-world position', true], ['Guest marker & map', false], ['Initial mobile view', false]]);

    fireEvent.click(screen.getByRole('tab', { name: 'Guest app view' }));
    expect(cards()).toEqual([['Base maps', false], ['Real-world position', false], ['Guest marker & map', true], ['Initial mobile view', true]]);
  });

  it('marks which tab is selected', () => {
    render(<MapPage />);
    expect(screen.getByRole('tab', { name: /Base maps/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Guest app view' }));
    expect(screen.getByRole('tab', { name: 'Guest app view' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /Base maps/ }).getAttribute('aria-selected')).toBe('false');
  });
});

describe('Map editor: adding hotspots', () => {
  it('a single click on the map never adds a hotspot', async () => {
    const { container } = render(<MapPage />);
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/pois')).toBe(true));
    fireEvent.pointerDown(canvas(container), { clientX: 200, clientY: 200, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas(container), { clientX: 200, clientY: 200 });
    fireEvent.click(canvas(container), { clientX: 200, clientY: 200 });
    expect(created()).toHaveLength(0);
  });

  it('a deliberate double-click on an empty spot adds one', async () => {
    const { container } = render(<MapPage />);
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/pois')).toBe(true));
    fireEvent.pointerDown(canvas(container), { clientX: 200, clientY: 200, pointerType: 'mouse' });
    fireEvent.pointerUp(canvas(container), { clientX: 200, clientY: 200 });
    fireEvent.doubleClick(canvas(container), { clientX: 200, clientY: 200 });
    await waitFor(() => expect(created()).toHaveLength(1));
  });

  it('a drag that ends in a double-click does not add one', async () => {
    const { container } = render(<MapPage />);
    await waitFor(() => expect(calls.some((c) => c.path === '/admin/pois')).toBe(true));
    fireEvent.pointerDown(canvas(container), { clientX: 200, clientY: 200, pointerType: 'mouse' });
    fireEvent.pointerMove(canvas(container), { clientX: 260, clientY: 240, pointerType: 'mouse' });
    fireEvent.doubleClick(canvas(container), { clientX: 260, clientY: 240 });
    expect(created()).toHaveLength(0);
  });
});
