/**
 * Prediction contracts — DenkKern
 *
 * Source of truth: docs/architecture/06-data-contracts.md §1
 * Owner: James
 *
 * IMMUTABILITY RULE: Once a PredictionOutput is received and logged as part of a
 * `prediction_received` event, no downstream layer may modify any field.
 * References and snapshots are permitted; mutations are not.
 */

// ---------------------------------------------------------------------------
// Full contract (James' standard output)
// ---------------------------------------------------------------------------

export interface PredictionOutput {
  // Identity
  shipment_id: string;              // e.g. "SHIP-001"
  model_version: string;            // e.g. "eta-delay-v0.1"
  generated_at: string;             // ISO 8601

  // ETA
  eta: {
    baseline: string;               // Original contracted arrival date (ISO date)
    expected: string;               // Model's expected arrival date
    optimistic: string;             // Best-case arrival date
    pessimistic: string;            // Worst-case arrival date
  };

  // Delay
  delay: {
    expected_delay_days: number;    // Days beyond baseline
    p_delay_over_3_days: number;    // Probability 0.0–1.0
    confidence_score: number;       // Model confidence 0.0–1.0
  };

  // Risk drivers
  risk_drivers: Array<{             // May be empty array
    type: string;                   // e.g. "port_congestion" | "strike_risk" | "maritime_disruption"
    location: string;               // e.g. "Hamburg"
    severity: 'low' | 'medium' | 'high';
    estimated_impact_days: number;
  }>;
}

// ---------------------------------------------------------------------------
// Minimum contract (James' fallback — orchestration layer defaults missing fields)
// ---------------------------------------------------------------------------

export interface PredictionOutputMinimal {
  shipment_id: string;
  expected_delay_days: number;
  p_delay_over_3_days: number;
  confidence_score: number;
}

// ---------------------------------------------------------------------------
// Confidence tier classification (derived from confidence_score)
// ---------------------------------------------------------------------------

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Classify confidence_score into a tier.
 * Thresholds from docs/architecture/03-scenario-engine.md §8.2
 *
 * HIGH   ≥ 0.75  →  wait_modifier_increment = 0.0
 * MEDIUM ≥ 0.50  →  wait_modifier_increment = 0.1
 * LOW    < 0.50  →  wait_modifier_increment = 0.2
 */
export function classifyConfidence(confidence_score: number): ConfidenceTier {
  if (confidence_score >= 0.75) return 'HIGH';
  if (confidence_score >= 0.50) return 'MEDIUM';
  return 'LOW';
}
