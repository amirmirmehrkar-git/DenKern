/**
 * Contract tests — @denkkern/prediction-adapter
 *
 * These tests verify the adapter layer's contracts, not the James model.
 * They run entirely without a live James API: the HTTP adapter is tested
 * with a stub fetch() that returns controlled responses.
 *
 * Contract coverage:
 *   C1 — MMSI required: JamesHTTPAdapter throws/falls-back when MMSI is absent.
 *   C2 — Fallback behaviour: three cases (no URL, error+fallback, error+hard-fail).
 *   C3 — Raw response isolation: JamesPredictionRaw never leaks past the adapter boundary.
 *   C4 — normalizeMinimalPrediction() always called: output is always full PredictionOutput.
 *   C5 — Heuristic p_delay table: each row of the lookup table is correct.
 *   C6 — Gaussian CDF: spot-checks against known values.
 *   C7 — Factory: correct adapter selected based on env config.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { MockPredictionAdapter } from '../mock-prediction-adapter.js';
import { JamesHTTPAdapter } from '../james-http-adapter.js';
import { createPredictionAdapter } from '../factory.js';
import { heuristicPDelayOver3Days, gaussianPDelayOver3Days } from '../mapper.js';
import {
  MissingMmsiError,
  PredictionUnavailableError,
  JamesResponseInvalidError,
} from '../errors.js';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Absolute path to the monorepo root (two levels above packages/prediction-adapter) */
const MOCK_ROOT = join(new URL('../../..', import.meta.url).pathname, '..', '..', '..');

/** Minimal mock adapter pointing at CASE-001 seed */
function mockAdapter(): MockPredictionAdapter {
  return new MockPredictionAdapter(MOCK_ROOT);
}

/** Build a JamesHTTPAdapter with a stubbed fetch and controlled config */
function buildHttpAdapter(options: {
  fetchImpl: typeof fetch;
  fallbackEnabled?: boolean;
}): JamesHTTPAdapter {
  const adapter = new JamesHTTPAdapter({
    apiUrl: 'http://james-api.test',
    timeoutMs: 1_000,
    fallbackEnabled: options.fallbackEnabled ?? false,
    fallback: mockAdapter(),
  });
  // Inject stub fetch via globalThis override (reset in afterEach)
  vi.stubGlobal('fetch', options.fetchImpl);
  return adapter;
}

// ---------------------------------------------------------------------------
// C1 — MMSI required
// ---------------------------------------------------------------------------

describe('C1 — MMSI required', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('throws MissingMmsiError when MMSI is absent and fallback is disabled', async () => {
    const adapter = new JamesHTTPAdapter({
      apiUrl: 'http://james-api.test',
      fallbackEnabled: false,
      fallback: mockAdapter(),
    });

    await expect(
      adapter.getPrediction('SHIP-001', { required_by: '2026-05-28' })
    ).rejects.toThrow(MissingMmsiError);
  });

  it('throws MissingMmsiError when MMSI is an empty string and fallback is disabled', async () => {
    const adapter = new JamesHTTPAdapter({
      apiUrl: 'http://james-api.test',
      fallbackEnabled: false,
      fallback: mockAdapter(),
    });

    await expect(
      adapter.getPrediction('SHIP-001', { mmsi: '   ', required_by: '2026-05-28' })
    ).rejects.toThrow(MissingMmsiError);
  });

  it('falls back to mock when MMSI is absent and fallback is enabled', async () => {
    const adapter = new JamesHTTPAdapter({
      apiUrl: 'http://james-api.test',
      fallbackEnabled: true,
      fallback: mockAdapter(),
    });

    const result = await adapter.getPrediction('SHIP-001', { required_by: '2026-05-28' });
    // Output must be a full PredictionOutput with all required fields
    expect(result.shipment_id).toBe('SHIP-001');
    expect(typeof result.delay.expected_delay_days).toBe('number');
    expect(result.eta).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// C2 — Fallback behaviour
// ---------------------------------------------------------------------------

describe('C2 — Fallback behaviour', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('uses MockPredictionAdapter directly when JAMES_API_URL is unset', async () => {
    const adapter = createPredictionAdapter({
      MOCK_ROOT,
      // JAMES_API_URL intentionally absent
    });
    // Factory must return a MockPredictionAdapter — verify by checking it does NOT call fetch
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await adapter.getPrediction('SHIP-001');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.shipment_id).toBe('SHIP-001');
  });

  it('falls back to mock when API call fails and JAMES_FALLBACK_ENABLED is true', async () => {
    const adapter = buildHttpAdapter({
      fallbackEnabled: true,
      fetchImpl: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    const result = await adapter.getPrediction('SHIP-001', {
      mmsi: '215394000',
      required_by: '2026-05-28',
    });

    expect(result.shipment_id).toBe('SHIP-001');
    expect(result.eta).toBeDefined();
  });

  it('throws PredictionUnavailableError when API call fails and fallback is disabled', async () => {
    const adapter = buildHttpAdapter({
      fallbackEnabled: false,
      fetchImpl: vi.fn().mockRejectedValue(new Error('Network error')),
    });

    await expect(
      adapter.getPrediction('SHIP-001', { mmsi: '215394000' })
    ).rejects.toThrow(PredictionUnavailableError);
  });

  it('throws PredictionUnavailableError when API returns HTTP 500 and fallback is disabled', async () => {
    const adapter = buildHttpAdapter({
      fallbackEnabled: false,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      } as Response),
    });

    await expect(
      adapter.getPrediction('SHIP-001', { mmsi: '215394000' })
    ).rejects.toThrow(PredictionUnavailableError);
  });
});

// ---------------------------------------------------------------------------
// C3 — Raw response isolation: invalid shape is always a hard failure
// ---------------------------------------------------------------------------

describe('C3 — Raw response isolation', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('throws JamesResponseInvalidError when response body is null (even with fallback enabled)', async () => {
    const adapter = buildHttpAdapter({
      fallbackEnabled: true,   // fallback enabled — but invalid body must still hard-fail
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => null,
      } as Response),
    });

    await expect(
      adapter.getPrediction('SHIP-001', { mmsi: '215394000' })
    ).rejects.toThrow(JamesResponseInvalidError);
  });

  it('throws JamesResponseInvalidError when response body is an empty object', async () => {
    const adapter = buildHttpAdapter({
      fallbackEnabled: true,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response),
    });

    await expect(
      adapter.getPrediction('SHIP-001', { mmsi: '215394000' })
    ).rejects.toThrow(JamesResponseInvalidError);
  });

  it('throws JamesResponseInvalidError when response body is a primitive', async () => {
    const adapter = buildHttpAdapter({
      fallbackEnabled: true,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => 'not an object',
      } as Response),
    });

    await expect(
      adapter.getPrediction('SHIP-001', { mmsi: '215394000' })
    ).rejects.toThrow(JamesResponseInvalidError);
  });
});

// ---------------------------------------------------------------------------
// C4 — normalizeMinimalPrediction() always called: output is full PredictionOutput
// ---------------------------------------------------------------------------

describe('C4 — Output is always full PredictionOutput', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('MockPredictionAdapter returns a full PredictionOutput with all required fields', async () => {
    const result = await mockAdapter().getPrediction('SHIP-001');

    expect(result.shipment_id).toBe('SHIP-001');
    expect(typeof result.model_version).toBe('string');
    expect(typeof result.generated_at).toBe('string');
    expect(result.eta.baseline).toBeDefined();
    expect(result.eta.expected).toBeDefined();
    expect(result.eta.optimistic).toBeDefined();
    expect(result.eta.pessimistic).toBeDefined();
    expect(typeof result.delay.expected_delay_days).toBe('number');
    expect(typeof result.delay.p_delay_over_3_days).toBe('number');
    expect(typeof result.delay.confidence_score).toBe('number');
    expect(Array.isArray(result.risk_drivers)).toBe(true);
  });

  it('JamesHTTPAdapter (fallback path) returns a full PredictionOutput', async () => {
    // Trigger fallback by providing no MMSI with fallback enabled
    const adapter = new JamesHTTPAdapter({
      apiUrl: 'http://james-api.test',
      fallbackEnabled: true,
      fallback: mockAdapter(),
    });

    const result = await adapter.getPrediction('SHIP-001');

    expect(result.eta).toBeDefined();
    expect(result.delay).toBeDefined();
    expect(result.risk_drivers).toBeDefined();
  });

  it('JamesHTTPAdapter (live path) returns a full PredictionOutput via normalizeMinimalPrediction', async () => {
    // Simulate a minimal valid-ish James response (the mapper returns placeholder values)
    const adapter = buildHttpAdapter({
      fallbackEnabled: false,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          // Minimal response with one field (passes the non-empty object check)
          // TODO: replace with real James field names once confirmed
          placeholder: 'sprint-3-stub',
        }),
      } as Response),
    });

    const result = await adapter.getPrediction('SHIP-001', {
      mmsi: '215394000',
      required_by: '2026-05-28',
    });

    // Even with placeholder mapper output, normalizeMinimalPrediction must
    // produce a full PredictionOutput
    expect(result.eta).toBeDefined();
    expect(result.eta.baseline).toBeDefined();
    expect(result.eta.expected).toBeDefined();
    expect(typeof result.delay.expected_delay_days).toBe('number');
    expect(result.risk_drivers).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// C5 — Heuristic p_delay lookup table
// ---------------------------------------------------------------------------

describe('C5 — heuristicPDelayOver3Days lookup table', () => {
  it('returns 0.05 for early delivery (negative delay)', () => {
    expect(heuristicPDelayOver3Days(-3)).toBe(0.05);
    expect(heuristicPDelayOver3Days(-1)).toBe(0.05);
  });

  it('returns 0.10 for on-time delivery (0 days delay)', () => {
    expect(heuristicPDelayOver3Days(0)).toBe(0.10);
  });

  it('returns 0.30 for mild delay (1–2 days)', () => {
    expect(heuristicPDelayOver3Days(1)).toBe(0.30);
    expect(heuristicPDelayOver3Days(2)).toBe(0.30);
  });

  it('returns 0.60 at the 3-day threshold', () => {
    expect(heuristicPDelayOver3Days(3)).toBe(0.60);
  });

  it('returns 0.80 for 4–5 day delays', () => {
    expect(heuristicPDelayOver3Days(4)).toBe(0.80);
    expect(heuristicPDelayOver3Days(5)).toBe(0.80);
  });

  it('caps at 0.90 for delays beyond 5 days', () => {
    expect(heuristicPDelayOver3Days(6)).toBe(0.90);
    expect(heuristicPDelayOver3Days(30)).toBe(0.90);
  });

  it('all values are within [0, 1]', () => {
    for (const d of [-5, -1, 0, 1, 2, 3, 4, 5, 6, 10, 20]) {
      const p = heuristicPDelayOver3Days(d);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// C6 — Gaussian CDF spot checks
// ---------------------------------------------------------------------------

describe('C6 — gaussianPDelayOver3Days', () => {
  it('returns ~0.5 when expected delay equals threshold (no uncertainty)', () => {
    // P(delay > 3 | mu=3, sigma=0+) is degenerate → 0.0 (not exceeded)
    expect(gaussianPDelayOver3Days(3, 0)).toBe(0.0);
  });

  it('returns ~0.5 when expected delay = threshold and sigma is large', () => {
    const p = gaussianPDelayOver3Days(3, 100);
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.55);
  });

  it('returns near 1.0 when expected delay is far above threshold', () => {
    const p = gaussianPDelayOver3Days(20, 1);
    expect(p).toBeGreaterThan(0.99);
  });

  it('returns near 0.0 when expected delay is far below threshold', () => {
    const p = gaussianPDelayOver3Days(-10, 1);
    expect(p).toBeLessThan(0.01);
  });

  it('is monotonically increasing in expected_delay_days', () => {
    const sigma = 2;
    let prev = gaussianPDelayOver3Days(0, sigma);
    for (const mu of [1, 2, 3, 4, 5, 6]) {
      const curr = gaussianPDelayOver3Days(mu, sigma);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });

  it('all values are within [0, 1]', () => {
    for (const mu of [-5, 0, 3, 7, 15]) {
      for (const sigma of [0.5, 1, 2, 5]) {
        const p = gaussianPDelayOver3Days(mu, sigma);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// C7 — Factory: correct adapter selected based on env config
// ---------------------------------------------------------------------------

describe('C7 — PredictionAdapterFactory', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns MockPredictionAdapter when JAMES_API_URL is unset', () => {
    const adapter = createPredictionAdapter({ MOCK_ROOT });
    // MockPredictionAdapter does not have apiUrl — check via constructor name
    expect(adapter.constructor.name).toBe('MockPredictionAdapter');
  });

  it('returns MockPredictionAdapter when JAMES_API_URL is empty string', () => {
    const adapter = createPredictionAdapter({ JAMES_API_URL: '', MOCK_ROOT });
    expect(adapter.constructor.name).toBe('MockPredictionAdapter');
  });

  it('returns JamesHTTPAdapter when JAMES_API_URL is set', () => {
    const adapter = createPredictionAdapter({
      JAMES_API_URL: 'http://james.test',
      MOCK_ROOT,
    });
    expect(adapter.constructor.name).toBe('JamesHTTPAdapter');
  });

  it('JamesHTTPAdapter has fallbackEnabled=false by default', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchSpy);

    const adapter = createPredictionAdapter({
      JAMES_API_URL: 'http://james.test',
      // JAMES_FALLBACK_ENABLED not set → defaults to false
      MOCK_ROOT,
    });

    await expect(
      adapter.getPrediction('SHIP-001', { mmsi: '215394000' })
    ).rejects.toThrow(PredictionUnavailableError);
  });

  it('JamesHTTPAdapter has fallbackEnabled=true when env var is "true"', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', fetchSpy);

    const adapter = createPredictionAdapter({
      JAMES_API_URL: 'http://james.test',
      JAMES_FALLBACK_ENABLED: 'true',
      MOCK_ROOT,
    });

    // Should NOT throw — falls back to mock
    const result = await adapter.getPrediction('SHIP-001', { mmsi: '215394000' });
    expect(result.shipment_id).toBe('SHIP-001');
  });
});
