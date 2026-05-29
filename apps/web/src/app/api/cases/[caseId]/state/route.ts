/**
 * GET /api/cases/:caseId/state
 *
 * Returns the current workflow state for a case, including which events
 * are valid to dispatch next (available_actions).
 *
 * Designed for polling: safe to call on a 1–5 second interval.
 * Returns HTTP 200 with a WorkflowStateResponse body on success.
 *
 * Error responses:
 *   404 — caseId not found in the adapter
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../lib/adapters/index.js';
import type { WorkflowStateResponse } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<WorkflowStateResponse | { error: string }>> {
  const { caseId } = params;

  try {
    const adapter = getAdapter();
    const state = await adapter.getWorkflowState(caseId);
    return NextResponse.json(state, { status: 200 });
  } catch (err) {
    // Mock adapter throws if the seed file does not exist — treat as 404
    if (err instanceof Error && err.message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `Case '${caseId}' not found.` },
        { status: 404 }
      );
    }

    console.error('[GET /api/cases/:caseId/state]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
