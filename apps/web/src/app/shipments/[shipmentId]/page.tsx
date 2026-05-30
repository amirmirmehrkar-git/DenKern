'use client';

/**
 * ShipmentDisruptionDetailPage — /shipments/:shipmentId
 *
 * Displays the full disruption context for review before scenario generation.
 * Lena reads the prediction, ERP context, environmental signals, and confirms
 * she understands the situation via "Show me my options" → emits context_confirmed.
 *
 * Minimum required state: alert_generated
 * On context_confirmed → dispatcher runs scenario engine → redirect to /decision-room/:caseId
 *
 * Architecture rules enforced:
 *   - "Show me my options" button is enabled ONLY when context_confirmed is in availableActions
 *   - Frontend emits events only — it does not write state directly
 *   - Polling via useWorkflowState provides the live available_actions
 *
 * Source: docs/architecture/07-component-map.md §A4
 *         docs/architecture/08-page-flow-map.md — Route: /shipments/:shipmentId
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { DisruptionContext, AlertEvent, WorkflowState } from '@denkkern/types';
import { useWorkflowState } from '../../../hooks/useWorkflowState.js';
import { PredictionSignalPanel } from '../../../components/panels/PredictionSignalPanel.js';
import { BusinessContextPanel } from '../../../components/panels/BusinessContextPanel.js';
import { WorkflowTimeline } from '../../../components/ui/WorkflowTimeline.js';
import { StatusBadge } from '../../../components/ui/StatusBadge.js';
import { STATE_ORDER } from '../../../lib/workflow/state-order.js';
import type { TimelineEvent } from '../../../components/ui/WorkflowTimeline.js';

// ---------------------------------------------------------------------------
// Shipment → Case ID mapping (MVP: one demo case)
// ---------------------------------------------------------------------------

const SHIPMENT_TO_CASE: Record<string, string> = {
  'SHIP-001': 'CASE-001',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ShipmentDisruptionDetailPage() {
  const params = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;
  const caseId = SHIPMENT_TO_CASE[shipmentId] ?? shipmentId;

  const router = useRouter();

  const [ctx, setCtx] = useState<DisruptionContext | null>(null);
  const [alert, setAlert] = useState<AlertEvent | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live workflow state — polled every 3s
  const { state, availableActions, isLoading: stateLoading, refresh } = useWorkflowState(caseId);

  // ── Route guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state == null) return;

    const order = STATE_ORDER[state];

    // Below minimum (alert_generated) → back to dashboard
    if (order < STATE_ORDER['alert_generated']) {
      router.replace('/dashboard');
      return;
    }

    // Past disruption_context_opened → forward to decision room
    if (order > STATE_ORDER['disruption_context_opened']) {
      router.replace(`/decision-room/${caseId}`);
    }
  }, [state, caseId, router]);

  // ── Data load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetch(`/api/cases/${caseId}/context`, { signal: controller.signal }).then(r => r.json() as Promise<DisruptionContext>),
      fetch(`/api/cases/${caseId}/alert`,   { signal: controller.signal }).then(r => r.json() as Promise<AlertEvent>),
    ])
      .then(([context, alertData]) => {
        setCtx(context);
        setAlert(alertData);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setDataError(e.message);
      })
      .finally(() => setIsDataLoading(false));

    return () => controller.abort();
  }, [caseId]);

  // ── context_confirmed handler ────────────────────────────────────────────
  async function handleContextConfirmed() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const res = await fetch(`/api/cases/${caseId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'context_confirmed',
        emitted_by: 'lena',
        emitted_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setSubmitError(json.error ?? 'Failed to confirm context.');
      setIsSubmitting(false);
      return;
    }

    // Refresh state immediately and let the route guard redirect us
    await refresh();
    router.push(`/decision-room/${caseId}`);
  }

  // ── Build timeline events ────────────────────────────────────────────────
  const timelineEvents: TimelineEvent[] = (
    [
      { state: 'monitoring_active'          as WorkflowState, occurred_at: '2026-05-25T08:00:00Z' },
      { state: 'disruption_detected'        as WorkflowState, occurred_at: '2026-05-25T08:28:00Z' },
      { state: 'alert_generated'            as WorkflowState, ...(alert?.triggered_at != null ? { occurred_at: alert.triggered_at } : {}) },
      { state: 'disruption_context_opened'  as WorkflowState },
    ] satisfies TimelineEvent[]
  ).filter((e) =>
    state != null && STATE_ORDER[e.state] <= STATE_ORDER[state]
  );

  // ── Loading / error states ────────────────────────────────────────────────
  if (stateLoading || isDataLoading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading disruption context…
      </div>
    );
  }

  if (dataError != null) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load disruption context</div>
        <p style={{ fontSize: 13 }}>{dataError}</p>
      </div>
    );
  }

  if (ctx == null || alert == null) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Shipment not found</div>
        <p style={{ fontSize: 13 }}>
          Shipment <code>{shipmentId}</code> has no active disruption context.
        </p>
      </div>
    );
  }

  const canConfirm = availableActions.includes('context_confirmed');
  const isSimulated = true; // mock adapter always serves simulated data

  return (
    <>
      {/* Alert header banner */}
      <div className={`alert-header-banner severity-${alert.severity}`}>
        <span className="alert-header-icon">
          {alert.severity === 'HIGH' ? '⚠️' : alert.severity === 'MEDIUM' ? '⚡' : 'ℹ️'}
        </span>
        <div className="alert-header-body">
          <div className="alert-header-title">
            {ctx.shipment_context.shipment_name}
          </div>
          <div className="alert-header-summary">{alert.summary}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={state ?? 'alert_generated'} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Case {caseId}
          </span>
        </div>
      </div>

      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Disruption context</h1>
        <p className="page-subtitle">
          {ctx.shipment_context.vessel_name} · {ctx.shipment_context.current_location} → {ctx.shipment_context.destination}
        </p>
      </div>

      {/* Panels grid */}
      <div className="panels-grid">
        <PredictionSignalPanel
          prediction={ctx.prediction}
          isSimulated={isSimulated}
        />
        <BusinessContextPanel
          context={ctx.shipment_context}
        />
      </div>

      {/* Timeline */}
      <div className="card mb-6">
        <div className="card-header">
          <span className="card-title">Case timeline</span>
        </div>
        <div className="card-body">
          <WorkflowTimeline
            events={timelineEvents}
            currentState={state ?? 'alert_generated'}
          />
        </div>
      </div>

      {/* Action area */}
      <div className="action-area">
        <div>
          <p className="action-area-desc">
            Review the prediction signal and business context above. When you are ready to see
            your available options, click the button to generate scenario comparisons.
          </p>
          {submitError != null && (
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--critical)' }}>{submitError}</p>
          )}
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => { void handleContextConfirmed(); }}
          disabled={!canConfirm || isSubmitting}
          title={!canConfirm ? 'Action not available in current workflow state' : undefined}
        >
          {isSubmitting ? (
            <>
              <span className="loading-spinner" style={{ width: 14, height: 14 }} />
              Generating scenarios…
            </>
          ) : (
            'Show me my options →'
          )}
        </button>
      </div>
    </>
  );
}
