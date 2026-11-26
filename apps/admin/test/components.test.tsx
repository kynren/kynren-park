import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

let allowed: string[] = [];
vi.mock('../lib/perms', () => ({
  usePerms: () => ({ role: 'OPS', perms: {}, can: (p: string) => allowed.includes(p) }),
}));

const apiMock = vi.fn();
vi.mock('../lib/api', () => ({
  api: (...a: unknown[]) => apiMock(...a),
  getStaff: () => ({ id: '1', name: 'Seth Boampong', email: 's@k.com', role: 'ADMIN' }),
}));

import { CommandPalette } from '../components/CommandPalette';
import { SaveBar } from '../components/SaveBar';
import { ImageField } from '../components/ImageField';
import { NotificationsMenu } from '../components/NotificationsMenu';
import { TopHeader } from '../components/TopHeader';

beforeEach(() => { push.mockReset(); apiMock.mockReset(); allowed = []; });

describe('CommandPalette', () => {
  it('only offers pages the signed-in person may open', () => {
    allowed = ['schedule'];
    render(<CommandPalette open onClose={() => undefined} />);
    expect(screen.getByText('Live Schedule')).toBeTruthy();
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.queryByText('Staff')).toBeNull();
    expect(screen.queryByText('Kitchen')).toBeNull();
  });

  it('filters as you type, including by keyword', () => {
    allowed = ['content'];
    render(<CommandPalette open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'walkways' } });
    expect(screen.getByText('Map & Hotspots')).toBeTruthy();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('says so when nothing matches', () => {
    render(<CommandPalette open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzzz' } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('opens the chosen page with Enter and closes', () => {
    allowed = ['content'];
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} />);
    const box = screen.getByLabelText('Search');
    fireEvent.change(box, { target: { value: 'map' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/app-settings/map');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves with the arrow keys and closes on Escape', () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} />);
    const box = screen.getByLabelText('Search');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(push).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    const { container } = render(<CommandPalette open={false} onClose={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('SaveBar', () => {
  it('stays out of the way until something changes', () => {
    const { container } = render(<SaveBar dirty={false} saving={false} onSave={() => undefined} onDiscard={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('offers Save and Discard once there are unsaved changes', () => {
    const onSave = vi.fn(), onDiscard = vi.fn();
    render(<SaveBar dirty saving={false} onSave={onSave} onDiscard={onDiscard} />);
    expect(screen.getByText(/unsaved changes/)).toBeTruthy();
    fireEvent.click(screen.getByText('Save changes'));
    fireEvent.click(screen.getByText('Discard'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while saving', () => {
    render(<SaveBar dirty saving onSave={() => undefined} onDiscard={() => undefined} />);
    expect((screen.getByText('Saving…') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText('Discard') as HTMLButtonElement).disabled).toBe(true);
  });

  it('confirms briefly after a save', () => {
    render(<SaveBar dirty={false} saved saving={false} onSave={() => undefined} onDiscard={() => undefined} />);
    expect(screen.getByText(/All changes saved/)).toBeTruthy();
  });

  it('warns before the tab is closed with unsaved work, and only then', () => {
    const { rerender } = render(<SaveBar dirty saving={false} onSave={() => undefined} onDiscard={() => undefined} />);
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
    rerender(<SaveBar dirty={false} saving={false} onSave={() => undefined} onDiscard={() => undefined} />);
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});

describe('ImageField', () => {
  const pick = (container: HTMLElement, file: File) => {
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
  };

  it('shows the picture and offers Replace and Remove', () => {
    const onChange = vi.fn();
    render(<ImageField value="data:image/png;base64,AAA" onChange={onChange} />);
    expect(screen.getByText('Replace')).toBeTruthy();
    fireEvent.click(screen.getByText('Remove'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('says there is no image and offers only Upload when empty', () => {
    render(<ImageField value={null} onChange={() => undefined} />);
    expect(screen.getByText('No image')).toBeTruthy();
    expect(screen.getByText('Upload')).toBeTruthy();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('hands back whatever the reader makes of the chosen file', async () => {
    const onChange = vi.fn();
    const read = vi.fn().mockResolvedValue('data:image/gif;base64,GIF');
    const { container } = render(<ImageField value="" onChange={onChange} read={read} />);
    pick(container, new File(['x'], 'a.gif', { type: 'image/gif' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('data:image/gif;base64,GIF'));
  });

  it('refuses a picture over the size limit', async () => {
    const onChange = vi.fn(), onError = vi.fn();
    const { container } = render(<ImageField value="" onChange={onChange} onError={onError} maxMb={1} read={async () => 'x'} />);
    pick(container, new File([new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('That picture is over 1 MB.'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reports a file that cannot be read', async () => {
    const onError = vi.fn();
    const { container } = render(<ImageField value="" onChange={() => undefined} onError={onError} read={async () => { throw new Error('bad'); }} />);
    pick(container, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Could not read that picture.'));
  });
});

describe('NotificationsMenu', () => {
  const soon = new Date(Date.now() + 3_600_000).toISOString();
  const earlier = new Date(Date.now() - 3_600_000).toISOString();
  const list = [
    { id: '1', title: 'Gates open at 10', scheduledAt: soon, sentAt: null, endAt: null },
    { id: '2', title: 'Show delayed', scheduledAt: null, sentAt: earlier, endAt: null },
    { id: '3', title: 'Old notice', scheduledAt: null, sentAt: earlier, endAt: new Date(Date.now() - 1000).toISOString() },
  ];

  it('is not shown to staff who cannot send announcements', () => {
    allowed = [];
    const { container } = render(<NotificationsMenu />);
    expect(container.innerHTML).toBe('');
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('counts what is waiting to go out', async () => {
    allowed = ['announce'];
    apiMock.mockResolvedValue(list);
    render(<NotificationsMenu />);
    await waitFor(() => expect(screen.getByLabelText('Announcements: 1 waiting')).toBeTruthy());
  });

  it('lists waiting and recent announcements, leaving out expired ones', async () => {
    allowed = ['announce'];
    apiMock.mockResolvedValue(list);
    render(<NotificationsMenu />);
    await waitFor(() => screen.getByLabelText('Announcements: 1 waiting'));
    fireEvent.click(screen.getByLabelText('Announcements: 1 waiting'));
    await waitFor(() => expect(screen.getByText('Gates open at 10')).toBeTruthy());
    expect(screen.getByText('Show delayed')).toBeTruthy();
    expect(screen.queryByText('Old notice')).toBeNull();
    expect(screen.getByText(/^Scheduled/)).toBeTruthy();
  });

  it('copes with the server being unreachable', async () => {
    allowed = ['announce'];
    apiMock.mockRejectedValue(new Error('down'));
    render(<NotificationsMenu />);
    fireEvent.click(screen.getByLabelText('Announcements'));
    await waitFor(() => expect(screen.getByText(/Nothing waiting/)).toBeTruthy());
  });
});

describe('TopHeader', () => {
  it('switches to dark mode, remembers it, and switches back', async () => {
    allowed = [];
    render(<TopHeader onMenu={() => undefined} onSearch={() => undefined} />);
    fireEvent.click(await screen.findByLabelText('Switch to dark mode'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('kynren_admin_theme')).toBe('dark');
    fireEvent.click(screen.getByLabelText('Switch to light mode'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('kynren_admin_theme')).toBe('light');
  });

  it('greets the person by first name and opens search and the menu', async () => {
    allowed = [];
    const onSearch = vi.fn(), onMenu = vi.fn();
    render(<TopHeader onMenu={onMenu} onSearch={onSearch} />);
    await waitFor(() => expect(screen.getByText(/Seth/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Search the console'));
    fireEvent.click(screen.getByLabelText('Open menu'));
    expect(onSearch).toHaveBeenCalled();
    expect(onMenu).toHaveBeenCalled();
  });
});
