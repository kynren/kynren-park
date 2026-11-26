'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getToken } from '../../lib/api';
import { Sidebar } from '../../components/Sidebar';
import { TopHeader } from '../../components/TopHeader';
import { PageNav } from '../../components/PageNav';
import { CommandPalette } from '../../components/CommandPalette';
import { ConfirmHost } from '../../lib/confirm';
import { ToastHost } from '../../lib/toast';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  // The phone drawer closes whenever the page changes.
  useEffect(() => { setNavOpen(false); }, [pathname]);

  // Ctrl/Cmd+K opens the page search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) return null;
  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
      <Sidebar />
      <div className="nav-scrim" onClick={() => setNavOpen(false)} aria-hidden />
      <main className="main">
        <TopHeader onMenu={() => setNavOpen(true)} onSearch={() => setSearchOpen(true)} />
        <div className="main-scroll"><PageNav />{children}</div>
      </main>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}
