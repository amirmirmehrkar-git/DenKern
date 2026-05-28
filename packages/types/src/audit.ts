/**
 * Audit entry contracts — DenkKern
 *
 * Source of truth: docs/architecture/06-data-contracts.md §10
 * Owner: Audit layer
 *
 * IMMUTABILITY RULE: Write-once. No update or delete operations permitted after write.
 * Amendments are new entries, not overwrites. The `payload_hash` field (SHA-256 of
 * sorted JSON serialisation) enables tamper detection.
 *
 * Written by the orchestration layer on `decision_confirmed` and finalised on `audit_written`.
 */

import type { DecisionApproval } from './decision.js';

export type OutcomeStatus = 'successful' | 'partially_successful' | 'unsuccessful' | 'unknown';

export interface AuditOutcome {
  actual_arrival_at?: string;               // ISO 8601 — when shipment actually arrived
  actual_total_cost_eur?: number;           // Total cost actually incurred
  estimated_loss_avoided_eur?: number;      // Operator's estimate of savings vs. doing nothing
  outcome_status?: OutcomeStatus;
  notes?: string;                           // Free-text operator notes
}

export interface AuditEntry {
  audit_id: string;                         // UUID
  case_id: string;
  shipment_id: string;
  written_at: string;                       // ISO 8601
  payload_hash: string;                     // SHA-256 of sorted JSON serialisation

  // Complete decision record
  decision_approval: DecisionApproval;      // Includes full DecisionContext
  execution_summary: {
    scenario_id: string;
    all_steps_completed: boolean;
    completed_at?: string;                  // ISO 8601 — set when all steps done
  };

  // System metadata
  system_versions: {
    scenario_engine_version: string;
    scenario_config_version: string;
    event_schema_version: string;
  };

  // Outcome — optional, filled manually after resolution.
  // Does not block case closure.
  // Does not feed back into automatic recommendations in v1.
  // Intended for future: historical learning, ROI validation, recommendation accuracy tracking.
  outcome?: AuditOutcome;
}
