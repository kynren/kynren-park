'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getStaff } from '../lib/api';
import { NotificationsMenu } from './NotificationsMenu';

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const THEME_KEY = 'kynren_admin_theme';

function currentlyDark(): boolean {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function TopHeader({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const router = useRouter();
  const [dark, setDark] = useState(false);
  const [mac, setMac] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    setDark(currentlyDark());
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    setName(getStaff()?.name ?? '');
  }, []);

  const first = name.split(' ')[0] || 'there';
  const initials = (name || 'K').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: the choice just lasts this visit */ }
    setDark(!dark);
  };

  return (
    <div className="topheader">
      <div className="topheader-left">
        <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <div className="greeting">
          {greetingWord()}, {first}
          <small>{today}</small>
        </div>
      </div>
      <div className="head-right">
        <button className="search" onClick={onSearch} aria-label="Search the console">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
          </svg>
          <span>Jump to a page…</span>
          <span className="kbd">{mac ? '⌘' : 'Ctrl'} K</span>
        </button>
        <button className="icon-btn" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
          {dark ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          )}
        </button>
        <NotificationsMenu />
        <button className="avatar" onClick={() => router.push('/settings')} aria-label="My settings" title={name || 'My settings'}>{initials}</button>
      </div>
    </div>
  );
}
