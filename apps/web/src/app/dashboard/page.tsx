'use client';

/**
 * MissionControlDashboard — /dashboard
 *
 * Operational overview screen. Shows active cases, alert feed,
 * key metrics, and recent workflow timeline.
 *
 * Data: fetched from /api/dashboard on mount; workflow state polled
 * via useWorkflowState for each case.
 *
 * Source: docs/architecture/07-component-map.md §A2
 *         docs/architecture/08-page-flow-map.md — Route: /dashboard
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DashboardSummary } from '../api/dashboard/route.js';
import { MetricCard } from '../../components/ui/MetricCard.js';
import { AlertCard } from '../../components/ui/AlertCard.js';
import { WorkflowTimeline } from '../../components/ui/WorkflowTimeline.js';
import { useWorkflowState } from '../../hooks/useWorkflowState.js';
import type { TimelineEvent } from '../../components/ui/WorkflowTimeline.js';

// ---------------------------------------------------------------------------
// Dashboard data fetching
// ---------------------------------------------------------------------------

function useDashboardData() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dashboard', { cache: 'no-store' })
      .then((r) => r.json() as Promise<DashboardSummary>)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}

// ---------------------------------------------------------------------------
// Case row — resolves live state via polling for workflow-aware navigation
// ---------------------------------------------------------------------------

function CaseRow({ caseId, shipmentId, shipmentName, destination }: {
  caseId: string;
  shipmentId: string;
  shipmentName: string;
  destination: string;
}) {
  const { state, availableActions } = useWorkflowState(caseId);

  const href = state != null
    ? (() => {
      switch (true) {
        case ['monitoring_active','disruption_detected','alert_generated'].includes(state): return `/dashboard`;
        case state === 'disruption_context_opened': return `/shipments/${shipmentId}`;
        case ['scenarios_generated','recommendation_ranked','decision_pending','decision_approved'].includes(state): return `/decision-room/${caseId}`;
        case ['execution_started','execution_monitoring'].includes(state): return `/execution/${caseId}`;
        case ['audit_logged','closed'].includes(state): return `/audit/${caseId}`;
        default: return `/dashboard`;
      }
    })()
    : `/dashboard`;

  void availableActions; // consumed by child components via hook

  return (
    <Link href={href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{shipmentName}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {caseId} · {destination}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {state != null && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {state.replace(/_/g, ' ')}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>›</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardData();

  // For timeline: build events from the single demo case if present
  const demoCase = data?.cases[0];

  // Poll the demo case state for the AlertCard available_actions
  const { availableActions: demoAvailableActions } = useWorkflowState(
    demoCase?.case_id ?? 'CASE-001'
  );

  // Build a minimal timeline from what we know
  const timelineEvents: TimelineEvent[] = demoCase != null
    ? [
      { state: 'monitoring_active', occurred_at: '2026-05-25T08:00:00Z' },
      { state: 'disruption_detected', occurred_at: '2026-05-25T08:28:00Z' },
      { state: 'alert_generated', occurred_at: '2026-05-25T08:31:00Z', actor: 'system' },
    ].filter(e => {
      // Only show states up to and including current
      const states = ['monitoring_active','disruption_detected','alert_generated','disruption_context_opened','scenarios_generated','recommendation_ranked','decision_pending','decision_approved','execution_started','execution_monitoring','audit_logged','closed'];
      const currentIdx = states.indexOf(demoCase.state);
      const evIdx = states.indexOf(e.state);
      return evIdx <= currentIdx;
    })
    : [];

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading dashboard…
      </div>
    );
  }

  if (error != null) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load dashboard</div>
        <p>{error}</p>
      </div>
    );
  }

  const metrics = data?.metrics ?? { active_cases: 0, open_alerts: 0, high_risk_shipments: 0, avg_delay_days: 0 };
  const cases = data?.cases ?? [];
  const alertCases = cases.filter(c => c.alert != null);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Mission Control</h1>
        <p className="page-subtitle">Operational overview — active disruption cases and alerts</p>
      </div>

      {/* Metric cards */}
      <div className="metric-grid">
        <MetricCard label="Active cases" value={metrics.active_cases} />
        <MetricCard
          label="Open alerts"
          value={metrics.open_alerts}
          severity={metrics.open_alerts > 0 ? 'critical' : 'normal'}
        />
        <MetricCard
          label="High-risk shipments"
          value={metrics.high_risk_shipments}
          severity={metrics.high_risk_shipments > 0 ? 'warning' : 'normal'}
        />
        <MetricCard
          label="Avg. expected delay"
          value={metrics.avg_delay_days}
          unit="days"
          severity={metrics.avg_delay_days > 3 ? 'warning' : 'normal'}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Alert feed */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Active alerts</span>
              {alertCases.length > 0 && (
                <span className="badge badge-critical">
                  <span className="badge-dot" />
                  {alertCases.length} open
                </span>
              )}
            </div>
            <div className="card-body">
              {alertCases.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state-title">No active alerts</div>
                  <p style={{ fontSize: 13 }}>System is monitoring configured shipments.</p>
                </div>
              ) : (
                <div className="alert-list">
                  {alertCases.map(c => c.alert != null && (
                    <AlertCard
                      key={c.case_id}
                      alert={c.alert}
                      availableActions={c.case_id === demoCase?.case_id ? demoAvailableActions : []}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cases list */}
          {cases.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">All cases</span>
              </div>
              {cases.map(c => (
                <CaseRow
                  key={c.case_id}
                  caseId={c.case_id}
                  shipmentId={c.shipment_id}
                  shipmentName={c.shipment_name}
                  destination={c.destination}
                />
              ))}
            </div>
          )}

          {cases.length === 0 && (
            <div className="card">
              <div className="card-body">
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state-title">No active cases</div>
                  <p style={{ fontSize: 13, marginBottom: 16 }}>Set up your first shipment to start monitoring.</p>
                  <Link href="/setup" className="btn btn-primary">Set up a shipment</Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Timeline column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Recent activity</span>
            </div>
            <div className="card-body">
              {demoCase != null ? (
                <WorkflowTimeline
                  events={timelineEvents}
                  currentState={demoCase.state}
                />
              ) : (
                <p className="text-muted" style={{ fontSize: 13 }}>No activity yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
