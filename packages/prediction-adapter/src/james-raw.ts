/**
 * JamesPredictionRaw — DenkKern internal type
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  INTERNAL TYPE — NOT EXPORTED FROM PACKAGE PUBLIC API               ║
 * ║  Do NOT import this type from outside packages/prediction-adapter.  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Represents the raw JSON response from James' FastAPI prediction endpoint.
 *
 * CONFIRMED STABLE (James 2026-06-03):
 *   results.arrival_time.mean   — predicted ETA
 *   results.eta_prediction.mean_hours — predicted transit duration in hours
 *   mmsi — always included in response
 *
 * NOT YET STABLE (do not depend on):
 *   model_version — not provided; synthesised by adapter
 *   Monte Carlo fields (transit_mc) — exist in model but reliability unconfirmed
 *   intermediate_stops — in progress
 *   harbor_signal — in progress
 *
 * MODEL ARCHITECTURE NOTE:
 *   temporal_gnn_model.pt is a PyTorch state_dict, NOT a standalone model.
 *   It requires the matching TemporalGraphGNN class and metadata files to load.
 *   It must NEVER be bundled into the web app or prediction-adapter package.
 *   The adapter calls James' FastAPI HTTP endpoint only — no direct .pt access.
 *
 * When a previously unstable field is confirmed, update:
 *   1. This file — promote from optional/unknown to required/concrete type.
 *   2. james-raw-schema.ts — add structural validation for the new field.
 *   3. mapper.ts — fill in or activate the corresponding extraction logic.
 *
 * Do NOT change port.ts, JamesHTTPAdapter, MockPredictionAdapter, or the factory.
 *
 * Source of truth: docs/architecture/sprint-3-plan.md §3.2
 * See also: docs/architecture/09-james-gnn-gap-analysis.md
 */

// ---------------------------------------------------------------------------
// Confirmed stable sub-shapes
// ---------------------------------------------------------------------------

/**
 * results.arrival_time — CONFIRMED STABLE (James 2026-06-03)
 *
 * Contains the model's predicted arrival time at the destination port.
 * `mean` is the point estimate from the MC distribution.
 *
 * Format of `mean`: assumed to be an ISO 8601 date/time string or epoch ms.
 * The mapper normalises both formats to YYYY-MM-DD.
 */
export interface JamesArrivalTime {
  /** Predicted arrival date/time — ISO 8601 string or epoch ms number. CONFIRMED. */
  mean: string | number;

  /**
   * MC standard deviation of arrival time — PRELIMINARY, not reliable yet.
   * Present in some model outputs. Do not use for p_delay calculation until confirmed.
   * @preliminary
   */
  std?: number;
}

/**
 * results.eta_prediction — CONFIRMED STABLE (James 2026-06-03)
 *
 * Contains the model's predicted transit duration.
 * `mean_hours` is the point estimate.
 */
export interface JamesEtaPrediction {
  /** Predicted transit duration in hours. CONFIRMED. */
  mean_hours: number;

  /**
   * MC standard deviation of transit hours — PRELIMINARY, not reliable yet.
   * When confirmed, mapper will use this for gaussianPDelayOver3Days().
   * @preliminary
   */
  std_hours?: number;

  /**
   * Confidence score derived from MC distribution — PRELIMINARY.
   * Formula: exp(-std / (|mean| + 1.0)) — see gap analysis §1.
   * When confirmed, replaces fallbackConfidence() in mapper.
   * @preliminary
   */
  confidence?: number;
}

/**
 * results — top-level container for James' prediction outputs.
 * Shape confirmed for the two stable fields; other keys may exist.
 */
export interface JamesResults {
  /** CONFIRMED STABLE — predicted arrival at destination port. */
  arrival_time: JamesArrivalTime;

  /** CONFIRMED STABLE — predicted transit duration. */
  eta_prediction: JamesEtaPrediction;

  /**
   * Harbor / port congestion signal — NOT yet stable.
   * May map to queue_depth_predictions from earlier GNN output.
   * @in-progress-not-stable
   */
  harbor_congestion?: unknown;

  /**
   * Intermediate port stops — NOT yet stable.
   * @in-progress-not-stable
   */
  intermediate_stops?: unknown;

  /** Forward-compat: absorbs any additional result keys. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Top-level raw response
// ---------------------------------------------------------------------------

export interface JamesPredictionRaw {
  // ── Identity ──────────────────────────────────────────────────────────────

  /**
   * MMSI echoed from the request — CONFIRMED always present (James 2026-06-03).
   * 9-digit string. Used by the mapper to verify the response matches the request.
   */
  mmsi: string;

  /**
   * Model version string — NOT stable yet.
   * James has not committed to a format. May be absent, a file path, or a hash.
   * Mapper synthesises a version from `generated_at` if absent.
   * @not-stable
   */
  model_version?: string;

  /**
   * Inference wall-clock time — may be present.
   * Format varies; mapper normalises to ISO 8601.
   * @provisional
   */
  generated_at?: string | number;

  // ── Prediction results — CONFIRMED shape ─────────────────────────────────

  /** CONFIRMED STABLE container. See JamesResults. */
  results: JamesResults;

  /** Forward-compat: absorbs any top-level keys not yet in this type. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Post-validation type (guaranteed shape after james-raw-schema.ts validates)
// ---------------------------------------------------------------------------

/**
 * JamesPredictionRawValidated
 *
 * Output type of validateJamesResponse(). After validation passes, the mapper
 * can safely access all fields typed as non-optional here.
 *
 * Currently: same as JamesPredictionRaw (all confirmed fields are already
 * non-optional). Kept as a distinct type so the mapper's type signature is
 * explicit about what has been validated.
 */
export type JamesPredictionRawValidated = JamesPredictionRaw;
