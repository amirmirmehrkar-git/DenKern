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

    // Sprint 2.5 additions — optional until James delivers
    variance_days?: number;               // Std dev of delay estimate (Monte Carlo input — future)
    harbor_congestion_signal?: number;    // 0.0–1.0 from GNN harbor layer; amplifies WAIT risk modifier
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
// Normalization — adapter boundary contract
//
// Every DataAdapter implementation MUST return PredictionOutput from
// getPrediction(). If James' model sends PredictionOutputMinimal, the
// adapter calls normalizeMinimalPrediction() before returning.
//
// This is the ONLY place defaults for missing fields are defined.
// Never add defaults in the scenario engine, dispatcher, or UI layer.
// ---------------------------------------------------------------------------

/**
 * Type guard — returns true when the input already satisfies PredictionOutput.
 * Detection criterion: presence of the `eta` field (absent in minimal contract).
 */
export function isPredictionOutputFull(
  input: PredictionOutput | PredictionOutputMinimal
): input is PredictionOutput {
  return 'eta' in input;
}

/**
 * Normalize a minimal or full prediction to the full PredictionOutput shape.
 *
 * Called at the adapter boundary (DataAdapter.getPrediction) so that all
 * downstream layers — dispatcher, scenario engine, UI — always receive a
 * well-formed PredictionOutput regardless of what James' model actually sent.
 *
 * Default ETA dates are derived from expectedDelayDays and an assumed
 * baseline of `today`. The real adapter should pass the actual required_by
 * date as `knownBaseline` when available from the ERP context.
 *
 * @param input          James' raw output — minimal or full
 * @param knownBaseline  ISO date string for the contracted baseline arrival
 *                       date (from ERP context). Used only when `input` is
 *                       minimal and the `eta` block is absent.
 *                       Defaults to today's date if not provided.
 */
export function normalizeMinimalPrediction(
  input: PredictionOutput | PredictionOutputMinimal,
  knownBaseline?: string
): PredictionOutput {
  // Already full — return as-is (structural identity preserved, no copy, no field loss).
  if (isPredictionOutputFull(input)) {
    return input;
  }

  // Minimal path — spread the full input first so any extra fields James adds in the
  // future (variance_days, harbor_congestion_signal, extended risk metadata, etc.)
  // are preserved without any code change here. Then fill only the required gaps.
  const {
    shipment_id,
    expected_delay_days,
    p_delay_over_3_days,
    confidence_score,
    ...extraFields          // Forward-compat: any future James fields pass through
  } = input as PredictionOutputMinimal & Record<string, unknown>;

  const generatedAt = new Date().toISOString();
  const baseline    = knownBaseline ?? new Date().toISOString().slice(0, 10);

  // Derive ETA envelope from baseline + delay
  const baselineDate    = new Date(baseline);
  const expectedDate    = new Date(baselineDate); expectedDate.setDate(baselineDate.getDate() + expected_delay_days);
  const optimisticDate  = new Date(baselineDate); optimisticDate.setDate(baselineDate.getDate() + Math.max(0, expected_delay_days - 1));
  const pessimisticDate = new Date(baselineDate); pessimisticDate.setDate(baselineDate.getDate() + expected_delay_days + 2);

  return {
    // Extra fields first — required fields below will override any accidental collision
    ...extraFields,

    shipment_id,

    // 'eta-delay-minimal' signals this came through the normalization path.
    // The real adapter should pass model_version from the response header if available.
    model_version: (extraFields['model_version'] as string | undefined) ?? 'eta-delay-minimal',
    generated_at:  (extraFields['generated_at'] as string | undefined) ?? generatedAt,

    eta: {
      baseline:    baseline,
      expected:    expectedDate.toISOString().slice(0, 10),
      optimistic:  optimisticDate.toISOString().slice(0, 10),
      pessimistic: pessimisticDate.toISOString().slice(0, 10),
    },

    delay: {
      expected_delay_days,
      p_delay_over_3_days,
      confidence_score,
    },

    // Preserve risk_drivers if James sends them in the minimal envelope;
    // fall back to empty array (engine uses active_risk_signals from context instead).
    risk_drivers: (extraFields['risk_drivers'] as PredictionOutput['risk_drivers'] | undefined) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Confidence tier classification (derived from confidence_score)
// ---------------------------------------------------------------------------

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Classify confidence_score into a tier.
 * Thresholds from docs/architecture/03-scenario-engine.md §8.2
 *
 * HIGH   >= 0.75  ->  wait_modifier_increment = 0.0
 * MEDIUM >= 0.50  ->  wait_modifier_increment = 0.1
 * LOW    <  0.50  ->  wait_modifier_increment = 0.2
 */
export function classifyConfidence(confidence_score: number): ConfidenceTier {
  if (confidence_score >= 0.75) return 'HIGH';
  if (confidence_score >= 0.50) return 'MEDIUM';
  return 'LOW';
}
