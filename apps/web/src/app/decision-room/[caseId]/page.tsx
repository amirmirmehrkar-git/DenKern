'use client';

/**
 * DecisionRoomPage — /decision-room/:caseId
 *
 * Operators review the engine-ranked scenario comparison and approve a decision.
 *
 * Workflow:
 *   1. Page loads DisruptionContext from GET /api/cases/:caseId/context
 *   2. Page loads ScenarioResult from GET /api/cases/:caseId/scenarios (may 404)
 *   3. If scenarios not yet computed — show prediction + business context + gate card
 *   4. If scenarios present — show ScenarioComparisonMatrix + FinancialImpactPanel
 *   5. Operator selects a scenario → emits `scenario_selected` (→ decision_pending)
 *   6. Operator approves → emits `decision_confirmed` (→ decision_approved)
 *   7. On approval → redirect to /execution/:caseId
 *
 * Route guards:
 *   - Below scenarios_generated → redirect to /dashboard
 *   - Past decision_approved → redirect to /execution/:caseId
 *
 * Architecture rules enforced:
 *   - Scenario scores are rendered from engine output only (never recalculated)
 *   - UI renders available_actions from polling — does not derive from state name
 *   - decision_confirmed emitted_by is "lena" (a named user), never "system"
 *   - Recommendation flag is set by engine — UI renders it, does not infer it
 *
 * Source: docs/architecture/07-component-map.md §B
 *         docs/architecture/08-page-flow-map.md — Route: /decision-room/:caseId
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { ScenarioResult, Scenario, WorkflowState, DisruptionContext } from '@denkkern/types';
import { useWorkflowState } from '../../../hooks/useWorkflowState.js';
import { ScenarioComparisonMatrix } from '../../../components/decision/ScenarioComparisonMatrix.js';
import { DecisionActionPanel } from '../../../components/decision/DecisionActionPanel.js';
import { FinancialImpactPanel } from '../../../components/decision/FinancialImpactPanel.js';
import { PredictionSignalPanel } from '../../../components/panels/PredictionSignalPanel.js';
import { BusinessContextPanel } from '../../../components/panels/BusinessContextPanel.js';
import { WorkflowTimeline } from '../../../components/ui/WorkflowTimeline.js';
import { StatusBadge } from '../../../components/ui/StatusBadge.js';
import { STATE_ORDER } from '../../../lib/workflow/state-order.js';
import type { TimelineEvent } from '../../../components/ui/WorkflowTimeline.js';

// ---------------------------------------------------------------------------
// UrgencyLine — derived from prediction delay, no additional data fetch
// ---------------------------------------------------------------------------

function UrgencyLine({ delayDays }: { delayDays: number }) {
  if (delayDays <= 0) return null;
  const color = delayDays >= 5 ? 'var(--critical)' : delayDays >= 3 ? 'var(--warning)' : 'var(--text-secondary)';
  return (
    <p style={{ marginTop: 6, fontSize: 13, fontWeight: 500, color }}>
      ⚡ {delayDays}-day predicted delay — every hour of inaction increases exposure
    </p>
  );
}

// ---------------------------------------------------------------------------
// PreScenariosView — shown when context is loaded but scenarios are not yet computed
// ---------------------------------------------------------------------------

interface PreScenariosViewProps {
  context: DisruptionContext;
  caseId: string;
  onReturnToContext: () => void;
}

function PreScenariosView({ context, caseId, onReturnToContext }: PreScenariosViewProps) {

  return (
    <>
      {/* Gate state card */}
      <div className="card mb-6" style={{ borderLeft: '4px solid var(--warning)', marginBottom: 24 }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Scenarios not yet computed
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              The scenario engine has not run for case {caseId}. Return to the disruption context page
              to confirm the context and trigger scenario generation.
            </p>
          </div>
          <button
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={onReturnToContext}
          >
            ← Return to context
          </button>
        </div>
      </div>

      {/* Prediction and business context — gives operator full situational awareness */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <PredictionSignalPanel
          prediction={context.prediction}
          isSimulated={context.prediction.model_version.includes('mock') || context.prediction.model_version.includes('simulated')}
        />
        <BusinessContextPanel
          context={context.shipment_context}
          compact={false}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecisionRoomPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const router = useRouter();

  // Disruption context — always fetched; provides prediction + business context
  const [disruptionContext, setDisruptionContext] = useState<DisruptionContext | null>(null);
  const [isContextLoading, setIsContextLoading] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  // Scenario result — may be absent (404) when scenarios not yet computed
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [isScenariosLoading, setIsScenariosLoading] = useState(true);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Live workflow state — polled every 3s
  const { state, availableActions, isLoading: stateLoading, refresh } = useWorkflowState(caseId);

  // ── Route guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (state == null) return;
    const order = STATE_ORDER[state];

    // Too early → dashboard
    if (order < STATE_ORDER['scenarios_generated']) {
      router.replace('/dashboard');
      return;
    }

    // Past decision_approved → execution
    if (order > STATE_ORDER['decision_approved']) {
      router.replace(`/execution/${caseId}`);
    }
  }, [state, caseId, router]);

  // ── Load disruption context ──────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/cases/${caseId}/context`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<DisruptionContext>;
      })
      .then((data) => setDisruptionContext(data))
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setContextError(e.message);
      })
      .finally(() => setIsContextLoading(false));

    return () => controller.abort();
  }, [caseId]);

  // ── Load scenario result ─────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/cases/${caseId}/scenarios`, { signal: controller.signal })
      .then(async (res) => {
        // 404 means scenarios not yet computed — not an error, just a gate state
        if (res.status === 404) return null;
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ScenarioResult>;
      })
      .then((data) => {
        if (data == null) return; // scenarios not yet computed — PreScenariosView handles it
        setScenarioResult(data);
        // Pre-select the recommended scenario so the operator has a sensible default
        const recommended = data.scenarios.find((s) => s.recommended);
        if (recommended) setSelectedScenarioId(recommended.scenario_id);
      })
      .catch((e: Error) => {
        // Non-404 fetch errors are surfaced via contextError (context is the primary fetch)
        if (e.name !== 'AbortError') console.error('[Decision Room] scenarios fetch error:', e.message);
      })
      .finally(() => setIsScenariosLoading(false));

    return () => controller.abort();
  }, [caseId]);

  // ── scenario_selected handler ────────────────────────────────────────────
  async function handleScenarioSelect(scenarioId: string) {
    if (isSubmitting) return;
    if (!availableActions.includes('scenario_selected')) {
      setSelectedScenarioId(scenarioId);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSelectedScenarioId(scenarioId);

    const res = await fetch(`/api/cases/${caseId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'scenario_selected',
        emitted_by: 'lena',
        emitted_at: new Date().toISOString(),
        metadata: { scenario_id: scenarioId },
      }),
    });

    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setSubmitError(json.error ?? 'Failed to select scenario.');
    } else {
      await refresh();
    }

    setIsSubmitting(false);
  }

  // ── decision_confirmed handler ───────────────────────────────────────────
  // Architecture rule C1: emitted_by must be a named user, never "system".
  async function handleDecisionConfirm() {
    if (isSubmitting || selectedScenarioId == null) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const res = await fetch(`/api/cases/${caseId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'decision_confirmed',
        emitted_by: 'lena',          // NEVER "system" — architecture rule C1
        emitted_at: new Date().toISOString(),
        metadata: { approved_scenario_id: selectedScenarioId },
      }),
    });

    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setSubmitError(json.error ?? 'Failed to confirm decision.');
      setIsSubmitting(false);
      return;
    }

    await refresh();
    router.push(`/execution/${caseId}`);
  }

  // ── Build timeline ────────────────────────────────────────────────────────
  const timelineEvents: TimelineEvent[] = (
    [
      { state: 'disruption_context_opened' as WorkflowState },
      { state: 'scenarios_generated'       as WorkflowState },
      { state: 'recommendation_ranked'     as WorkflowState },
      { state: 'decision_pending'          as WorkflowState },
      { state: 'decision_approved'         as WorkflowState },
    ] satisfies TimelineEvent[]
  ).filter((e) =>
    state != null && STATE_ORDER[e.state] <= STATE_ORDER[state]
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedScenario: Scenario | null =
    scenarioResult?.scenarios.find((s) => s.scenario_id === selectedScenarioId) ?? null;

  const canSelect  = availableActions.includes('scenario_selected');
  const canConfirm = availableActions.includes('decision_confirmed');

  // Delay days: prefer scenario result (more authoritative), fall back to disruption context
  const delayDays =
    scenarioResult?.assumptions_log.prediction_snapshot.expected_delay_days
    ?? disruptionContext?.prediction.delay.expected_delay_days
    ?? 0;

  // ── Loading / error ───────────────────────────────────────────────────────
  const isPageLoading = stateLoading || isContextLoading || isScenariosLoading;

  if (isPageLoading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading decision room…
      </div>
    );
  }

  if (contextError != null) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load case context</div>
        <p style={{ fontSize: 13 }}>{contextError}</p>
        <p style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>
          Make sure the disruption context was confirmed on the previous page.
        </p>
      </div>
    );
  }

  if (disruptionContext == null) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No context available</div>
        <p style={{ fontSize: 13 }}>No disruption context found for case {caseId}.</p>
      </div>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Decision Room</h1>
          <p className="page-subtitle">
            Case {caseId} · Review options and approve a course of action
          </p>
          <UrgencyLine delayDays={delayDays} />
        </div>
        <StatusBadge status={state ?? 'scenarios_generated'} />
      </div>

      {/* Pre-scenarios gate — shown when scenarios not yet computed */}
      {scenarioResult == null && (
        <PreScenariosView
          context={disruptionContext}
          caseId={caseId}
          onReturnToContext={() => router.push(`/disruption/${caseId}`)}
        />
      )}

      {/* Full decision view — shown when scenarios are available */}
      {scenarioResult != null && (
        <>
          {/* Scenario comparison */}
          <ScenarioComparisonMatrix
            result={scenarioResult}
            selectedScenarioId={selectedScenarioId}
            canSelect={canSelect}
            isSubmitting={isSubmitting}
            onSelect={(id) => { void handleScenarioSelect(id); }}
          />

          {/* Financial impact — shown once a scenario is selected */}
          <FinancialImpactPanel
            result={scenarioResult}
            selectedScenario={selectedScenario}
          />

          {/* Decision action panel — above timeline so primary CTA is immediately reachable */}
          <DecisionActionPanel
            selectedScenario={selectedScenario}
            canConfirm={canConfirm}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onConfirm={() => { void handleDecisionConfirm(); }}
            onChangeScenario={() => setSelectedScenarioId(null)}
          />
        </>
      )}

      {/* Timeline — audit context, always visible */}
      <div className="card mb-6" style={{ marginTop: 24 }}>
        <div className="card-header">
          <span className="card-title">Case timeline</span>
        </div>
        <div className="card-body">
          <WorkflowTimeline
            events={timelineEvents}
            currentState={state ?? 'scenarios_generated'}
          />
        </div>
      </div>
    </>
  );
}
