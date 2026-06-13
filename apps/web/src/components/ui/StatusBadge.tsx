/**
 * StatusBadge -- colour-coded label for WorkflowState or execution step status.
 * Pure display component. No interactivity.
 */

import type { WorkflowState } from '@denkkern/types';

type BadgeVariant = 'critical' | 'warning' | 'success' | 'info' | 'neutral' | 'brand';

type StatusInput =
  | WorkflowState
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

const BADGE_MAP: Record<StatusInput, { variant: BadgeVariant; label: string }> = {
  // Setup
  setup_not_started:         { variant: 'neutral',  label: 'Setup pending' },
  setup_configured:          { variant: 'neutral',  label: 'Setup complete' },
  // Monitoring
  monitoring_active:         { variant: 'info',     label: 'Monitoring' },
  disruption_detected:       { variant: 'warning',  label: 'Disruption detected' },
  // Alert
  alert_generated:           { variant: 'critical', label: 'Alert' },
  // Context review
  disruption_context_opened: { variant: 'warning',  label: 'Under review' },
  // Scenarios
  scenarios_generated:       { variant: 'brand',    label: 'Scenarios ready' },
  recommendation_ranked:     { variant: 'brand',    label: 'Recommendation ready' },
  decision_pending:          { variant: 'brand',    label: 'Decision pending' },
  decision_approved:         { variant: 'success',  label: 'Decision approved' },
  // Second approval
  second_approval_pending:   { variant: 'warning',  label: 'Awaiting supervisor' },
  second_approval_confirmed: { variant: 'success',  label: 'Supervisor approved' },
  second_approval_rejected:  { variant: 'critical', label: 'Supervisor rejected' },
  // Decision Memory (DK-601/602/604)
  outcome_pending:           { variant: 'info',     label: 'Outcome tracking' },
  outcome_confirmed:         { variant: 'success',  label: 'Outcome confirmed' },
  // Execution
  execution_started:         { variant: 'info',     label: 'Executing' },
  execution_monitoring:      { variant: 'info',     label: 'In progress' },
  // Audit
  audit_logged:              { variant: 'success',  label: 'Audit logged' },
  closed:                    { variant: 'neutral',  label: 'Closed' },
  // Step statuses
  pending:                   { variant: 'neutral',  label: 'Pending' },
  in_progress:               { variant: 'info',     label: 'In progress' },
  completed:                 { variant: 'success',  label: 'Completed' },
  failed:                    { variant: 'critical', label: 'Failed' },
};

interface StatusBadgeProps {
  status: StatusInput;
  /** Override the default label. */
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const entry = BADGE_MAP[status] ?? { variant: 'neutral' as BadgeVariant, label: status };
  const displayLabel = label ?? entry.label;

  return (
    <span className={`badge badge-${entry.variant}`} style={size === 'sm' ? { fontSize: 10 } : undefined}>
      <span className="badge-dot" />
      {displayLabel}
    </span>
  );
}
