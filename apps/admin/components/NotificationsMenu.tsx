'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '../lib/api';
import { usePerms } from '../lib/perms';

interface Announcement { id: string; title: string; scheduledAt: string | null; sentAt: string | null; endAt: string | null }

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** The header bell: what is waiting to go out to guests and what went out last. Needs the "announce" permission. */
export function NotificationsMenu() {
  const { can } = usePerms();
  const allowed = can('announce');
  const [list, setList] = useState<Announcement[] | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!allowed) return;
    api<Announcement[]>('/announcements/manage').then(setList).catch(() => setList([]));
  }, [allowed, open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const { waiting, recent } = useMemo(() => {
    const now = Date.now();
    const all = list ?? [];
    const waiting = all
      .filter((a) => !a.sentAt)
      .sort((a, b) => (a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0) - (b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0));
    const recent = all
      .filter((a) => a.sentAt && !(a.endAt && new Date(a.endAt).getTime() < now))
      .sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime())
      .slice(0, 4);
    return { waiting: waiting.slice(0, 5), recent };
  }, [list]);

  if (!allowed) return null;
  const count = (list ?? []).filter((a) => !a.sentAt).length;

  return (
    <div className="notif" ref={box}>
      <button className="icon-btn hide-sm" onClick={() => setOpen((o) => !o)} aria-label={count ? `Announcements: ${count} waiting` : 'Announcements'} aria-expanded={open} title="Announcements">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {count > 0 && <span className="notif-count">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="notif-pop" role="dialog" aria-label="Announcements">
          <div className="notif-head">Announcements</div>
          {list === null && <div className="notif-empty">Loading…</div>}
          {list !== null && waiting.length === 0 && recent.length === 0 && <div className="notif-empty">Nothing waiting and nothing sent recently.</div>}
          {waiting.length > 0 && <div className="notif-group">Waiting to go out</div>}
          {waiting.map((a) => (
            <Link key={a.id} href="/announcements" className="notif-item" onClick={() => setOpen(false)}>
              <b>{a.title}</b>
              <small>{a.scheduledAt && new Date(a.scheduledAt).getTime() > Date.now() ? `Scheduled · ${when(a.scheduledAt)}` : 'Pending'}</small>
            </Link>
          ))}
          {recent.length > 0 && <div className="notif-group">Sent recently</div>}
          {recent.map((a) => (
            <Link key={a.id} href="/announcements" className="notif-item" onClick={() => setOpen(false)}>
              <b>{a.title}</b>
              <small>Sent · {when(a.sentAt!)}</small>
            </Link>
          ))}
          <Link href="/announcements" className="notif-foot" onClick={() => setOpen(false)}>Open announcements</Link>
        </div>
      )}
    </div>
  );
}
