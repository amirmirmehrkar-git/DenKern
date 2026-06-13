/**
 * GET /api/cases/:caseId/outcome-timeline
 *
 * Returns the OutcomeTimeline for a case, or null if not yet initialized.
 *
 * The timeline is initialized by the DK-705 dispatcher consequence when
 * outcome_capture_initiated fires. Prior to that event this endpoint returns
 * HTTP 204 (No Content) to distinguish "case exists, no timeline yet" from
 * "case not found" (HTTP 404).
 *
 * OutcomeTimeline is intentionally separate from DecisionRecord.
 * This endpoint does NOT read or modify decision-record.json.
 *
 * Error responses:
 *   404 — caseId not found (no workflow state file)
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../lib/adapters/index.js';
import type { MockDataAdapter } from '@denkkern/mock';
import type { OutcomeTimeline } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<OutcomeTimeline | null | { error: string }>> {
  const { caseId } = params;

  try {
    const adapter = getAdapter() as unknown as MockDataAdapter;

    // Verify case exists by checking workflow state — throws ENOENT if absent.
    await adapter.getWorkflowState(caseId);

    const timeline = await adapter.getOutcomeTimeline(caseId);

    if (timeline === null) {
      // Case exists but timeline not yet initialized (pre-decision).
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(timeline, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `Case '${caseId}' not found.` },
        { status: 404 }
      );
    }
    console.error(`[GET /api/cases/${caseId}/outcome-timeline]`, err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
