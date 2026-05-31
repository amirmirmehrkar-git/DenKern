/**
 * Workflow state machine types — DenkKern
 *
 * Source of truth: docs/architecture/02-workflow-state-machine.md
 *
 * STATE names are stable identifiers used in the database and API.
 * EVENT names are what the frontend and orchestration layer dispatch.
 *
 * IMPORTANT: The state `decision_approved` and the event `decision_confirmed`
 * are intentionally different names. `decision_confirmed` is the USER-emitted
 * event; `decision_approved` is the STATE the system enters after that event.
 * Never use `decision_approved` as an event name. See architecture doc Section C1.
 */

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export type WorkflowState =
  | 'setup_not_started'
  | 'setup_configured'
  | 'monitoring_active'
  | 'disruption_detected'
  | 'alert_generated'
  | 'disruption_context_opened'
  | 'scenarios_generated'
  | 'recommendation_ranked'
  | 'decision_pending'
  | 'decision_approved'           // STATE — entered after `decision_confirmed` event
  | 'second_approval_pending'     // STATE — entered when approval gate threshold is crossed
  | 'second_approval_confirmed'   // STATE — supervisor approved; ready for execution
  | 'second_approval_rejected'    // STATE — supervisor rejected; Lena may re-select
  | 'execution_started'
  | 'execution_monitoring'
  | 'audit_logged'
  | 'closed';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type WorkflowEvent =
  | 'setup_completed'
  | 'prediction_event_received'
  | 'alert_opened'
  | 'context_confirmed'
  | 'scenarios_requested'
  | 'scenario_selected'
  | 'decision_confirmed'          // EVENT — fired by user (Lena); transitions to `decision_approved`
  | 'second_approval_required'    // EVENT — fired by system (dispatcher consequence); transitions to `second_approval_pending`
  | 'second_approval_confirmed'   // EVENT — fired by supervisor (NEVER 'lena' or 'system') — architecture rule C2
  | 'second_approval_rejected'    // EVENT — fired by supervisor; transitions to `second_approval_rejected`
  | 'execution_triggered'
  | 'execution_step_updated'
  | 'audit_completed'
  | 'case_closed';

// ---------------------------------------------------------------------------
// Transition map (typed, not used at runtime in packages/types — kept for
// documentation and as a reference for the dispatcher in the API layer)
// ---------------------------------------------------------------------------

export type TransitionMap = Record<
  WorkflowState,
  Partial<Record<WorkflowEvent, WorkflowState>>
>;

export const WORKFLOW_TRANSITIONS: TransitionMap = {
  setup_not_started:         { setup_completed: 'setup_configured' },
  setup_configured:          { setup_completed: 'monitoring_active' },
  monitoring_active:         { prediction_event_received: 'disruption_detected' },
  disruption_detected:       { prediction_event_received: 'alert_generated' },
  alert_generated:           { alert_opened: 'disruption_context_opened' },
  disruption_context_opened: { context_confirmed: 'scenarios_generated' },
  scenarios_generated:       { scenarios_requested: 'recommendation_ranked' },
  recommendation_ranked:     { scenario_selected: 'decision_pending' },
  decision_pending:          {
    decision_confirmed: 'decision_approved',
    scenario_selected: 'recommendation_ranked',
  },
  decision_approved: {
    // Dispatcher fires `second_approval_required` automatically when gate threshold is crossed.
    // If gate does not apply, `execution_triggered` is available directly.
    second_approval_required: 'second_approval_pending',
    execution_triggered:      'execution_started',
  },
  second_approval_pending: {
    second_approval_confirmed: 'second_approval_confirmed',
    second_approval_rejected:  'second_approval_rejected',
  },
  // Supervisor approved — execution can now be triggered.
  second_approval_confirmed: { execution_triggered: 'execution_started' },
  // Supervisor rejected — Lena re-evaluates from scenario selection.
  second_approval_rejected:  { scenario_selected: 'recommendation_ranked' },
  execution_started:         { execution_step_updated: 'execution_monitoring' },
  execution_monitoring:      { audit_completed: 'audit_logged' },
  audit_logged:              { case_closed: 'closed' },
  closed:                    {},
};

// ---------------------------------------------------------------------------
// State polling response shape (GET /api/cases/:caseId/state)
// ---------------------------------------------------------------------------

export interface WorkflowStateResponse {
  case_id: string;
  state: WorkflowState;
  available_actions: WorkflowEvent[];
  updated_at: string;           // ISO 8601
}

// ---------------------------------------------------------------------------
// Event dispatch request shape (POST /api/cases/:caseId/events)
// ---------------------------------------------------------------------------

export interface WorkflowEventPayload {
  event: WorkflowEvent;
  emitted_by: string;           // user_id or "system"
  emitted_at: string;           // ISO 8601
  metadata?: Record<string, unknown>;
}
