'use client';

import { useRouter } from 'next/navigation';
import { getStaff } from '../lib/api';

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
}

export function TopHeader() {
  const router = useRouter();
  const staff = getStaff();
  const first = staff?.name?.split(' ')[0] ?? 'there';
  const initials = (staff?.name ?? 'K')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="topheader">
      <div className="greeting">{greetingWord()}, {first}! 👋</div>
      <div className="head-right">
        <div className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
          </svg>
          <input placeholder="Search shows, orders or guests…" />
        </div>
        <button className="icon-btn" onClick={() => router.push('/announcements')} aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          <span className="ping" />
        </button>
        <button className="avatar" onClick={() => router.push('/analytics')} aria-label="Profile">{initials}</button>
      </div>
    </div>
  );
}
