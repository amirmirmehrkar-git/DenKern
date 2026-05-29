/**
 * GET /api/cases/:caseId/alert
 *
 * Returns the AlertEvent for a case.
 * Used by ShipmentDisruptionDetailPage (alert summary header) and
 * MissionControlDashboard (alert feed).
 *
 * Error responses:
 *   404 — caseId not found or no alert generated yet
 *   500 — unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../lib/adapters/index.js';
import type { AlertEvent } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<AlertEvent | { error: string }>> {
  const { caseId } = params;

  try {
    const adapter = getAdapter();
    const alert = await adapter.getAlert(caseId);
    return NextResponse.json(alert, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `Alert for case '${caseId}' not found.` },
        { status: 404 }
      );
    }
    console.error('[GET /api/cases/:caseId/alert]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
