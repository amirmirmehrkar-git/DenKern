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
}
