/**
 * MockPredictionAdapter — DenkKern
 *
 * Returns PredictionOutput from the seed JSON file at
 * mock/cases/:caseId/prediction.json.
 *
 * This adapter is used when:
 *   - JAMES_API_URL is not set (dev / demo mode)
 *   - JAMES_FALLBACK_ENABLED=true and the live API call fails
 *
 * It bypasses the mapper entirely — seed data is already normalised
 * (or goes through normalizeMinimalPrediction at read time, matching
 * the behaviour of the original MockDataAdapter.getPrediction()).
 *
 * MMSI and other context fields are accepted but ignored.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  normalizeMinimalPrediction,
  type PredictionOutput,
  type PredictionOutputMinimal,
} from '@denkkern/types';
import type { PredictionAdapterPort, PredictionRequestContext } from './port.js';

// ---------------------------------------------------------------------------
// Case ID resolution
// ---------------------------------------------------------------------------

/**
 * Maps shipmentId → caseId for the mock dataset.
 * In dev, these are decoupled: SHIP-001 lives in CASE-001.
 *
 * TODO: replace with a real lookup when multi-case support is added.
 */
const SHIPMENT_TO_CASE: Record<string, string> = {
  'SHIP-001': 'CASE-001',
};

function caseIdForShipment(shipmentId: string): string {
  const caseId = SHIPMENT_TO_CASE[shipmentId];
  if (caseId === undefined) {
    throw new Error(
      `MockPredictionAdapter: no mock case found for shipment '${shipmentId}'`
    );
  }
  return caseId;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class MockPredictionAdapter implements PredictionAdapterPort {
  readonly #basePath: string;

  /**
   * @param basePath  Absolute path to the monorepo root (contains mock/).
   *                  Defaults to process.cwd() — correct when running from root.
   *                  Pass process.env['MOCK_ROOT'] when cwd is apps/web/.
   */
  constructor(basePath?: string) {
    this.#basePath = basePath ?? process.cwd();
  }

  async getPrediction(
    shipmentId: string,
    _context?: PredictionRequestContext
  ): Promise<PredictionOutput> {
    const caseId = caseIdForShipment(shipmentId);
    const filePath = join(this.#basePath, 'mock', 'cases', caseId, 'prediction.json');
    const raw = readFileSync(filePath, 'utf-8');

    // Seed may be full PredictionOutput or PredictionOutputMinimal.
    // normalizeMinimalPrediction() is idempotent for full output.
    const data = JSON.parse(raw) as
      (PredictionOutput | PredictionOutputMinimal) & { _comment?: string };

    const { _comment: _, ...seed } = data;
    return normalizeMinimalPrediction(
      seed as PredictionOutput | PredictionOutputMinimal
    );
  }
}
