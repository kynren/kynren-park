import './globals.css';
import type { ReactNode } from 'react';
import { FaviconManager } from '../components/FaviconManager';

export const metadata = {
  title: 'Kynren Park — Staff Dashboard',
  description: 'Operations dashboard for Kynren – The Storied Lands.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <FaviconManager />
        {children}
      </body>
    </html>
  );
}
