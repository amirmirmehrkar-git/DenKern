/**
 * Root layout — DenkKern
 *
 * Shell: Sidebar (left, 220px) + TopBar (top, 56px) + scrollable main area.
 * Applies globals.css. Sidebar receives live case list from the dashboard API.
 *
 * The layout is a Server Component. Interactive sub-components (Sidebar, TopBar)
 * are Client Components imported here.
 */

import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '../components/layout/Sidebar.js';
import { TopBar } from '../components/layout/TopBar.js';

export const metadata: Metadata = {
  title: 'DenkKern',
  description: 'Operational disruption intelligence — Lena 2.0',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidebar />
          <div className="main-area">
            <TopBar />
            <main className="page-content">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
