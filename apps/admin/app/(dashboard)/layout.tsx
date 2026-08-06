'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '../../lib/api';
import { Sidebar } from '../../components/Sidebar';
import { TopHeader } from '../../components/TopHeader';
import { ConfirmHost } from '../../lib/confirm';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
    else setReady(true);
  }, [router]);

  if (!ready) return null;
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <TopHeader />
        <div className="main-scroll">{children}</div>
      </main>
      <ConfirmHost />
    </div>
  );
}
