/**
 * Workflow state ordering — DenkKern
 *
 * Provides ordinal values for WorkflowState so route guards can compare states
 * without stringly-typed switch statements.
 *
 * Usage:
 *   if (STATE_ORDER[state] < STATE_ORDER['alert_generated']) redirect('/dashboard');
 */

import type { WorkflowState } from '@denkkern/types';

/** Ordinal position of each state in the workflow lifecycle. */
export const STATE_ORDER: Record<WorkflowState, number> = {
  setup_not_started:         0,
  setup_configured:          1,
  monitoring_active:         2,
  disruption_detected:       3,
  alert_generated:           4,
  disruption_context_opened: 5,
  scenarios_generated:       6,
  recommendation_ranked:     7,
  decision_pending:          8,
  decision_approved:         9,
  // Second-approval states occupy ordinals 10–12.
  // second_approval_rejected sits at 10 because it steps backwards toward re-selection.
  second_approval_pending:   10,
  second_approval_confirmed: 11,
  second_approval_rejected:  10, // Same ordinal as pending — treated as a lateral state
  execution_started:         12,
  execution_monitoring:      13,
  audit_logged:              14,
  closed:                    15,
};

/**
 * Resolve the canonical Next.js route for a given workflow state.
 * Mirrors the mapping in docs/architecture/08-page-flow-map.md §2.
 */
export function resolveRouteForState(
  state: WorkflowState,
  ids: { caseId: string; shipmentId?: string }
): string {
  const { caseId, shipmentId = 'SHIP-001' } = ids;

  switch (state) {
    case 'setup_not_started':
    case 'setup_configured':
      return '/setup';

    case 'monitoring_active':
    case 'disruption_detected':
    case 'alert_generated':
      return '/dashboard';

    case 'disruption_context_opened':
      return `/shipments/${shipmentId}`;

    case 'scenarios_generated':
    case 'recommendation_ranked':
    case 'decision_pending':
    case 'decision_approved':
      return `/decision-room/${caseId}`;

    // Second-approval states: rejected returns Lena to the decision room;
    // pending/confirmed show the execution stub with the approval panel.
    case 'second_approval_rejected':
      return `/decision-room/${caseId}`;

    case 'second_approval_pending':
    case 'second_approval_confirmed':
      return `/execution/${caseId}`;

    case 'execution_started':
    case 'execution_monitoring':
      return `/execution/${caseId}`;

    case 'audit_logged':
    case 'closed':
      return `/audit/${caseId}`;
  }
}

/** Human-readable label for each workflow state — used in the WorkflowTimeline. */
export const STATE_LABELS: Record<WorkflowState, string> = {
  setup_not_started:         'Setup pending',
  setup_configured:          'Setup complete',
  monitoring_active:         'Monitoring active',
  disruption_detected:       'Disruption detected',
  alert_generated:           'Alert generated',
  disruption_context_opened: 'Context under review',
  scenarios_generated:       'Scenarios generated',
  recommendation_ranked:     'Recommendation ready',
  decision_pending:          'Awaiting decision',
  decision_approved:         'Decision approved',
  second_approval_pending:   'Awaiting supervisor approval',
  second_approval_confirmed: 'Supervisor approved',
  second_approval_rejected:  'Supervisor rejected — re-evaluate',
  execution_started:         'Execution started',
  execution_monitoring:      'Execution in progress',
  audit_logged:              'Audit recorded',
  closed:                    'Case closed',
};
