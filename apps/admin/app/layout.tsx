import './globals.css';
import type { ReactNode } from 'react';
import { FaviconManager } from '../components/FaviconManager';

export const metadata = {
  title: 'Kynren Park — Staff Dashboard',
  description: 'Operations dashboard for Kynren – The Storied Lands.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#101b33' },
    { media: '(prefers-color-scheme: dark)', color: '#080e1c' },
  ],
};

// Applies the saved light/dark choice before the first paint so the page never flashes the wrong theme.
const THEME_INIT = `try{var t=localStorage.getItem('kynren_admin_theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <FaviconManager />
        {children}
      </body>
    </html>
  );
}
