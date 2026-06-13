/**
 * POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/mark-unresolved
 *
 * Forces a checkpoint to 'unresolved' (terminal) without waiting for reminder_3.
 * Used by supervisors or the UI "Mark unresolved" action.
 *
 * Idempotent if already 'unresolved' — returns the checkpoint unchanged with HTTP 200.
 *
 * No request body required.
 *
 * This endpoint does NOT touch DecisionRecord or OutcomeRecord.
 *
 * Error responses:
 *   404 — caseId not found, or timeline not initialized, or checkpoint not found
 *   409 — checkpoint is already 'confirmed' (terminal — cannot unmark a confirmation)
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../../../../lib/adapters/index.js';
import type { MockDataAdapter } from '@denkkern/mock';
import type { OutcomeCheckpoint } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string; checkpointId: string };
}

interface MarkUnresolvedResponse {
  case_id: string;
  checkpoint: OutcomeCheckpoint;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<MarkUnresolvedResponse | { error: string; code?: string }>> {
  const { caseId, checkpointId } = params;

  try {
    const adapter = getAdapter() as unknown as MockDataAdapter;
    const checkpoint = await adapter.markCheckpointUnresolved(caseId, checkpointId);

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

      // Already confirmed — cannot downgrade
      if (msg.includes("already 'confirmed'")) {
        return NextResponse.json(
          { error: msg, code: 'TERMINAL_STATE' },
          { status: 409 }
        );
      }
    }

    console.error(
      `[POST /api/cases/${caseId}/outcome-timeline/checkpoints/${checkpointId}/mark-unresolved]`,
      err
    );
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
