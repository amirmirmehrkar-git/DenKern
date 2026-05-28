/**
 * POST /api/cases/:caseId/events
 *
 * Dispatches a workflow event for a case.
 * Returns the new WorkflowStateResponse after the transition.
 *
 * Request body: WorkflowEventPayload
 *   {
 *     "event":      "context_confirmed",   // WorkflowEvent
 *     "emitted_by": "user-123",            // user_id or "system"
 *     "emitted_at": "2026-05-29T10:00:00Z" // ISO 8601
 *   }
 *
 * Error responses:
 *   400 — missing required fields, or forbidden source (decision_confirmed from system)
 *   404 — caseId not found
 *   422 — event is not a valid transition from the current state
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { dispatchWorkflowEvent, DispatchError } from '../../../../lib/workflow/dispatcher.js';
import type { WorkflowEventPayload, WorkflowStateResponse } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<WorkflowStateResponse | { error: string; code?: string }>> {
  const { caseId } = params;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const payload = body as Partial<WorkflowEventPayload>;

  if (typeof payload.event !== 'string' || payload.event.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required field: event.' },
      { status: 400 }
    );
  }

  if (typeof payload.emitted_by !== 'string' || payload.emitted_by.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required field: emitted_by.' },
      { status: 400 }
    );
  }

  if (typeof payload.emitted_at !== 'string' || payload.emitted_at.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required field: emitted_at.' },
      { status: 400 }
    );
  }

  try {
    const newState = await dispatchWorkflowEvent(
      caseId,
      payload as WorkflowEventPayload
    );
    return NextResponse.json(newState, { status: 200 });
  } catch (err) {
    if (err instanceof DispatchError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus }
      );
    }

    // Mock adapter: seed file not found
    if (err instanceof Error && err.message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `Case '${caseId}' not found.` },
        { status: 404 }
      );
    }

    console.error('[POST /api/cases/:caseId/events]', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
