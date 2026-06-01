/**
 * ExternalRiskSignal contracts — DenkKern
 *
 * Structured external intelligence layer for the scenario engine.
 *
 * Design principles:
 *   - LLM finds / extracts / classifies / summarises signal content.
 *   - LLM never recommends scenarios.
 *   - LLM never approves decisions.
 *   - Scenario Engine remains deterministic — signals are structured inputs,
 *     not free-text injections.
 *   - For MVP, signals are mock/fixture-based. Real crawling is future work.
 *
 * Source of truth: docs/architecture/06-data-contracts.md §8
 */

// ---------------------------------------------------------------------------
// Signal type vocabulary
// ---------------------------------------------------------------------------

export type ExternalRiskSignalType =
  | 'PORT_STRIKE'
  | 'PORT_CLOSURE'
  | 'PORT_RESTRICTION'
  | 'GEOPOLITICAL_RISK'
  | 'WAR_RISK'
  | 'SUPPLIER_DISRUPTION'
  | 'SANCTIONS'
  | 'GOVERNMENT_RESTRICTION'
  | 'MARITIME_SECURITY_WARNING'
  | 'WEATHER_CONTEXT';

export type ExternalRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ExternalRiskSourceType =
  | 'llm_extracted'    // LLM parsed from news / intelligence feed
  | 'manual'           // Entered by operator
  | 'feed'             // Structured third-party data feed
  | 'simulated';       // Mock / fixture — for development and demo

// ---------------------------------------------------------------------------
// Engine effect — what the scenario engine should do with this signal
//
// LLM boundary rule: LLM may set recommended_engine_effect.
// The engine ALWAYS decides whether to apply it — LLM never directly mutates scores.
// ---------------------------------------------------------------------------

export type ExternalRiskEngineEffect =
  | 'increase_wait_risk'       // Boost WAIT scenario risk modifier
  | 'increase_urgency'         // Surface urgency indicator in UI — no score change
  | 'flag_second_approval'     // Trigger supervisor second-approval gate
  | 'none';                    // Signal is informational only

// ---------------------------------------------------------------------------
// Time window
// ---------------------------------------------------------------------------

export interface ExternalRiskTimeWindow {
  valid_from: string;    // ISO 8601 date or datetime
  valid_until?: string;  // ISO 8601 — optional (open-ended signals)
}

// ---------------------------------------------------------------------------
// ExternalRiskSignal
// ---------------------------------------------------------------------------

export interface ExternalRiskSignal {
  signal_id: string;                           // e.g. "ERS-001"
  signal_type: ExternalRiskSignalType;
  severity: ExternalRiskSeverity;
  confidence: number;                          // 0.0–1.0 — model/analyst confidence in the signal
  source_type: ExternalRiskSourceType;
  source_name: string;                         // e.g. "Reuters", "manual-operator", "fixture"
  location?: string;                           // e.g. "Port of Hamburg"
  route?: string;                              // e.g. "North Sea route"
  time_window: ExternalRiskTimeWindow;
  description: string;                         // Plain-language signal summary
  decision_relevance: string;                  // Why this signal matters for this decision
  recommended_engine_effect: ExternalRiskEngineEffect;

  // Optional: estimated additional delay days (used for WAIT risk boost calculation)
  estimated_additional_delay_days?: number;
}
