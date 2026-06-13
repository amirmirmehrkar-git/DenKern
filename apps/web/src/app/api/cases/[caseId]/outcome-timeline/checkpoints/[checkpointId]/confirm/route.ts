/**
 * POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/confirm
 *
 * Confirms a checkpoint — the recipient has provided their outcome data.
 * Transitions the checkpoint to 'confirmed' (terminal).
 *
 * Valid from any non-terminal status: pending, sent, reminder_1, reminder_2, reminder_3.
 * Confirmation can arrive at any point in the reminder lifecycle.
 *
 * Request body:
 *   {
 *     "confirmed_by": string,            // required — user_id of the confirming person
 *     "outcome_data": Record<string, unknown>  // required — free-form outcome facts
 *   }
 *
 * The shape of outcome_data is dimension-specific and UI-validated.
 * The adapter stores it as-is without further schema enforcement.
 *
 * This endpoint does NOT touch DecisionRecord or OutcomeRecord.
 * Checkpoint facts are separate from Decision Quality.
 *
 * Error responses:
 *   400 — missing or invalid request body fields
 *   404 — caseId not found, or timeline not initialized, or checkpoint not found
 *   409 — checkpoint is already in a terminal state ('confirmed' or 'unresolved')
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../../../../lib/adapters/index.js';
import type { MockDataAdapter } from '@denkkern/mock';
import type { OutcomeCheckpoint } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string; checkpointId: string };
}

interface ConfirmCheckpointResponse {
  case_id: string;
  checkpoint: OutcomeCheckpoint;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ConfirmCheckpointResponse | { error: string; code?: string }>> {
  const { caseId, checkpointId } = params;

  // 1. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const b = (body ?? {}) as Record<string, unknown>;

  if (!b['confirmed_by'] || typeof b['confirmed_by'] !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: confirmed_by (string).' },
      { status: 400 }
    );
  }

  if (
    b['outcome_data'] === undefined ||
    b['outcome_data'] === null ||
    typeof b['outcome_data'] !== 'object' ||
    Array.isArray(b['outcome_data'])
  ) {
    return NextResponse.json(
      { error: 'Missing required field: outcome_data (object).' },
      { status: 400 }
    );
  }

  // 2. Confirm checkpoint via adapter
  try {
    const adapter = getAdapter() as unknown as MockDataAdapter;
    const checkpoint = await adapter.confirmCheckpoint(
      caseId,
      checkpointId,
      b['confirmed_by'] as string,
      b['outcome_data'] as Record<string, unknown>
    );

    return NextResponse.json(
      { case_id: caseId, checkpoint },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof Error) {
      const msg = err.message;

      // Timeline not found
      if (msg.includes('ENOENT') || (msg.includes('not found') && msg.includes('timeline'))) {
        return NextResponse.json(
          { error: msg, code: 'TIMELINE_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Checkpoint not found in the timeline
      if (msg.includes('not found in timeline')) {
        return NextResponse.json(
          { error: msg, code: 'CHECKPOINT_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Terminal state conflict (confirmed or unresolved)
      if (msg.includes('terminal')) {
        return NextResponse.json(
          { error: msg, code: 'TERMINAL_STATE' },
          { status: 409 }
        );
      }
    }

    console.error(
      `[POST /api/cases/${caseId}/outcome-timeline/checkpoints/${checkpointId}/confirm]`,
      err
    );
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
