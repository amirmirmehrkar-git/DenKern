/**
 * mapper.ts — DenkKern internal
 *
 * Maps James' raw prediction response to PredictionOutputMinimal.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  THIS IS THE ONLY FILE THAT READS JAMES' RAW RESPONSE FIELDS.       ║
 * ║  All other adapter files are shielded from the raw response shape.  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * CONFIRMED STABLE field mappings (James 2026-06-03):
 *   results.arrival_time.mean      → ETA → expected_delay_days
 *   results.eta_prediction.mean_hours → transit duration (informational)
 *   mmsi                           → shipment_id passthrough
 *
 * PRELIMINARY (accepted if present, never required):
 *   results.arrival_time.std        → variance_days (MC — not reliable yet)
 *   results.eta_prediction.std_hours → used for gaussianPDelayOver3Days if present
 *   results.eta_prediction.confidence → confidence_score if present
 *
 * NOT STABLE — synthesised by adapter:
 *   model_version  → "james-gnn-<YYYYMMDD>" derived from generated_at
 *
 * INTERNAL — not exported from package public API.
 *
 * Source of truth: docs/architecture/sprint-3-plan.md §4.2
 */

import type { PredictionOutputMinimal } from '@denkkern/types';
import type { JamesPredictionRawValidated } from './james-raw.js';
import type { PredictionRequestContext } from './port.js';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MapperError extends Error {
  constructor(message: string) {
    super(`[prediction-adapter/mapper] ${message}`);
    this.name = 'MapperError';
  }
}

// ---------------------------------------------------------------------------
// ETA date normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise James' arrival_time.mean to a YYYY-MM-DD string.
 *
 * Handles:
 *   - ISO 8601 date string: "2026-05-31" or "2026-05-31T12:00:00Z"
 *   - Epoch milliseconds: 1748649600000 (positive number)
 *
 * Throws MapperError if the value cannot be parsed to a valid date.
 */
function normaliseEtaDate(raw: string | number): string {
  let date: Date;

  if (typeof raw === 'number') {
    date = new Date(raw);
  } else {
    // ISO string — may include time component
    date = new Date(raw);
  }

  if (isNaN(date.getTime())) {
    throw new MapperError(
      `Cannot parse results.arrival_time.mean as a date: ${JSON.stringify(raw)}`
    );
  }

  // Return YYYY-MM-DD (UTC date, matches the ISO date convention used throughout)
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Delay arithmetic
// ---------------------------------------------------------------------------

/**
 * Compute expected_delay_days = (james ETA date) − (DenkKern required_by date).
 *
 * Positive = arrival after required_by (delayed).
 * Negative = arrival before required_by (early).
 * Zero = on time.
 *
 * The scenario engine handles negative delay correctly (WAIT scores low).
 */
function computeDelayDays(etaDateStr: string, requiredBy: string): number {
  const eta = new Date(etaDateStr).getTime();
  const baseline = new Date(requiredBy).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((eta - baseline) / msPerDay);
}

// ---------------------------------------------------------------------------
// model_version synthesis (not stable — derived from generated_at)
// ---------------------------------------------------------------------------

/**
 * Synthesise a model version string when James does not provide one.
 *
 * Format: "james-gnn-<YYYYMMDD>" derived from generated_at or current date.
 * This is NOT a semantic version from James' model — it is an adapter-local
 * tracking label. Always labelled as synthesised in the assumptions log via
 * the normalizeMinimalPrediction extraFields path.
 */
function synthesiseModelVersion(generatedAt: string | number | undefined): string {
  const source = generatedAt !== undefined ? new Date(generatedAt) : new Date();
  const d = isNaN(source.getTime()) ? new Date() : source;
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `james-gnn-${dateStr}`;
}

// ---------------------------------------------------------------------------
// Today's date as YYYY-MM-DD (UTC)
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

/**
 * Map a validated James raw response to PredictionOutputMinimal.
 *
 * normalizeMinimalPrediction() is called by the adapter AFTER this function.
 * This function only produces the minimal scalar fields plus any extra fields
 * that should pass through to the full PredictionOutput via extraFields spread.
 *
 * @param raw         Validated raw response from James' API.
 * @param context     Caller-supplied context (required_by, baseline info).
 * @param shipmentId  DenkKern shipment ID — injected by the adapter.
 */
export function mapJamesRawToMinimal(
  raw: JamesPredictionRawValidated,
  context: PredictionRequestContext,
  shipmentId: string
): PredictionOutputMinimal & Record<string, unknown> {
  const { results } = raw;

  // ── ETA → expected_delay_days ────────────────────────────────────────────
  //
  // CONFIRMED: results.arrival_time.mean is the point-estimate ETA.
  // Normalise to YYYY-MM-DD, then compute delay vs required_by.
  //
  const etaDate = normaliseEtaDate(results.arrival_time.mean);
  const requiredBy = context.required_by ?? todayIso();
  const expected_delay_days = computeDelayDays(etaDate, requiredBy);

  // ── p_delay_over_3_days ──────────────────────────────────────────────────
  //
  // Path A: MC std_hours present and reasonable → Gaussian CDF
  //   results.eta_prediction.std_hours is PRELIMINARY — treat as optional.
  //   std_days = std_hours / 24
  //
  // Path B: std_hours absent → heuristic lookup table
  //
  const stdHours = results.eta_prediction.std_hours;
  const p_delay_over_3_days =
    typeof stdHours === 'number' && stdHours > 0
      ? gaussianPDelayOver3Days(expected_delay_days, stdHours / 24)
      : heuristicPDelayOver3Days(expected_delay_days);

  // ── confidence_score ─────────────────────────────────────────────────────
  //
  // Prefer results.eta_prediction.confidence if present (PRELIMINARY).
  // Fall back to heuristic derived from delay magnitude.
  //
  const jamesConfidence = results.eta_prediction.confidence;
  const confidence_score =
    typeof jamesConfidence === 'number' &&
    jamesConfidence >= 0 &&
    jamesConfidence <= 1
      ? jamesConfidence
      : fallbackConfidence(expected_delay_days);

  // ── Extra pass-through fields ─────────────────────────────────────────────
  //
  // These flow into the full PredictionOutput via normalizeMinimalPrediction's
  // extraFields spread. They do not affect scenario engine logic but are
  // preserved for audit purposes.
  //
  const model_version =
    typeof raw.model_version === 'string' && raw.model_version.trim() !== ''
      ? raw.model_version
      : synthesiseModelVersion(raw.generated_at);

  const generated_at =
    raw.generated_at !== undefined
      ? new Date(raw.generated_at).toISOString()
      : new Date().toISOString();

  // variance_days: PRELIMINARY — pass through if present for future Monte Carlo.
  const arrivalStd = results.arrival_time.std;
  const variance_days =
    typeof arrivalStd === 'number' && arrivalStd > 0
      ? arrivalStd / 24   // std in hours → days
      : undefined;

  return {
    shipment_id: shipmentId,
    expected_delay_days,
    p_delay_over_3_days,
    confidence_score,
    // Extra fields passed through to PredictionOutput
    model_version,
    generated_at,
    ...(variance_days !== undefined ? { delay: { variance_days } } : {}),
  };
}

// ---------------------------------------------------------------------------
// p_delay_over_3_days heuristic (Path B — used when MC std is absent)
// Documented in sprint-3-plan.md §4.3
// ---------------------------------------------------------------------------

/**
 * Deterministic lookup table for p_delay_over_3_days when MC std is unavailable.
 *
 * delay_days  | p_delay_over_3_days
 * < 0         | 0.05
 * 0           | 0.10
 * 1–2         | 0.30
 * 3           | 0.60
 * 4–5         | 0.80
 * > 5         | 0.90
 */
export function heuristicPDelayOver3Days(expected_delay_days: number): number {
  if (expected_delay_days < 0)   return 0.05;
  if (expected_delay_days === 0) return 0.10;
  if (expected_delay_days <= 2)  return 0.30;
  if (expected_delay_days === 3) return 0.60;
  if (expected_delay_days <= 5)  return 0.80;
  return 0.90;
}

// ---------------------------------------------------------------------------
// Gaussian CDF (Path A — used when MC std_hours is present)
// ---------------------------------------------------------------------------

/**
 * P(delay > threshold_days) given normally-distributed delay
 * with expected value mu_days and standard deviation sigma_days.
 *
 * Called with sigma_days = std_hours / 24 from results.eta_prediction.std_hours.
 */
export function gaussianPDelayOver3Days(
  mu_days: number,
  sigma_days: number,
  threshold_days = 3
): number {
  if (sigma_days <= 0) {
    return mu_days > threshold_days ? 1.0 : 0.0;
  }
  const z = (threshold_days - mu_days) / sigma_days;
  return 1 - standardNormalCdf(z);
}

/** Standard normal CDF — Abramowitz & Stegun §26.2.17 approximation. */
function standardNormalCdf(z: number): number {
  const sign = z >= 0 ? 1 : -1;
  const absZ = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * absZ);
  const poly =
    t * (0.319381530 +
    t * (-0.356563782 +
    t * (1.781477937 +
    t * (-1.821255978 +
    t * 1.330274429))));
  const pdf = Math.exp(-0.5 * absZ * absZ) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - pdf * poly;
  return sign === 1 ? cdf : 1 - cdf;
}

// ---------------------------------------------------------------------------
// Fallback confidence (used when James does not provide eta_prediction.confidence)
// ---------------------------------------------------------------------------

/**
 * Heuristic confidence score when James' MC confidence is unavailable.
 * Longer delays imply higher model uncertainty → lower confidence.
 */
function fallbackConfidence(expected_delay_days: number): number {
  if (expected_delay_days <= 0) return 0.85;
  if (expected_delay_days <= 2) return 0.75;
  if (expected_delay_days <= 4) return 0.65;
  if (expected_delay_days <= 7) return 0.55;
  return 0.45;
}
