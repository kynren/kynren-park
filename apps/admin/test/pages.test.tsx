import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
  useParams: () => ({ id: 's1' }),
}));
vi.mock('socket.io-client', () => ({ io: () => ({ on: () => undefined, off: () => undefined, disconnect: () => undefined, close: () => undefined }) }));
vi.mock('@kynren/shared', () => ({ REALTIME_EVENTS: { SESSION_UPDATED: 'session.updated' } }));

// A fake server: each test says what an address answers; anything else answers with an empty list.
const answers = new Map<string, unknown | Error>();
const asked: string[] = [];
vi.mock('../lib/api', () => ({
  API_URL: 'http://test',
  getStaff: () => ({ id: '1', name: 'Seth Boampong', email: 's@k.com', role: 'ADMIN' }),
  friendlyError: (_e: unknown, fallback = 'Something went wrong.') => fallback,
  api: async (path: string) => {
    asked.push(path);
    const key = path.split('?')[0];
    const hit = answers.has(path) ? answers.get(path) : answers.get(key);
    if (hit instanceof Error) throw hit;
    return hit === undefined ? [] : hit;
  },
  apiUpload: async () => ({}),
}));
vi.mock('../lib/perms', () => ({ usePerms: () => ({ role: 'ADMIN', perms: {}, can: () => true }) }));

import { todayUk } from '../lib/dates';
import DatabasePage from '../app/(dashboard)/system/database/page';
import BrandingPage from '../app/(dashboard)/system/branding/page';
import DashboardPage from '../app/(dashboard)/dashboard/page';
import SchedulePage from '../app/(dashboard)/schedule/page';
import ShowsPage from '../app/(dashboard)/shows/page';
import AnalyticsPage from '../app/(dashboard)/analytics/page';
import AttractionsPage from '../app/(dashboard)/attractions/page';
import ShopDetail from '../app/(dashboard)/app-settings/shops/[id]/page';

beforeEach(() => { answers.clear(); asked.length = 0; });

describe('System > Database', () => {
  it('shows the table counts and their total', async () => {
    answers.set('/admin/db-stats', { generatedAt: '2026-11-26T10:00:00Z', tables: [{ name: 'Guest', rows: 1200 }, { name: 'Ticket', rows: 34 }] });
    render(<DatabasePage />);
    await waitFor(() => expect(screen.getByText('Guest')).toBeTruthy());
    expect(screen.getByText('1,200')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy(); // total
    expect(screen.getByText('PostgreSQL connected')).toBeTruthy();
  });

  it('does not crash when the server sends something without a table list', async () => {
    answers.set('/admin/db-stats', {});
    render(<DatabasePage />);
    await waitFor(() => expect(screen.getByText(/returned no table counts/)).toBeTruthy());
  });

  it('does not crash on a list where an object was expected', async () => {
    answers.set('/admin/db-stats', []);
    render(<DatabasePage />);
    await waitFor(() => expect(screen.getByText('PostgreSQL connected')).toBeTruthy());
  });

  it('says the database is not reachable when the request fails', async () => {
    answers.set('/admin/db-stats', new Error('down'));
    render(<DatabasePage />);
    await waitFor(() => expect(screen.getByText('Database not reachable')).toBeTruthy());
    expect(screen.getByText('Could not load database stats.')).toBeTruthy();
  });
});

describe('System > Branding colours', () => {
  const colourInputs = (c: HTMLElement) => [...c.querySelectorAll('input[type=color]')] as HTMLInputElement[];

  it('shows the park navy and red in place of old saved defaults, and asks for a save', async () => {
    answers.set('/branding', { appName: 'Kynren', tagline: 'x', primary: '#8a1f31', accent: '#e2862b', font: 'system' });
    const { container } = render(<BrandingPage />);
    await waitFor(() => expect(screen.getByText(/old defaults/)).toBeTruthy());
    const [primary, accent] = colourInputs(container);
    expect(primary.value).toBe('#1b2b4b');
    expect(accent.value).toBe('#db0833');
  });

  it('leaves colours somebody chose alone and shows no notice', async () => {
    answers.set('/branding', { appName: 'Kynren', tagline: 'x', primary: '#123456', accent: '#abcdef', font: 'system' });
    const { container } = render(<BrandingPage />);
    await waitFor(() => expect(colourInputs(container)[0].value).toBe('#123456'));
    expect(colourInputs(container)[1].value).toBe('#abcdef');
    expect(screen.queryByText(/old defaults/)).toBeNull();
  });
});

describe('pages open on today, not on the old opening day', () => {
  const today = () => todayUk();
  const dateBox = (c: HTMLElement) => c.querySelector('input[type=date]') as HTMLInputElement;

  it('Dashboard asks for today', async () => {
    answers.set('/admin/analytics', { kpis: {}, sessionStatus: {}, popularAttractions: [] });
    render(<DashboardPage />);
    await waitFor(() => expect(asked).toContain(`/schedule?date=${today()}`));
    expect(asked).toContain(`/admin/analytics?date=${today()}`);
    expect(asked.some((p) => p.includes('2026-07-18'))).toBe(false);
  });

  it('Live Schedule starts on today', async () => {
    const { container } = render(<SchedulePage />);
    await waitFor(() => expect(dateBox(container).value).toBe(today()));
    await waitFor(() => expect(asked).toContain(`/schedule?date=${today()}`));
  });

  it('Shows starts on today', async () => {
    const { container } = render(<ShowsPage />);
    await waitFor(() => expect(dateBox(container).value).toBe(today()));
  });

  it('Analytics starts on today', async () => {
    answers.set('/admin/analytics', { kpis: {}, sessionStatus: {}, popularAttractions: [], topEngaged: [] });
    const { container } = render(<AnalyticsPage />);
    await waitFor(() => expect(dateBox(container).value).toBe(today()));
  });
});

describe('Attractions list', () => {
  it('says so when there are none', async () => {
    render(<AttractionsPage />);
    await waitFor(() => expect(screen.getByText('No attractions yet.')).toBeTruthy());
  });

  it('lists attractions with their status', async () => {
    answers.set('/admin/attractions', [
      { id: 'a1', name: 'Birds of Prey', slug: 'b', category: 'BIRDS', tagline: null, synopsis: '', durationMins: 30, heroImage: null, images: [], wheelchairAccessible: true, hasAudioDescription: false, hasCaptioning: false, hasBSL: false, sensoryNotes: null, sortOrder: 0, active: true, poiId: null },
      { id: 'a2', name: 'Maze', slug: 'm', category: 'MAZE', tagline: null, synopsis: '', durationMins: 20, heroImage: null, images: [], wheelchairAccessible: true, hasAudioDescription: false, hasCaptioning: false, hasBSL: false, sensoryNotes: null, sortOrder: 1, active: false, poiId: null },
    ]);
    render(<AttractionsPage />);
    await waitFor(() => expect(screen.getByText('Birds of Prey')).toBeTruthy());
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Hidden')).toBeTruthy();
  });
});

describe('Shop page unsaved-changes bar', () => {
  const shop = {
    id: 's1', name: 'Gift Shop', slug: 'gift', category: 'Gifts', description: 'Souvenirs', openingHours: '10:00-18:00',
    heroImage: null, images: [], active: true, poiId: null,
    items: [{ id: 'i1', name: 'Knight plush', description: null, priceCents: 1499, image: null, variants: null, available: false, sortOrder: 0 }],
  };

  it('stays hidden until something is edited, then offers Save and Discard', async () => {
    answers.set('/admin/shops/s1', shop);
    const { container } = render(<ShopDetail />);
    await waitFor(() => expect(screen.getByText('Gift Shop')).toBeTruthy());
    expect(container.querySelector('.savebar')).toBeNull();
    const name = [...container.querySelectorAll('.form-row')].find((r) => r.querySelector('label')?.textContent?.startsWith('Name'))!.querySelector('input')!;
    fireEvent.change(name, { target: { value: 'Gift Shop and Sweets' } });
    expect(screen.getByText(/unsaved changes/)).toBeTruthy();
    // putting it back removes the bar again
    fireEvent.change(name, { target: { value: 'Gift Shop' } });
    expect(container.querySelector('.savebar')).toBeNull();
  });

  it('Discard puts the saved values back', async () => {
    answers.set('/admin/shops/s1', shop);
    const { container } = render(<ShopDetail />);
    await waitFor(() => expect(screen.getByText('Gift Shop')).toBeTruthy());
    const name = [...container.querySelectorAll('.form-row')].find((r) => r.querySelector('label')?.textContent?.startsWith('Name'))!.querySelector('input')!;
    fireEvent.change(name, { target: { value: 'Something else' } });
    fireEvent.click(screen.getByText('Discard'));
    await waitFor(() => expect((container.querySelector('.form-row input') as HTMLInputElement | null)).toBeTruthy());
    await waitFor(() => expect(container.querySelector('.savebar')).toBeNull());
  });

  it('shows products with their price and marks unavailable ones', async () => {
    answers.set('/admin/shops/s1', shop);
    render(<ShopDetail />);
    await waitFor(() => expect(screen.getByText('Knight plush')).toBeTruthy());
    expect(screen.getByText('£14.99')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
  });
});
