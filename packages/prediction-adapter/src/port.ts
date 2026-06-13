/**
 * PredictionAdapterPort — DenkKern
 *
 * The adapter contract for obtaining a PredictionOutput for a given shipment.
 *
 * This interface is the only coupling point between the orchestration layer
 * and the prediction source. Both the mock adapter (seed JSON) and the live
 * James HTTP adapter implement it. No if(mock) branches exist anywhere else.
 *
 * Source of truth: docs/architecture/sprint-3-plan.md §4
 */

import type { PredictionOutput } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Input context
// ---------------------------------------------------------------------------

/**
 * Context passed alongside shipmentId so the adapter can build the James
 * request and derive delay arithmetic without accessing global state.
 *
 * All fields are optional — the mock adapter ignores them.
 * JamesHTTPAdapter requires mmsi; it throws MissingMmsiError if absent.
 */
export interface PredictionRequestContext {
  /**
   * Maritime Mobile Service Identity — 9-digit vessel identifier.
   * Manually entered by operator for Sprint 3 pilot.
   * Required by JamesHTTPAdapter; ignored by MockPredictionAdapter.
   */
  mmsi?: string;

  /**
   * Contracted baseline arrival date (ISO date, e.g. "2026-05-28").
   * Used to derive expected_delay_days from James' ETA output.
   * Falls back to today if absent (logs a warning).
   */
  required_by?: string;

  /**
   * Operator's known baseline transit duration in hours.
   * Sent to James so the model can compute delay delta against a consistent baseline.
   * Optional — James may derive this from historical data if absent.
   */
  baseline_transit_hours?: number;
}

// ---------------------------------------------------------------------------
// Adapter port
// ---------------------------------------------------------------------------

export interface PredictionAdapterPort {
  /**
   * Return a normalised PredictionOutput for the given shipment.
   *
   * Implementations MUST:
   *   - Always return a full PredictionOutput (never PredictionOutputMinimal).
   *   - Always call normalizeMinimalPrediction() at their boundary.
   *   - Never throw on James API errors when fallback is enabled — return
   *     a fallback PredictionOutput instead and set prediction_source accordingly.
   *
   * @param shipmentId  The DenkKern shipment identifier (e.g. "SHIP-001").
   * @param context     Optional adapter context (MMSI, baseline dates, etc.).
   */
  getPrediction(
    shipmentId: string,
    context?: PredictionRequestContext
  ): Promise<PredictionOutput>;
}
