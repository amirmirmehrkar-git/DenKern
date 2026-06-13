/**
 * james-raw-schema.ts — DenkKern internal
 *
 * Runtime structural validation of James' raw HTTP response.
 *
 * CONFIRMED STABLE fields validated here (James 2026-06-03):
 *   results.arrival_time.mean   — must be a non-empty string or positive number
 *   results.eta_prediction.mean_hours — must be a finite positive number
 *   mmsi                        — must be a non-empty string
 *
 * When a previously optional field is confirmed, add validation below.
 * Do NOT change port.ts, mapper.ts, or the adapters when updating this file.
 *
 * NOTE: We use a lightweight hand-written validator to keep the package
 * dependency-free. Swap for Zod when the full contract is stable.
 *
 * INTERNAL — not exported from package public API.
 */

import type { JamesPredictionRawValidated } from './james-raw.js';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class JamesResponseValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`James response validation failed at '${field}': ${message}`);
    this.name = 'JamesResponseValidationError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new JamesResponseValidationError(
      path,
      `expected object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`
    );
  }
  return value as Record<string, unknown>;
}

function assertString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new JamesResponseValidationError(
      path,
      `expected non-empty string, got ${JSON.stringify(value)}`
    );
  }
  return value;
}

function assertStringOrPositiveNumber(value: unknown, path: string): string | number {
  if (typeof value === 'string' && value.trim() !== '') return value;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  throw new JamesResponseValidationError(
    path,
    `expected non-empty string or positive finite number, got ${JSON.stringify(value)}`
  );
}

function assertFinitePositiveNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new JamesResponseValidationError(
      path,
      `expected finite positive number, got ${JSON.stringify(value)}`
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate that a raw JSON response from James has the confirmed stable shape.
 *
 * Validates:
 *   - Top-level object with mmsi and results
 *   - results.arrival_time.mean is a non-empty string or positive number
 *   - results.eta_prediction.mean_hours is a finite positive number
 *
 * Does NOT validate:
 *   - model_version (not stable — optional)
 *   - generated_at (provisional — optional)
 *   - MC fields (not reliable — optional)
 *   - intermediate_stops / harbor_congestion (in-progress — ignored)
 *
 * @throws JamesResponseValidationError on any structural violation.
 */
export function validateJamesResponse(raw: unknown): JamesPredictionRawValidated {
  // ── Top-level object ─────────────────────────────────────────────────────
  const top = assertObject(raw, '<root>');

  // ── mmsi — CONFIRMED always present ─────────────────────────────────────
  assertString(top['mmsi'], 'mmsi');

  // ── results — CONFIRMED container ────────────────────────────────────────
  const results = assertObject(top['results'], 'results');

  // ── results.arrival_time — CONFIRMED ─────────────────────────────────────
  const arrivalTime = assertObject(results['arrival_time'], 'results.arrival_time');
  assertStringOrPositiveNumber(arrivalTime['mean'], 'results.arrival_time.mean');

  // ── results.eta_prediction — CONFIRMED ────────────────────────────────────
  const etaPrediction = assertObject(results['eta_prediction'], 'results.eta_prediction');
  assertFinitePositiveNumber(etaPrediction['mean_hours'], 'results.eta_prediction.mean_hours');

  // All confirmed fields present and valid.
  return top as unknown as JamesPredictionRawValidated;
}
