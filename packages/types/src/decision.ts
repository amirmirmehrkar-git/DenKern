/**
 * Decision approval contracts — DenkKern
 *
 * Source of truth: docs/architecture/06-data-contracts.md §8
 * Owner: User (Lena) / Frontend
 *
 * IMMUTABILITY RULE: Immutable once written. Cannot be retracted after
 * `execution_triggered` fires. The frontend emits `decision_confirmed` —
 * the orchestration layer writes this record.
 *
 * NOTE ON EVENT NAME: The event that produces this record is `decision_confirmed`.
 * The record type is `DecisionApproval`. These names are intentionally different.
 * See docs/architecture/02-workflow-state-machine.md §C1 rename rationale.
 */

import type { PredictionOutput } from './prediction.js';
import type { ShipmentContext } from './shipment.js';
import type { Scenario, RecommendationResult, AssumptionsLog } from './scenario.js';

export interface DecisionContext {
  prediction_snapshot: PredictionOutput;       // Immutable copy — as received from James
  erp_context_snapshot: Pick<ShipmentContext, 'production_context' | 'inventory'>;
  freight_options_snapshot: ShipmentContext['freight_options'];
  scenarios_at_decision: Scenario[];           // Scored scenarios as presented to Lena
  recommendation_at_decision: RecommendationResult;
  assumptions_log: AssumptionsLog;
  engine_version: string;
  scenario_config_version: string;
}

export interface DecisionApproval {
  case_id: string;
  selected_option_id: string;       // The scenario Lena chose (may differ from recommended)
  approved_by: string;              // Authenticated user_id
  approved_at: string;              // ISO 8601

  session_id?: string;              // Optional — for session-level audit traceability

  // Full context snapshot at time of approval
  // Written by orchestration layer — not the frontend
  decision_context: DecisionContext;
}
