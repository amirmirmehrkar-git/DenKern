/**
 * JamesHTTPAdapter — DenkKern
 *
 * Calls James' FastAPI prediction endpoint with an MMSI, maps the raw
 * response to PredictionOutput, and handles fallback logic.
 *
 * Fallback layers (sprint-3-plan.md §5):
 *   1. No JAMES_API_URL       → use MockPredictionAdapter (factory handles this — never reaches here)
 *   2. API error + fallback   → log warning, return MockPredictionAdapter result
 *   3. API error + no fallback → throw PredictionUnavailableError (caller returns 503)
 *   4. Invalid response body  → throw JamesResponseInvalidError (always hard fail, never silently fallback)
 *
 * Source of truth: docs/architecture/sprint-3-plan.md §4
 */

import { normalizeMinimalPrediction, type PredictionOutput } from '@denkkern/types';
import type { PredictionAdapterPort, PredictionRequestContext } from './port.js';
import type { MockPredictionAdapter } from './mock-prediction-adapter.js';
import { mapJamesRawToMinimal } from './mapper.js';
import { validateJamesResponse, JamesResponseValidationError } from './james-raw-schema.js';
import {
  MissingMmsiError,
  PredictionUnavailableError,
  JamesResponseInvalidError,
} from './errors.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface JamesHTTPAdapterConfig {
  /** Full base URL of James' FastAPI, e.g. "http://localhost:8000" */
  apiUrl: string;
  /** HTTP request timeout in milliseconds. Default: 5000. */
  timeoutMs?: number;
  /** If true, fall back to mock on API failure. If false, throw. */
  fallbackEnabled: boolean;
  /** Fallback adapter instance — used when fallbackEnabled=true and call fails. */
  fallback: MockPredictionAdapter;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class JamesHTTPAdapter implements PredictionAdapterPort {
  readonly #config: Required<JamesHTTPAdapterConfig>;

  constructor(config: JamesHTTPAdapterConfig) {
    this.#config = {
      timeoutMs: 5_000,
      ...config,
    };
  }

  async getPrediction(
    shipmentId: string,
    context?: PredictionRequestContext
  ): Promise<PredictionOutput> {
    // ── Guard: MMSI required ─────────────────────────────────────────────────
    const mmsi = context?.mmsi;
    if (mmsi === undefined || mmsi.trim() === '') {
      if (this.#config.fallbackEnabled) {
        console.warn(
          `[prediction-adapter] MMSI missing for '${shipmentId}' — falling back to mock.`
        );
        return this.#config.fallback.getPrediction(shipmentId, context);
      }
      throw new MissingMmsiError(shipmentId);
    }

    // ── HTTP call ────────────────────────────────────────────────────────────
    let responseBody: unknown;
    try {
      responseBody = await this.#callJamesApi(mmsi, context);
    } catch (err) {
      return this.#handleCallFailure(shipmentId, context, err);
    }

    // ── Validate response shape ───────────────────────────────────────────────
    let validated;
    try {
      validated = validateJamesResponse(responseBody);
    } catch (err) {
      // Validation errors are ALWAYS hard failures — never silently fallback.
      // A malformed 200 response must be investigated, not silently swallowed.
      const msg = err instanceof JamesResponseValidationError
        ? err.message
        : String(err);
      throw new JamesResponseInvalidError(shipmentId, msg);
    }

    // ── Map to minimal contract ───────────────────────────────────────────────
    const minimal = mapJamesRawToMinimal(validated, context ?? {}, shipmentId);

    // ── Normalise to full PredictionOutput ────────────────────────────────────
    // normalizeMinimalPrediction() fills ETA envelope, model_version, etc.
    // required_by is passed as knownBaseline so ETA dates are anchored correctly.
    return normalizeMinimalPrediction(minimal, context?.required_by);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  async #callJamesApi(
    mmsi: string,
    context: PredictionRequestContext | undefined
  ): Promise<unknown> {
    const url = `${this.#config.apiUrl}/predict`;

    const body = {
      mmsi,
      // TODO(james-contract): Confirm the exact request body fields James expects.
      // Sprint 3 plan §3.2 assumes: { mmsi, baseline_transit_hours?, required_by? }
      // James may use different field names (e.g. "vessel_mmsi", "eta_baseline").
      ...(context?.baseline_transit_hours !== undefined
        ? { baseline_transit_hours: context.baseline_transit_hours }
        : {}),
      ...(context?.required_by !== undefined
        ? { required_by: context.required_by }
        : {}),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.#config.timeoutMs
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `James API returned HTTP ${response.status} ${response.statusText}`
        );
      }

      return await response.json() as unknown;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  #handleCallFailure(
    shipmentId: string,
    context: PredictionRequestContext | undefined,
    err: unknown
  ): Promise<PredictionOutput> {
    if (this.#config.fallbackEnabled) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[prediction-adapter] James API call failed for '${shipmentId}' ` +
        `(${reason}) — falling back to mock. Set JAMES_FALLBACK_ENABLED=false ` +
        `to hard-fail instead.`
      );
      return this.#config.fallback.getPrediction(shipmentId, context);
    }

    throw new PredictionUnavailableError(shipmentId, err);
  }
}
