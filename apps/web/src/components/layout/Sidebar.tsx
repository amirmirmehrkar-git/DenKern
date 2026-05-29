'use client';

/**
 * Sidebar — collapsible left navigation.
 *
 * Shows: logo, primary nav (Dashboard, Alerts), active cases list.
 * Clicking a case navigates to the correct route for its current state.
 *
 * Source: docs/architecture/08-page-flow-map.md §9.3
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { WorkflowState } from '@denkkern/types';
import { StatusBadge } from '../ui/StatusBadge.js';
import { resolveRouteForState } from '../../lib/workflow/state-order.js';

interface ActiveCase {
  case_id: string;
  shipment_id: string;
  state: WorkflowState;
  label: string;
}

interface SidebarProps {
  activeCases?: ActiveCase[];
}

export function Sidebar({ activeCases = [] }: SidebarProps) {
  const pathname = usePathname();

  function navClass(href: string) {
    return `sidebar-nav-item${pathname === href || pathname.startsWith(href + '/') ? ' active' : ''}`;
  }

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">DenkKern</div>

      <div className="sidebar-section-label">Navigation</div>
      <div className="sidebar-nav">
        <Link href="/dashboard" className={navClass('/dashboard')}>
          <span>⬡</span> Dashboard
        </Link>
        <Link href="/alerts" className={navClass('/alerts')}>
          <span>◎</span> Alerts
        </Link>
      </div>

      {activeCases.length > 0 && (
        <>
          <div className="sidebar-section-label">Active cases</div>
          <div className="sidebar-nav">
            {activeCases.slice(0, 5).map((c) => {
              const href = resolveRouteForState(c.state, {
                caseId: c.case_id,
                shipmentId: c.shipment_id,
              });
              return (
                <Link key={c.case_id} href={href} className={navClass(`/shipments/${c.shipment_id}`)}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.case_id}</span>
                  <span className="sidebar-case-badge" style={{ marginLeft: 'auto' }}>
                    <StatusBadge status={c.state} size="sm" />
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </nav>
  );
}
