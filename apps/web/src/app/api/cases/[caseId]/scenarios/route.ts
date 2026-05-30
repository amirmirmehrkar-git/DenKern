/**
 * GET /api/cases/:caseId/scenarios
 *
 * Returns the ScenarioResult computed by the scenario engine when
 * `context_confirmed` was dispatched. The result is stored in the
 * in-memory scenarioStore (populated by the dispatcher consequence layer).
 *
 * Error responses:
 *   404 — caseId not found or scenarios not yet computed
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { scenarioStore } from '../../../../../lib/workflow/scenario-store.js';
import type { ScenarioResult } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ScenarioResult | { error: string }>> {
  const { caseId } = params;

  try {
    const result = scenarioStore.get(caseId);

    if (result === undefined) {
      return NextResponse.json(
        { error: `Scenarios for case '${caseId}' not yet computed. Dispatch context_confirmed first.` },
        { status: 404 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[GET /api/cases/:caseId/scenarios]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
