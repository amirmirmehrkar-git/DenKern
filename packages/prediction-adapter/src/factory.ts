/**
 * PredictionAdapterFactory — DenkKern
 *
 * Creates the correct PredictionAdapterPort implementation based on
 * environment configuration. This is the ONLY place that reads
 * JAMES_API_URL and JAMES_FALLBACK_ENABLED.
 *
 * Decision table:
 *   JAMES_API_URL unset   → MockPredictionAdapter  (dev / demo mode)
 *   JAMES_API_URL set     → JamesHTTPAdapter
 *     JAMES_FALLBACK_ENABLED=true  → JamesHTTPAdapter with mock fallback
 *     JAMES_FALLBACK_ENABLED=false → JamesHTTPAdapter, hard-fail on errors
 *
 * Source of truth: docs/architecture/sprint-3-plan.md §4.4
 */

import { MockPredictionAdapter } from './mock-prediction-adapter.js';
import { JamesHTTPAdapter } from './james-http-adapter.js';
import type { PredictionAdapterPort } from './port.js';

// ---------------------------------------------------------------------------
// Config shape (read from process.env by createPredictionAdapter)
// ---------------------------------------------------------------------------

export interface PredictionAdapterEnvConfig {
  /** James FastAPI base URL. Unset = mock mode. */
  JAMES_API_URL?: string;
  /** "true" = fall back to mock on API failure. Default: "false". */
  JAMES_FALLBACK_ENABLED?: string;
  /** Request timeout in milliseconds as a string. Default: "5000". */
  JAMES_API_TIMEOUT_MS?: string;
  /** Absolute path to monorepo root — needed to locate mock/cases/ seed files. */
  MOCK_ROOT?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate PredictionAdapterPort for the current environment.
 *
 * Call once at module initialisation (e.g. in the adapter factory singleton).
 * The returned instance is safe to cache for the process lifetime.
 *
 * @param env  Defaults to process.env. Override in tests.
 */
export function createPredictionAdapter(
  env: PredictionAdapterEnvConfig = process.env as PredictionAdapterEnvConfig
): PredictionAdapterPort {
  const apiUrl = env.JAMES_API_URL;
  const mockRoot = env.MOCK_ROOT;

  // ── No API URL → pure mock mode ──────────────────────────────────────────
  if (apiUrl === undefined || apiUrl.trim() === '') {
    return new MockPredictionAdapter(mockRoot);
  }

  // ── API URL set → live mode with optional fallback ────────────────────────
  const fallbackEnabled = env.JAMES_FALLBACK_ENABLED === 'true';
  const timeoutMs = env.JAMES_API_TIMEOUT_MS !== undefined
    ? Number(env.JAMES_API_TIMEOUT_MS)
    : 5_000;

  const fallback = new MockPredictionAdapter(mockRoot);

  return new JamesHTTPAdapter({
    apiUrl: apiUrl.trim(),
    timeoutMs,
    fallbackEnabled,
    fallback,
  });
}
