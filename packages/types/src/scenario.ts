/**
 * Scenario engine contracts — DenkKern
 *
 * Source of truth: docs/architecture/06-data-contracts.md §5–7
 *                  docs/architecture/03-scenario-engine.md §8
 *
 * The scenario engine is a pure function:
 *   runScenarioEngine(ScenarioEngineInput): ScenarioResult
 *
 * It must never write to a database, call an external API, call an LLM,
 * or read configuration from ambient/global state. All config is passed in.
 */

import type { PredictionOutput, ConfidenceTier } from './prediction.js';
import type { ShipmentContext } from './shipment.js';
import type { SignalSeverity, SignalSource } from './disruption.js';
import type { ExternalRiskSignal } from './external-risk.js';

// ---------------------------------------------------------------------------
// Configuration (loaded from config/scenario-defaults.json — versioned)
// ---------------------------------------------------------------------------

export interface ScenarioConfig {
  version: string;                  // e.g. "scenario-config-v0.1"
  confidence_tiers: {
    HIGH: { min_score: number; wait_modifier_increment: number };
    MEDIUM: { min_score: number; wait_modifier_increment: number };
    LOW: { min_score: number; wait_modifier_increment: number };
  };
  base_risk_modifiers: {
    WAIT: number;
    REROUTE: number;
    REPLACE: number;
  };
  strategic_weights_eur: {
    WAIT: number;
    REROUTE: number;
    REPLACE: number;
  };
  risk_level_thresholds: {
    LOW_max_days: number;
    MEDIUM_max_days: number;
  };
  tiebreak_preference: string[];    // e.g. ["REPLACE", "REROUTE", "WAIT"]

  // Second-approval gate — configurable, never hardcoded in application code.
  // A scenario triggers supervisor review when its final_score_eur >= this value
  // OR when execution_complexity === 'HIGH'.
  // Default: 300_000 (€300k). Set to 0 to require second approval on all decisions.
  second_approval_threshold_eur: number;

  // Harbor congestion weight — multiplied by harbor_congestion_signal (0.0–1.0)
  // to produce the additive WAIT risk modifier boost.
  // Default: 0.15 if absent (backward-compatible with existing config files).
  harbor_congestion_weight?: number;
}

// ---------------------------------------------------------------------------
// Business factors — explicit first-class engine contract (Sprint 2.5)
//
// Promoted from implicit ERP context assumptions to a named interface.
// Derived from ShipmentContext.production_context at input assembly time.
// Used by annotateFinancialImpact() to produce FinancialImpactAnnotation.
// ---------------------------------------------------------------------------

export interface BusinessFactors {
  cost_of_delay_eur_per_day: number;            // Production loss per day
  inventory_buffer_days: number;                // Days production absorbs without the part
  part_criticality: 'LOW' | 'MEDIUM' | 'HIGH'; // HIGH = blocks production from day 0
  affected_production_lines: number;            // Lines dependent on this part (1 for MVP)
  contract_penalty_eur_per_day: number;         // SLA penalty per overdue day (0 = no penalty)
  contract_penalty_trigger_day: number;         // Day delay must exceed before penalty applies
}

// ---------------------------------------------------------------------------
// Financial impact annotation — engine-owned, deterministic (Sprint 2.5)
//
// Produced by annotateFinancialImpact() in packages/engine.
// Stored on ScenarioResult.financial_impact — absent if business_factors were
// not provided at engine-run time (backward-compatible with existing tests).
// ---------------------------------------------------------------------------

export interface FinancialImpactAnnotation {
  production_downtime_risk: {
    total_exposure_eur: number;        // wait_delay_days × cost_per_day × affected_lines
    buffer_remaining_days: number;     // inventory_buffer_days − wait_delay_days (may be negative)
    buffer_exhausted: boolean;         // buffer_remaining_days <= 0
    affected_production_lines: number;
  };
  contract_exposure: {
    penalty_applies: boolean;
    estimated_penalty_eur: number;     // 0 if no penalty or delay within trigger window
    penalty_trigger_day: number;       // Informational — surfaced in UI
  };
  strategic_summary: string;           // Deterministic template prose — never LLM-generated
}

// ---------------------------------------------------------------------------
// Engine input
// ---------------------------------------------------------------------------

export interface ActiveRiskSignal {
  type: string;
  location: string;
  severity: SignalSeverity;
  estimated_impact_days: number;
  source: SignalSource;
}

export interface ScenarioEngineInput {
  case_id: string;
  prediction_snapshot: PredictionOutput;         // Immutable copy from disruption context
  erp_context: {                                 // Subset of ShipmentContext
    daily_downtime_cost_eur: number;
    required_by: string;
    inventory: ShipmentContext['inventory'];
  };
  freight_options: ShipmentContext['freight_options']; // May be empty array
  active_risk_signals: ActiveRiskSignal[];        // Merged from weather + news signals
  scenario_config: ScenarioConfig;               // Versioned — passed in, never ambient

  // External risk intelligence signals — optional (mock/fixture for MVP)
  // HIGH or CRITICAL signals boost WAIT scenario risk and may trigger second approval.
  // LLM boundary: LLM classifies signals; engine decides scoring effects deterministically.
  external_risk_signals?: ExternalRiskSignal[];

  // Business factors — Sprint 2.5 addition, optional (backward-compatible).
  // When present, passed to annotateFinancialImpact() after runScenarioEngine().
  business_factors?: BusinessFactors;
}

// ---------------------------------------------------------------------------
// Scenario types
// ---------------------------------------------------------------------------

export type ScenarioType = 'wait' | 'reroute' | 'replace';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ExecutionComplexity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ScenarioExplanation {
  cost_breakdown: {
    action_cost_label: string;
    production_loss_label: string;
    base_cost_label: string;
    risk_modifier_label: string;    // Includes confidence tier if applicable
    adjusted_cost_label: string;
    strategic_weight_label: string;
    final_score_label: string;
  };
  key_assumption: string;
  risk_note: string;
  data_sources: string[];           // Includes "(simulated)" label where applicable
}

export interface Scenario {
  scenario_id: string;              // "WAIT" | "REROUTE" | "REPLACE"
  name: string;
  description: string;
  scenario_type: ScenarioType;

  // Inputs (preserved from ScenarioEngineInput for audit traceability)
  action_cost_eur: number;
  expected_delay_days: number;
  daily_production_loss_eur: number;

  // Derived costs (computed by engine)
  production_loss_eur: number;       // expected_delay_days × daily_production_loss_eur
  base_cost_eur: number;             // action_cost_eur + production_loss_eur

  // Risk adjustment
  confidence_tier: ConfidenceTier;
  confidence_increment: number;      // 0.0 | 0.1 | 0.2
  base_risk_modifier: number;        // From scenario config
  effective_risk_modifier: number;   // base + confidence_increment (WAIT only)
  adjusted_cost_eur: number;         // base_cost_eur × effective_risk_modifier
  risk_modifier_reason: string;      // Human-readable explanation

  // Strategic weight
  strategic_weight_eur: number;      // Additive, default 0
  strategic_weight_reason: string;

  // Final score
  final_score_eur: number;           // adjusted_cost_eur + strategic_weight_eur

  // Classification
  risk_level: RiskLevel;
  execution_complexity: ExecutionComplexity;

  // Recommendation flag — true for exactly one scenario per result
  recommended: boolean;

  // Explainability
  explanation: ScenarioExplanation;
}

// ---------------------------------------------------------------------------
// Assumptions log
// ---------------------------------------------------------------------------

export interface AssumptionsLog {
  generated_at: string;             // ISO 8601
  prediction_snapshot: {
    expected_delay_days: number;
    p_delay_over_3_days: number;
    confidence_score: number;
    confidence_tier: ConfidenceTier;
    model_version: string;
  };
  risk_modifiers_applied: Record<string, number>;    // { WAIT: 1.3, REROUTE: 1.1, REPLACE: 1.0 }
  strategic_weights_applied: Record<string, number>; // { WAIT: 0, REROUTE: 0, REPLACE: 0 }
  daily_production_loss_eur: number;
  scenario_config_version: string;

  // Financial impact inputs — carried through so the UI can call
  // calculateFinancialImpact() without an additional API fetch.
  required_by: string;         // ISO date — ShipmentContext.production_context.required_by
  baseline_eta_date: string;   // ISO date — PredictionOutput.eta.baseline
}

// ---------------------------------------------------------------------------
// Engine output
// ---------------------------------------------------------------------------

export interface RecommendationResult {
  recommended_option_id: string;                // Matches a scenario_id
  recommended_action: string;                   // Plain-language action label
  reason: string;                               // Plain-language explanation
  estimated_savings_vs_waiting_eur: number;     // final_score(WAIT) - final_score(RECOMMENDED)
  confidence_note: string;                      // Surfaces confidence tier context

  /**
   * FIXED STRING — never configurable, never AI-generated, never truncated.
   * Value must always be exactly:
   * "The system ranks and explains. Lena makes the final decision."
   */
  decision_note: string;
}

export const DECISION_NOTE = 'The system ranks and explains. Lena makes the final decision.' as const;

export interface ScenarioResult {
  case_id: string;
  computed_at: string;              // ISO 8601
  engine_version: string;

  scenarios: Scenario[];            // All computed options — never filtered before reaching frontend
  recommendation: RecommendationResult;
  assumptions_log: AssumptionsLog;

  scenario_count: number;           // Must equal scenarios.length

  // Second-approval gate — true when financial threshold exceeded, execution
  // complexity is HIGH, or any external signal with severity HIGH/CRITICAL is present.
  second_approval_required: boolean;
  second_approval_reason?: string;  // Plain-language explanation for supervisor

  // High/critical external signals that influenced this result — empty array if none
  urgency_signals: ExternalRiskSignal[];

  // Financial impact annotation — Sprint 2.5 addition, optional (backward-compatible).
  // Produced by annotateFinancialImpact() after runScenarioEngine().
  // Absent if business_factors were not provided at engine-run time.
  financial_impact?: FinancialImpactAnnotation;
}
