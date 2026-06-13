/**
 * POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/advance-reminder
 *
 * Advances the reminder lifecycle for a checkpoint that has not yet responded.
 *
 * Valid source → target transitions:
 *   sent       → reminder_1
 *   reminder_1 → reminder_2
 *   reminder_2 → reminder_3
 *   reminder_3 → unresolved  (terminal)
 *
 * For reminder_1/2/3: increments reminder_count, sets last_reminder_at,
 * appends a mock outbound email (type: 'checkpoint_reminder').
 * For unresolved: sets status only — no email (recipient did not respond).
 *
 * No request body required.
 *
 * Error responses:
 *   404 — caseId not found, or timeline not initialized, or checkpoint not found
 *   409 — checkpoint status is not advanceable
 *         (must be 'sent', 'reminder_1', 'reminder_2', or 'reminder_3')
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../../../../lib/adapters/index.js';
import type { MockDataAdapter } from '@denkkern/mock';
import type { OutcomeCheckpoint } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string; checkpointId: string };
}

interface AdvanceReminderResponse {
  case_id: string;
  checkpoint: OutcomeCheckpoint;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<AdvanceReminderResponse | { error: string; code?: string }>> {
  const { caseId, checkpointId } = params;

  try {
    const adapter = getAdapter() as unknown as MockDataAdapter;
    const checkpoint = await adapter.advanceReminderForCheckpoint(caseId, checkpointId);

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

      // Status lifecycle conflict (pending / confirmed / unresolved)
      if (msg.includes('Cannot advance reminder')) {
        return NextResponse.json(
          { error: msg, code: 'LIFECYCLE_CONFLICT' },
          { status: 409 }
        );
      }
    }

    console.error(
      `[POST /api/cases/${caseId}/outcome-timeline/checkpoints/${checkpointId}/advance-reminder]`,
      err
    );
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
