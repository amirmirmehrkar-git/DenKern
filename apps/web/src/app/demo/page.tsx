'use client';

/**
 * MissionControlPage — /demo
 *
 * Lena Action Queue: 4-panel command center.
 * Sprint 9A — Demo UI Bridge.
 *
 * Data source: GET /api/demo/mission-control
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Types — derived from /api/demo/mission-control response shape
// ---------------------------------------------------------------------------

interface ActionQueueItem {
  item_id: string;
  shipment_id: string;
  material: string;
  route: string;
  recommended_action: string;
  confidence_pct: number;
  net_saving_eur: number;
  urgency: string;
  days_until_production_stop: number;
  cta: string;
  cta_route: string;
  approval_note: string;
}

interface MissionControlData {
  schema_version: string;
  generated_at: string;
  monitored_shipments: number;
  requires_attention: number;
  lena_action_queue: {
    decision_required: ActionQueueItem[];
    approval_needed: ActionQueueItem[];
    execution_tracking: ActionQueueItem[];
  };
  metrics: {
    decision_required: number;
    approval_needed: number;
    execution_tracking: number;
    total_financial_exposure_eur: number;
    net_saving_available_eur: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const bg =
    urgency === 'CRITICAL' ? 'var(--critical)' :
    urgency === 'HIGH'     ? '#f97316' :
    'var(--warning)';
  return (
    <span style={{
      fontSize: 11,
      padding: '2px 8px',
      background: bg,
      color: 'white',
      borderRadius: 4,
      fontWeight: 700,
      letterSpacing: '0.03em',
    }}>
      {urgency}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Decision Required row
// ---------------------------------------------------------------------------

function DecisionRow({ item }: { item: ActionQueueItem }) {
  return (
    <div style={{
      padding: '20px 24px',
      borderBottom: '1px solid var(--border)',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 20,
      alignItems: 'center',
    }}>
      <div>
        {/* Row header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.material}</span>
          <UrgencyBadge urgency={item.urgency} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {item.shipment_id}
          </span>
        </div>

        {/* Route + recommendation */}
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
          <strong>Route:</strong> {item.route}&nbsp;·&nbsp;
          <strong>Lena recommends:</strong> {item.recommended_action}
        </p>

        {/* Key metrics */}
        <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#22c55e', fontWeight: 600 }}>
            Net saving: {formatEur(item.net_saving_eur)}
          </span>
          <span style={{ color: 'var(--critical)', fontWeight: 500 }}>
            ⏱ {item.days_until_production_stop}d to production stop
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Confidence: {item.confidence_pct}%
          </span>
        </div>

        {/* Approval note */}
        {item.approval_note && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {item.approval_note}
          </p>
        )}
      </div>

      {/* CTA */}
      <Link href={item.cta_route} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
        {item.cta} →
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty panel
// ---------------------------------------------------------------------------

function EmptyQueue({ label }: { label: string }) {
  return (
    <div style={{ padding: '28px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      ✓ No {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MissionControlPage() {
  const [data, setData] = useState<MissionControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/demo/mission-control')
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MissionControlData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading Mission Control…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load Mission Control</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { lena_action_queue, metrics } = data;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Mission Control</h1>
          <p className="page-subtitle">
            Lena Action Queue · {data.monitored_shipments} shipment{data.monitored_shipments !== 1 ? 's' : ''} monitored ·{' '}
            <span style={{ color: 'var(--critical)', fontWeight: 600 }}>
              {data.requires_attention} requires attention
            </span>
          </p>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 4 }}>
          {new Date(data.generated_at).toLocaleString('de-DE')}
        </span>
      </div>

      {/* KPI bar — 5 tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {([
          { label: 'Decision required',   value: String(metrics.decision_required),                    accent: 'var(--critical)' },
          { label: 'Approval needed',     value: String(metrics.approval_needed),                      accent: 'var(--warning)' },
          { label: 'Execution tracking',  value: String(metrics.execution_tracking),                   accent: 'var(--text-secondary)' },
          { label: 'Financial exposure',  value: formatEur(metrics.total_financial_exposure_eur),      accent: 'var(--critical)' },
          { label: 'Net saving available',value: formatEur(metrics.net_saving_available_eur),          accent: '#22c55e' },
        ] as const).map(({ label, value, accent }) => (
          <div key={label} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Panel 1 — Decision required */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Decision required</span>
          <span style={{ fontSize: 12, color: metrics.decision_required > 0 ? 'var(--critical)' : 'var(--text-muted)', fontWeight: 600 }}>
            {metrics.decision_required} item{metrics.decision_required !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {lena_action_queue.decision_required.length === 0
            ? <EmptyQueue label="decisions pending" />
            : lena_action_queue.decision_required.map((item) => <DecisionRow key={item.item_id} item={item} />)
          }
        </div>
      </div>

      {/* Panel 2 — Approval needed */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Approval needed</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{metrics.approval_needed} items</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {lena_action_queue.approval_needed.length === 0
            ? <EmptyQueue label="approvals pending" />
            : lena_action_queue.approval_needed.map((item) => <DecisionRow key={item.item_id} item={item} />)
          }
        </div>
      </div>

      {/* Panel 3 — Execution tracking */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Execution tracking</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{metrics.execution_tracking} items</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {lena_action_queue.execution_tracking.length === 0
            ? <EmptyQueue label="items in execution" />
            : lena_action_queue.execution_tracking.map((item) => <DecisionRow key={item.item_id} item={item} />)
          }
        </div>
      </div>

      {/* Panel 4 — Shortcut to shipment portfolio */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Shipment portfolio</span>
          <Link href="/demo/shipments" style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {data.monitored_shipments} shipment{data.monitored_shipments !== 1 ? 's' : ''} currently monitored by Lena.
          </p>
          <Link href="/demo/shipments" className="btn btn-secondary">
            Open portfolio →
          </Link>
        </div>
      </div>
    </>
  );
}
