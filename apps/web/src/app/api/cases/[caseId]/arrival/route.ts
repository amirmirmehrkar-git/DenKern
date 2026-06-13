/**
 * POST /api/cases/:caseId/arrival
 *
 * Records the actual vessel arrival date for a case that is in `outcome_pending`.
 *
 * This is DK-602 in the Decision Memory loop:
 *   DecisionRecord written → [arrival recorded] → Outcome draft possible
 *
 * ── What this endpoint does ──────────────────────────────────────────────────
 *   1. Validates the request body: { actual_arrival_date: ISO-8601 date string }
 *   2. Reads prediction.json to get eta.baseline (the original planned arrival)
 *   3. Computes actual_delay_days = diff(actual_arrival_date, eta.baseline)
 *      Positive = arrived late. Negative = arrived early.
 *   4. Writes arrival-event.json (immutable audit record of this event)
 *   5. Reads existing decision-record.json (never rebuilds it)
 *   6. Patches ONLY tracking.actual_arrival_date and tracking.actual_delay_days
 *   7. Writes the patched decision-record.json back with NTFS null-byte guard
 *
 * ── Immutability contract ─────────────────────────────────────────────────────
 *   Fields that are NEVER touched by this endpoint:
 *     context_snapshot, recommendation_shown, decision, fingerprint,
 *     id, case_id, schema_version, created_at, locked_at, outcome, execution
 *
 *   tracking.tracking_active stays true — it is set to false only by DK-604
 *   (confirm_outcome) when the outcome is confirmed.
 *
 * ── Error responses ──────────────────────────────────────────────────────────
 *   400 — missing or invalid actual_arrival_date
 *   404 — caseId not found (ENOENT on prediction.json or decision-record.json)
 *   409 — arrival already recorded (decision-record.json has actual_arrival_date)
 *   500 — NTFS guard failed or unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { DecisionRecord } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ArrivalRequestBody {
  actual_arrival_date: string;
  recorded_by?: string;
}

interface ArrivalEvent {
  event_type: 'arrival_recorded';
  case_id: string;
  recorded_at: string;
  recorded_by: string;
  actual_arrival_date: string;
  baseline_arrival_date: string;
  actual_delay_days: number;
}

interface ArrivalResponse {
  case_id: string;
  actual_arrival_date: string;
  baseline_arrival_date: string;
  actual_delay_days: number;
  tracking_active: boolean;
  recorded_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

function caseFilePath(caseId: string, filename: string): string {
  return join(mockRoot(), 'mock', 'cases', caseId, filename);
}

/**
 * Compute the signed day delta between two ISO-8601 date strings.
 * Returns positive when actual is after baseline (late arrival).
 * Returns negative when actual is before baseline (early arrival).
 */
function computeDayDelta(actualDate: string, baselineDate: string): number {
  const actual   = new Date(actualDate).getTime();
  const baseline = new Date(baselineDate).getTime();
  return Math.round((actual - baseline) / (1000 * 60 * 60 * 24));
}

/**
 * Validate that a string is a well-formed ISO-8601 date (YYYY-MM-DD or full datetime).
 */
function isValidIsoDate(value: string): boolean {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ArrivalResponse | { error: string; code?: string }>> {
  const { caseId } = params;

  // ── 1. Parse request body ─────────────────────────────────────────────────

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const { actual_arrival_date, recorded_by = 'operator' } =
    (body ?? {}) as Partial<ArrivalRequestBody>;

  if (!actual_arrival_date || typeof actual_arrival_date !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: actual_arrival_date.' },
      { status: 400 }
    );
  }

  if (!isValidIsoDate(actual_arrival_date)) {
    return NextResponse.json(
      {
        error: `Invalid actual_arrival_date: '${actual_arrival_date}'. ` +
               `Expected ISO-8601 date (e.g. '2026-07-01' or '2026-07-01T12:00:00Z').`,
      },
      { status: 400 }
    );
  }

  // ── 2. Read prediction.json for baseline ─────────────────────────────────

  const predictionPath = caseFilePath(caseId, 'prediction.json');

  if (!existsSync(predictionPath)) {
    return NextResponse.json(
      { error: `Case '${caseId}' not found.` },
      { status: 404 }
    );
  }

  let baselineArrivalDate: string;
  try {
    const prediction = JSON.parse(readFileSync(predictionPath, 'utf-8')) as {
      eta: { baseline: string };
    };
    baselineArrivalDate = prediction.eta.baseline;
  } catch (err) {
    console.error(`[DK-602] Failed to read prediction.json for ${caseId}:`, err);
    return NextResponse.json(
      { error: 'Internal server error: could not read prediction data.' },
      { status: 500 }
    );
  }

  // ── 3. Compute actual_delay_days ──────────────────────────────────────────

  const actualDelayDays = computeDayDelta(actual_arrival_date, baselineArrivalDate);

  // ── 4. Check for decision-record.json (must exist; check idempotency) ─────

  const decisionRecordPath = caseFilePath(caseId, 'decision-record.json');

  if (!existsSync(decisionRecordPath)) {
    return NextResponse.json(
      {
        error: `decision-record.json not found for case '${caseId}'. ` +
               `Ensure decision_confirmed was dispatched before recording arrival.`,
        code: 'DECISION_RECORD_MISSING',
      },
      { status: 404 }
    );
  }

  let existingRecord: DecisionRecord;
  try {
    existingRecord = JSON.parse(readFileSync(decisionRecordPath, 'utf-8')) as DecisionRecord;
  } catch (err) {
    console.error(`[DK-602] Failed to read decision-record.json for ${caseId}:`, err);
    return NextResponse.json(
      { error: 'Internal server error: could not read decision record.' },
      { status: 500 }
    );
  }

  // Idempotency guard: reject if arrival was already recorded.
  if (existingRecord.tracking.actual_arrival_date !== null) {
    return NextResponse.json(
      {
        error: `Arrival already recorded for case '${caseId}'. ` +
               `actual_arrival_date is '${existingRecord.tracking.actual_arrival_date}'.`,
        code: 'ARRIVAL_ALREADY_RECORDED',
      },
      { status: 409 }
    );
  }

  const recordedAt = new Date().toISOString();

  // ── 5. Write arrival-event.json (immutable audit record) ──────────────────

  const arrivalEvent: ArrivalEvent = {
    event_type:           'arrival_recorded',
    case_id:              caseId,
    recorded_at:          recordedAt,
    recorded_by:          recorded_by,
    actual_arrival_date:  actual_arrival_date,
    baseline_arrival_date: baselineArrivalDate,
    actual_delay_days:    actualDelayDays,
  };

  const arrivalEventPath = caseFilePath(caseId, 'arrival-event.json');

  try {
    writeFileSync(arrivalEventPath, JSON.stringify(arrivalEvent, null, 2), 'utf-8');
    // NTFS guard
    JSON.parse(readFileSync(arrivalEventPath, 'utf-8'));
  } catch (err) {
    console.error(`[DK-602] arrival-event.json write FAILED for ${caseId}:`, err);
    return NextResponse.json(
      { error: 'Internal server error: arrival event write failed.' },
      { status: 500 }
    );
  }

  // ── 6. Patch ONLY tracking fields — do NOT rebuild the record ─────────────
  //
  // Immutability contract:
  //   - context_snapshot, recommendation_shown, decision, fingerprint are untouched
  //   - tracking.tracking_active stays true (set false only by DK-604)
  //   - outcome and execution remain as-is

  const patchedRecord: DecisionRecord = {
    ...existingRecord,
    tracking: {
      ...existingRecord.tracking,
      actual_arrival_date: actual_arrival_date,
      actual_delay_days:   actualDelayDays,
      // tracking_active stays true — vessel has arrived but outcome not yet confirmed
    },
  };

  // ── 7. Write back with NTFS null-byte guard ───────────────────────────────

  try {
    const serialized = JSON.stringify(patchedRecord, null, 2);
    writeFileSync(decisionRecordPath, serialized, 'utf-8');
    // NTFS guard: immediately read back and parse
    JSON.parse(readFileSync(decisionRecordPath, 'utf-8'));
  } catch (err) {
    console.error(`[DK-602] decision-record.json patch write FAILED for ${caseId}:`, err);
    return NextResponse.json(
      { error: 'Internal server error: decision record patch write failed.' },
      { status: 500 }
    );
  }

  console.log(
    `[DK-602] Arrival recorded ✓  case=${caseId}  ` +
    `actual=${actual_arrival_date}  baseline=${baselineArrivalDate}  ` +
    `delay=${actualDelayDays}d  by=${recorded_by}`
  );

  // ── 8. Return the updated tracking summary ────────────────────────────────

  const response: ArrivalResponse = {
    case_id:              caseId,
    actual_arrival_date:  actual_arrival_date,
    baseline_arrival_date: baselineArrivalDate,
    actual_delay_days:    actualDelayDays,
    tracking_active:      patchedRecord.tracking.tracking_active,
    recorded_at:          recordedAt,
  };

  return NextResponse.json(response, { status: 200 });
}
