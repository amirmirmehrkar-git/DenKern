/**
 * Outcome Confirmer -- DenkKern DK-604
 *
 * Accepts operator confirmation data, reads outcome-draft.json, builds the
 * final OutcomeRecord, and patches it into decision-record.json.
 *
 * Also sets tracking.tracking_active = false (vessel tracking complete).
 *
 * IMMUTABILITY CONTRACT
 *   Writes only:
 *     decision-record.json.outcome          -- new OutcomeRecord
 *     decision-record.json.tracking.tracking_active -- false
 *   Never touches:
 *     context_snapshot, recommendation_shown, decision, fingerprint,
 *     id, case_id, schema_version, created_at, locked_at
 *
 * Caller is responsible for advancing workflow state to outcome_confirmed
 * (done in the route handler after this function returns successfully).
 *
 * NTFS null-byte guard: write -> readFileSync -> JSON.parse after every write.
 *
 * Invoked by: POST /api/cases/:caseId/confirm-outcome
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  DecisionRecord,
  OutcomeRecord,
  OutcomeDraft,
  ProductionImpact,
  DecisionQuality,
  PredictionAccuracyAssessment,
} from '@denkkern/types';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

function caseFilePath(caseId: string, filename: string): string {
  return join(mockRoot(), 'mock', 'cases', caseId, filename);
}

// ---------------------------------------------------------------------------
// Public input shape
// ---------------------------------------------------------------------------

export interface OutcomeConfirmationInput {
  confirmed_by: string;
  confirmation_channel?: string;         // defaults to 'api'
  production_impact: ProductionImpact;
  decision_quality: DecisionQuality;
  actual_cost_eur?: number;              // optional override; uses draft value if absent
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCaseJson<T>(caseId: string, filename: string): T {
  const raw = readFileSync(caseFilePath(caseId, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

/**
 * Classify prediction accuracy from the signed day error.
 *   ACCURATE       -- |error| <= 2 days
 *   OVERESTIMATED  -- arrived earlier than predicted (error < -2)
 *   UNDERESTIMATED -- arrived later than predicted  (error > +2)
 */
function assessAccuracy(predictionErrorDays: number): PredictionAccuracyAssessment {
  if (Math.abs(predictionErrorDays) <= 2) return 'ACCURATE';
  if (predictionErrorDays < 0)            return 'OVERESTIMATED';
  return 'UNDERESTIMATED';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the OutcomeRecord from draft + confirmation input, and patch it
 * into decision-record.json alongside setting tracking_active = false.
 *
 * @returns the patched DecisionRecord (as written to disk)
 * @throws if prerequisites are missing, JSON is invalid, or NTFS guard fails
 */
export function confirmOutcome(
  caseId: string,
  input: OutcomeConfirmationInput
): DecisionRecord {
  // ── 1. Guard: prerequisites ──────────────────────────────────────────────

  const decisionRecordPath = caseFilePath(caseId, 'decision-record.json');
  const outcomeDraftPath   = caseFilePath(caseId, 'outcome-draft.json');

  if (!existsSync(decisionRecordPath)) {
    throw new Error(
      `[DK-604] decision-record.json not found for case ${caseId}.`
    );
  }

  if (!existsSync(outcomeDraftPath)) {
    throw new Error(
      `[DK-604] outcome-draft.json not found for case ${caseId}. ` +
      `Run DK-603 (generate outcome draft) before confirming.`
    );
  }

  // ── 2. Read sources ───────────────────────────────────────────────────────

  const existingRecord = readCaseJson<DecisionRecord>(caseId, 'decision-record.json');
  const draft          = readCaseJson<OutcomeDraft>(caseId, 'outcome-draft.json');

  // ── 3. Idempotency guard ──────────────────────────────────────────────────

  if (existingRecord.outcome !== null) {
    throw new Error(
      `[DK-604] Outcome already confirmed for case ${caseId}. ` +
      `confirmed_at=${existingRecord.outcome.confirmed_at}. ` +
      `Use a new case or reset the mock to re-run.`
    );
  }

  // ── 4. Resolve cost fields ────────────────────────────────────────────────
  //
  // Operator may override actual_cost_eur (e.g. final invoice differs from estimate).
  // If overridden, recompute estimated_cost_avoided_eur from the draft's wait_cost.

  const actualCostEur =
    input.actual_cost_eur !== undefined
      ? input.actual_cost_eur
      : draft.actual_cost_eur;

  const estimatedCostAvoidedEur =
    input.actual_cost_eur !== undefined
      ? draft.wait_cost_eur - input.actual_cost_eur
      : draft.estimated_cost_avoided_eur;

  // ── 5. Build the OutcomeRecord ────────────────────────────────────────────

  const confirmedAt = new Date().toISOString();

  const outcomeRecord: OutcomeRecord = {
    status:               'confirmed',
    confirmed_at:         confirmedAt,
    confirmed_by:         input.confirmed_by,
    confirmation_channel: input.confirmation_channel ?? 'api',
    is_auto_generated:    false,

    // Carried from draft (system-computed)
    actual_arrival_date:    draft.actual_arrival_date,
    prediction_error_days:  draft.prediction_error_days,
    actual_delay_days:      draft.actual_delay_days,

    // Human-confirmed or human-overridden cost
    actual_cost_eur:             actualCostEur,
    estimated_cost_avoided_eur:  estimatedCostAvoidedEur,

    // Human-confirmed
    production_impact: input.production_impact,
    decision_quality:  input.decision_quality,

    // System-computed at confirmation time
    prediction_accuracy_assessment: assessAccuracy(draft.prediction_error_days),

    notes: input.notes ?? null,
  };

  // ── 6. Patch decision-record.json -- outcome + tracking ───────────────────
  //
  // Immutability: only outcome and tracking.tracking_active are changed.

  const patchedRecord: DecisionRecord = {
    ...existingRecord,
    tracking: {
      ...existingRecord.tracking,
      tracking_active: false,            // vessel has arrived; tracking complete
    },
    outcome: outcomeRecord,
  };

  // ── 7. Write with NTFS null-byte guard ───────────────────────────────────

  const serialized = JSON.stringify(patchedRecord, null, 2);
  writeFileSync(decisionRecordPath, serialized, 'utf-8');
  JSON.parse(readFileSync(decisionRecordPath, 'utf-8')); // NTFS guard

  console.log(
    `[DK-604] OutcomeRecord confirmed and written ✓  case=${caseId}  ` +
    `confirmed_by=${input.confirmed_by}  quality=${input.decision_quality}  ` +
    `accuracy=${outcomeRecord.prediction_accuracy_assessment}  ` +
    `cost_avoided=EUR ${estimatedCostAvoidedEur.toLocaleString()}`
  );

  return patchedRecord;
}
