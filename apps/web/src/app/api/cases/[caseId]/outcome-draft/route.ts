/**
 * POST /api/cases/:caseId/outcome-draft
 *
 * Auto-generates the outcome draft for a case that has completed arrival recording.
 *
 * This is DK-603 in the Decision Memory loop:
 *   DecisionRecord written → Arrival recorded → [Outcome draft generated] → Outcome confirmed
 *
 * ── What this endpoint does ──────────────────────────────────────────────────
 *   Reads: decision-record.json, arrival-event.json, prediction.json,
 *          scenario-evaluation.json
 *   Writes: outcome-draft.json
 *   Does NOT touch: decision-record.json (immutable fields OR outcome section)
 *
 * The outcome section of decision-record.json is written only by DK-604
 * (confirm_outcome) after the operator reviews this draft.
 *
 * ── Idempotency ───────────────────────────────────────────────────────────────
 *   Safe to call multiple times. Each call regenerates outcome-draft.json from
 *   the current source files (overwrite with no side effects on other records).
 *
 * ── Error responses ───────────────────────────────────────────────────────────
 *   404 — decision-record.json or arrival-event.json not found (prerequisites missing)
 *   500 — NTFS guard failed or unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateAndWriteOutcomeDraft } from '../../../../../lib/workflow/outcome-draft-generator.js';
import type { OutcomeDraft } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<OutcomeDraft | { error: string; code?: string }>> {
  const { caseId } = params;

  try {
    const draft = generateAndWriteOutcomeDraft(caseId);
    return NextResponse.json(draft, { status: 200 });
  } catch (err) {
    if (err instanceof Error) {
      // Prerequisite file missing
      if (err.message.includes('ENOENT') || err.message.includes('not found')) {
        return NextResponse.json(
          {
            error: err.message.replace(/^\[DK-603\] /, ''),
            code: 'PREREQUISITE_MISSING',
          },
          { status: 404 }
        );
      }
    }

    console.error('[POST /api/cases/:caseId/outcome-draft]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
