'use client';

/**
 * TopBar — persistent navigation bar.
 *
 * DK-812 Phase 1: When on /demo/* routes, shows the Figma-aligned
 * demo shell:
 *   - Breadcrumb (left)
 *   - Live pulse indicator (centre-left)
 *   - "3 Active Alerts" badge (centre-right)
 *   - Timestamp (right)
 *   - Lena Schmidt avatar (far right)
 *
 * On non-demo routes, shows the original minimal topbar.
 *
 * Source: reference/figma-make-v1/src/app/components/AppLayout.tsx
 */

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

/* ── Breadcrumb derivation ────────────────────────────────────────────── */

const SEGMENT_LABELS: Record<string, string> = {
  demo:                'Mission Control',
  shipments:           'Shipments',
  'scenario-analysis': 'Scenario Analysis',
  'decision-room':     'Decision Room',
  approval:            'Approval',
  'execution-validation': 'Execution Validation',
  outcome:             'Outcome Review',
  'decision-model':    'Decision Model',
  alerts:              'Alerts',
  decisions:           'Decisions',
  approvals:           'Approvals',
  execution:           'Execution',
  outcomes:            'Outcomes',
  settings:            'Settings',
};

function useBreadcrumb(pathname: string): { label: string; full: string } {
  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    // Find the last known label segment, skip dynamic [id] segments
    const labelSegments = segments
      .map((s) => {
        // Dynamic segment (shipment IDs start with SH- or look like IDs)
        if (s.startsWith('SH-') || /^[A-Z]{2}-\d/.test(s)) return null;
        return SEGMENT_LABELS[s] ?? null;
      })
      .filter(Boolean) as string[];

    if (labelSegments.length === 0) return { label: 'DenkKern', full: 'DenkKern' };
    if (labelSegments.length === 1) return { label: labelSegments[0], full: labelSegments[0] };

    // Compose breadcrumb: first + last meaningful segments
    const label = labelSegments[labelSegments.length - 1];
    const full = labelSegments.join(' / ');
    return { label, full };
  }, [pathname]);
}

/* ── Timestamp ────────────────────────────────────────────────────────── */

function useTimestamp() {
  return useMemo(() => {
    const now = new Date();
    return now.toLocaleTimeString('en-DE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Europe/Berlin',
    }) + ' CET';
  }, []); // Static per render — updates on navigation
}

/* ── TopBar component ─────────────────────────────────────────────────── */

export function TopBar() {
  const pathname = usePathname();
  const isDemo = pathname.startsWith('/demo');
  const { full: breadcrumb } = useBreadcrumb(pathname);
  const timestamp = useTimestamp();

  if (isDemo) {
    return (
      <header className="topbar">
        {/* Breadcrumb */}
        <div className="topbar-breadcrumb">
          {breadcrumb}
        </div>

        {/* Live indicator */}
        <div className="topbar-live">
          <span className="live-dot" />
          Live
        </div>

        {/* 3 Active Alerts */}
        <div className="topbar-alerts-btn" role="status" aria-label="3 active alerts">
          <span className="topbar-alerts-dot" />
          3 Active Alerts
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Timestamp */}
        <span className="topbar-timestamp">{timestamp}</span>

        {/* Lena avatar */}
        <div className="topbar-user">
          <div className="avatar" style={{ background: 'var(--accent)' }}>LS</div>
          <span>Lena Schmidt</span>
        </div>
      </header>
    );
  }

  /* Non-demo: original minimal topbar */
  return (
    <header className="topbar">
      <span className="topbar-title">DenkKern</span>
      <div style={{ flex: 1 }} />
      <div className="topbar-user">
        <div className="avatar">L</div>
        <span>Lena</span>
      </div>
    </header>
  );
}
