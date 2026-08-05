'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getStaff } from '../lib/api';

const links = [
  { href: '/schedule', label: 'Live Schedule' },
  { href: '/kitchen', label: 'Kitchen' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/analytics', label: 'Analytics' },
];

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const staff = getStaff();

  return (
    <div className="topbar">
      <div className="brand">◈ Kynren Ops</div>
      <nav>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span className="who">{staff ? `${staff.name} · ${staff.role}` : ''}</span>
        <button
          onClick={() => {
            clearSession();
            router.replace('/login');
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
