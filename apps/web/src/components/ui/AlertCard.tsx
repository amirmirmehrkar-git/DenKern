'use client';

/**
 * AlertCard — scannable card for a single AlertEvent.
 *
 * On click:
 *   1. If `alert_opened` is in availableActions → POST the event to the API
 *   2. Navigate to /shipments/:shipmentId
 *
 * Architecture rule: the button is only active when `alert_opened` is in
 * availableActions. The component does not derive enablement from WorkflowState.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AlertEvent, WorkflowEvent } from '@denkkern/types';

interface AlertCardProps {
  alert: AlertEvent;
  availableActions: WorkflowEvent[];
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityLabel(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function AlertCard({ alert, availableActions }: AlertCardProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const canOpen = availableActions.includes('alert_opened');

  async function handleClick() {
    if (isPending) return;
    setIsPending(true);

    if (canOpen) {
      await fetch(`/api/cases/${alert.case_id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'alert_opened',
          emitted_by: 'lena',
          emitted_at: new Date().toISOString(),
        }),
      });
    }

    router.push(`/shipments/${alert.shipment_id}`);
  }

  return (
    <button
      className={`alert-card severity-${alert.severity}`}
      onClick={() => { void handleClick(); }}
      disabled={isPending}
      style={{ display: 'flex', width: '100%', cursor: 'pointer', background: 'none', textAlign: 'left' }}
    >
      <div className="alert-card-body">
        <div className="alert-card-title">
          {alert.shipment_id} — Shipment delay alert
        </div>
        <div className="alert-card-summary">{alert.summary}</div>
        <div className="alert-card-stats">
          <span className="alert-stat">
            <strong>Delay risk</strong> {Math.round(alert.p_delay_over_3_days * 100)}% (3+ days)
          </span>
          <span className="alert-stat">
            <strong>Expected delay</strong> {alert.expected_delay_days}d
          </span>
          <span className="alert-stat">
            <strong>Confidence</strong> {Math.round(alert.confidence_score * 100)}%
          </span>
        </div>
      </div>
      <div className="alert-card-meta">
        <span className="alert-time">{formatRelativeTime(alert.triggered_at)}</span>
        <span
          className={`badge badge-${alert.severity === 'HIGH' ? 'critical' : alert.severity === 'MEDIUM' ? 'warning' : 'info'}`}
        >
          <span className="badge-dot" />
          {severityLabel(alert.severity)}
        </span>
        <span className="alert-chevron">›</span>
      </div>
    </button>
  );
}
