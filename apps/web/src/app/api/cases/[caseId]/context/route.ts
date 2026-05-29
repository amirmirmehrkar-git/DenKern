/**
 * GET /api/cases/:caseId/context
 *
 * Returns the assembled DisruptionContext for a case.
 * Used by ShipmentDisruptionDetailPage to render the full context panels.
 *
 * Error responses:
 *   404 — caseId not found or context not yet assembled
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../lib/adapters/index.js';
import type { DisruptionContext } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<DisruptionContext | { error: string }>> {
  const { caseId } = params;

  try {
    const adapter = getAdapter();
    const context = await adapter.getDisruptionContext(caseId);
    return NextResponse.json(context, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `Disruption context for case '${caseId}' not found.` },
        { status: 404 }
      );
    }
    console.error('[GET /api/cases/:caseId/context]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
