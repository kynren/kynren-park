import type { ReactNode } from 'react';
import { SystemTabs } from '../../../components/SystemTabs';

export default function SystemLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="sys-head">
        <h1>System Administration</h1>
        <p className="subtitle">Super-admin console for the whole platform.</p>
        <SystemTabs />
      </div>
      {children}
    </div>
  );
}
