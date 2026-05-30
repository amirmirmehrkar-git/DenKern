'use client';

/**
 * DecisionRoomPage — /decision-room/:caseId
 *
 * Lena reviews the engine-ranked scenario comparison and approves a decision.
 *
 * Workflow:
 *   1. Page loads ScenarioResult from GET /api/cases/:caseId/scenarios
 *   2. Lena selects a scenario → emits `scenario_selected` (transitions to decision_pending)
 *   3. Lena approves → emits `decision_confirmed` (transitions to decision_approved)
 *   4. On approval → redirect to /execution/:caseId
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
import type { ScenarioResult, Scenario, WorkflowState } from '@denkkern/types';
import { useWorkflowState } from '../../../hooks/useWorkflowState.js';
import { ScenarioComparisonMatrix } from '../../../components/decision/ScenarioComparisonMatrix.js';
import { DecisionActionPanel } from '../../../components/decision/DecisionActionPanel.js';
import { WorkflowTimeline } from '../../../components/ui/WorkflowTimeline.js';
import { StatusBadge } from '../../../components/ui/StatusBadge.js';
import { STATE_ORDER } from '../../../lib/workflow/state-order.js';
import type { TimelineEvent } from '../../../components/ui/WorkflowTimeline.js';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecisionRoomPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const router = useRouter();

  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

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

    // Past decision_approved → execution (decision has been made elsewhere)
    if (order > STATE_ORDER['decision_approved']) {
      router.replace(`/execution/${caseId}`);
    }
  }, [state, caseId, router]);

  // ── Load scenario result ─────────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/cases/${caseId}/scenarios`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ScenarioResult>;
      })
      .then((data) => {
        setScenarioResult(data);
        // Pre-select the recommended scenario so Lena has a sensible default
        const recommended = data.scenarios.find((s) => s.recommended);
        if (recommended) setSelectedScenarioId(recommended.scenario_id);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setDataError(e.message);
      })
      .finally(() => setIsDataLoading(false));

    return () => controller.abort();
  }, [caseId]);

  // ── scenario_selected handler ────────────────────────────────────────────
  async function handleScenarioSelect(scenarioId: string) {
    if (isSubmitting) return;
    if (!availableActions.includes('scenario_selected')) {
      // If scenario_selected is not available (e.g. already in decision_pending
      // with a different scenario), allow re-selection optimistically
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
  // Architecture rule: emitted_by must be a named user, never "system".
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

    // Refresh then redirect — let route guard handle it if polling beats us
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

  // ── Loading / error ───────────────────────────────────────────────────────
  if (stateLoading || isDataLoading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading decision room…
      </div>
    );
  }

  if (dataError != null) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load scenarios</div>
        <p style={{ fontSize: 13 }}>{dataError}</p>
        <p style={{ fontSize: 12, marginTop: 8, color: 'var(--text-muted)' }}>
          Make sure you confirmed the disruption context on the previous page.
        </p>
      </div>
    );
  }

  if (scenarioResult == null) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No scenarios available</div>
        <p style={{ fontSize: 13 }}>Case {caseId} has no computed scenarios.</p>
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
        </div>
        <StatusBadge status={state ?? 'scenarios_generated'} />
      </div>

      {/* Scenario comparison */}
      <ScenarioComparisonMatrix
        result={scenarioResult}
        selectedScenarioId={selectedScenarioId}
        canSelect={canSelect}
        isSubmitting={isSubmitting}
        onSelect={(id) => { void handleScenarioSelect(id); }}
      />

      {/* Timeline */}
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

      {/* Decision action panel */}
      <DecisionActionPanel
        selectedScenario={selectedScenario}
        canConfirm={canConfirm}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onConfirm={() => { void handleDecisionConfirm(); }}
        onChangeScenario={() => setSelectedScenarioId(null)}
      />
    </>
  );
}
