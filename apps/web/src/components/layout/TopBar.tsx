'use client';

/**
 * TopBar — persistent navigation bar across all authenticated routes.
 *
 * Shows: product name, active case indicator (if on a case route), user name.
 * Source: docs/architecture/08-page-flow-map.md §9.2
 */

import { StatusBadge } from '../ui/StatusBadge.js';
import type { WorkflowState } from '@denkkern/types';

interface TopBarProps {
  activeCaseId?: string;
  activeState?: WorkflowState | null;
}

export function TopBar({ activeCaseId, activeState }: TopBarProps) {
  return (
    <header className="topbar">
      <span className="topbar-title">DenkKern</span>

      {activeCaseId !== undefined && activeState != null && (
        <div className="topbar-case-indicator">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{activeCaseId}</span>
          <StatusBadge status={activeState} size="sm" />
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div className="topbar-user">
        <div className="avatar">L</div>
        <span>Lena</span>
      </div>
    </header>
  );
}
