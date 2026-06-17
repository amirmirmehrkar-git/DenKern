'use client';

/**
 * Sidebar — DenkKern demo navigation.
 *
 * DK-812 Phase 1: Figma Make alignment.
 *   - 9 active nav items matching Figma AppLayout.tsx
 *   - Teal left-border active state (var(--sidebar-primary))
 *   - Lena Schmidt user footer
 *   - Legacy system section removed
 *
 * Icons: inline SVG (functionally equivalent to lucide-react).
 * When lucide-react is installed via pnpm, imports can be swapped in.
 *
 * Source: reference/figma-make-v1/src/app/components/AppLayout.tsx
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ── Inline SVG icons ─────────────────────────────────────────────────────
   Sized 16×16, stroke-based, matching lucide-react style.
   ──────────────────────────────────────────────────────────────────────── */

function IconLayoutDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconShip() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 21c.6.5 1.2 1 2.5 1C7 22 7 20 9.5 20c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.61 7.76" />
      <path d="M19 13V7a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v6" />
      <path d="M12 3v4" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function IconGitFork() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
      <path d="M12 12v3" />
    </svg>
  );
}

function IconCheckSquare() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  );
}

function IconSlidersHorizontal() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8"  y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8"  y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/* ── Nav item definitions ─────────────────────────────────────────────────
   Items 3–7 link to /demo as placeholder until those routes are built.
   Matches Figma AppLayout.tsx nav order exactly.
   ──────────────────────────────────────────────────────────────────────── */

const OPERATIONS_NAV = [
  { label: 'Mission Control', href: '/demo',                    exact: true,  Icon: IconLayoutDashboard },
  { label: 'Shipments',       href: '/demo/shipments',          exact: false, Icon: IconShip             },
  { label: 'Alerts',          href: '/demo/alerts',             exact: false, Icon: IconBell             },
  { label: 'Decisions',       href: '/demo/decisions',          exact: false, Icon: IconGitFork          },
  { label: 'Approvals',       href: '/demo/approvals',          exact: false, Icon: IconCheckSquare      },
  { label: 'Execution',       href: '/demo/execution',          exact: false, Icon: IconZap              },
  { label: 'Outcomes',        href: '/demo/outcomes',           exact: false, Icon: IconBarChart         },
] as const;

const ORGANISATION_NAV = [
  { label: 'Decision Model',  href: '/demo/decision-model',     exact: false, Icon: IconSlidersHorizontal },
  { label: 'Settings',        href: '/demo/settings',           exact: false, Icon: IconSettings          },
] as const;

/* ── Sidebar component ────────────────────────────────────────────────────  */

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    return exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/');
  }

  function navItemStyle(active: boolean): Record<string, string> {
    if (!active) return {};
    return {
      borderLeft: '2px solid var(--sidebar-primary)',
      paddingLeft: '8px',
      background: 'var(--sidebar-accent)',
      color: 'var(--sidebar-text-active)',
    };
  }

  return (
    <nav className="sidebar" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="sidebar-logo">DenkKern</div>

      {/* ── Operations group ──────────────────────────────────────── */}
      <div className="sidebar-section-label">Operations</div>
      <div className="sidebar-nav">
        {OPERATIONS_NAV.map(({ label, href, exact, Icon }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-nav-item${active ? ' active' : ''}`}
              style={navItemStyle(active)}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </div>

      {/* ── Organisation group ────────────────────────────────────── */}
      <div className="sidebar-section-label" style={{ marginTop: 16 }}>Organisation</div>
      <div className="sidebar-nav">
        {ORGANISATION_NAV.map(({ label, href, exact, Icon }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`sidebar-nav-item${active ? ' active' : ''}`}
              style={navItemStyle(active)}
            >
              <Icon />
              {label}
            </Link>
          );
        })}
      </div>

      {/* ── User footer — Lena Schmidt ────────────────────────────── */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-avatar">LS</div>
        <div>
          <div className="sidebar-footer-name">Lena Schmidt</div>
          <div className="sidebar-footer-role">Operations Manager</div>
        </div>
      </div>

    </nav>
  );
}
