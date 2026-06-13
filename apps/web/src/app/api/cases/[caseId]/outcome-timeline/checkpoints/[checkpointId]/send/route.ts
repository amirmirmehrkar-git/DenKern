/**
 * POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/send
 *
 * Sends a checkpoint task notification to its recipient.
 * Transitions the checkpoint from 'pending' → 'sent'.
 *
 * In Sprint 7 this uses the mock adapter's sendCheckpointTask() which:
 *   - Updates checkpoint status to 'sent' on disk
 *   - Appends a mock outbound email entry (type: 'checkpoint_task')
 *   - No real email is sent
 *
 * No request body required.
 *
 * Error responses:
 *   404 — caseId not found, or timeline not initialized, or checkpoint not found
 *   409 — checkpoint is not in 'pending' status (lifecycle conflict)
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../../../../lib/adapters/index.js';
import type { MockDataAdapter } from '@denkkern/mock';
import type { OutcomeCheckpoint } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string; checkpointId: string };
}

interface SendCheckpointResponse {
  case_id: string;
  checkpoint: OutcomeCheckpoint;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<SendCheckpointResponse | { error: string; code?: string }>> {
  const { caseId, checkpointId } = params;

  try {
    const adapter = getAdapter() as unknown as MockDataAdapter;
    const checkpoint = await adapter.sendCheckpointTask(caseId, checkpointId);

    return NextResponse.json(
      { case_id: caseId, checkpoint },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof Error) {
      const msg = err.message;

      // Timeline not found (case missing or pre-decision)
      if (msg.includes('ENOENT') || msg.includes('not found') && msg.includes('timeline')) {
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

      // Status lifecycle conflict (not 'pending')
      if (msg.includes("expected 'pending'") || msg.includes('Cannot send checkpoint')) {
        return NextResponse.json(
          { error: msg, code: 'LIFECYCLE_CONFLICT' },
          { status: 409 }
        );
      }
    }

    console.error(`[POST /api/cases/${caseId}/outcome-timeline/checkpoints/${checkpointId}/send]`, err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
