/**
 * POST /api/cases/:caseId/confirm-outcome
 *
 * Confirms the auto-generated outcome draft into a final OutcomeRecord.
 * Sprint 6A: DK-604 — core logic.
 * Sprint 6B: token validation for email-channel confirmations.
 *
 * What this endpoint does:
 *   1. Validates request body (confirmed_by, production_impact, decision_quality)
 *   2. If confirmation_channel === "email": validates one-time token
 *   3. Calls confirmOutcome() which patches decision-record.json
 *   4. If email channel: marks token as used (single-use enforcement)
 *   5. Advances workflow via dispatchWorkflowEvent():
 *        outcome_pending -> confirm_outcome -> outcome_confirmed
 *
 * Immutability contract (unchanged from DK-604):
 *   context_snapshot, recommendation_shown, decision, fingerprint,
 *   id, case_id, schema_version, created_at, locked_at are never touched.
 *
 * Error responses:
 *   400 -- missing/invalid fields
 *   401 -- missing or invalid token (email channel only)
 *   404 -- decision-record.json or outcome-draft.json not found
 *   409 -- outcome already confirmed, or token already used
 *   410 -- token expired
 *   422 -- workflow state does not allow confirm_outcome
 *   500 -- unexpected error
 */

import { NextRequest, NextResponse } from 'next/server';
import { confirmOutcome } from '../../../../../lib/workflow/outcome-confirmer.js';
import { dispatchWorkflowEvent, DispatchError } from '../../../../../lib/workflow/dispatcher.js';
import { validateToken, markTokenUsed } from '../../../../../lib/workflow/confirmation-token.js';
import type {
  DecisionRecord,
  ProductionImpact,
  DecisionQuality,
  WorkflowStateResponse,
} from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

const VALID_DECISION_QUALITIES: DecisionQuality[] = ['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'POOR'];

function isValidDecisionQuality(v: unknown): v is DecisionQuality {
  return typeof v === 'string' && (VALID_DECISION_QUALITIES as string[]).includes(v);
}

function isValidProductionImpact(v: unknown): v is ProductionImpact {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p['stopped'] === 'boolean' &&
    (p['stopped_days'] === null || typeof p['stopped_days'] === 'number') &&
    typeof p['customer_commitment_met'] === 'boolean'
  );
}

interface ConfirmOutcomeResponse {
  case_id: string;
  workflow_state: WorkflowStateResponse;
  outcome: DecisionRecord['outcome'];
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ConfirmOutcomeResponse | { error: string; code?: string }>> {
  const { caseId } = params;

  // 1. Parse request body
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
      { error: 'Missing required field: confirmed_by.' },
      { status: 400 }
    );
  }

  if (!isValidProductionImpact(b['production_impact'])) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid field: production_impact. ' +
          'Expected: { stopped: boolean, stopped_days: number | null, customer_commitment_met: boolean }',
      },
      { status: 400 }
    );
  }

  if (!isValidDecisionQuality(b['decision_quality'])) {
    return NextResponse.json(
      {
        error:
          'Missing or invalid field: decision_quality. ' +
          'Expected one of: ' + VALID_DECISION_QUALITIES.join(', ') + '.',
      },
      { status: 400 }
    );
  }

  const confirmationChannel =
    typeof b['confirmation_channel'] === 'string' ? b['confirmation_channel'] : 'api';

  const actualCostOverride =
    typeof b['actual_cost_eur'] === 'number' ? b['actual_cost_eur'] : undefined;

  // 2. Token validation (email channel only)
  //
  // When confirmation_channel is "email", the request must include a valid
  // one-time token matching the one sent in the notification email.
  // API-channel confirmations (from internal tooling) skip token validation.

  if (confirmationChannel === 'email') {
    const token = typeof b['token'] === 'string' ? b['token'] : null;

    if (token === null) {
      return NextResponse.json(
        {
          error: 'Missing field: token. Email-channel confirmations require a valid confirmation token.',
          code: 'TOKEN_REQUIRED',
        },
        { status: 401 }
      );
    }

    const validation = validateToken(caseId, token);

    if (!validation.valid) {
      if (validation.reason === 'EXPIRED') {
        return NextResponse.json(
          {
            error: 'Confirmation token has expired. Request a new notification email.',
            code: 'TOKEN_EXPIRED',
          },
          { status: 410 }
        );
      }
      if (validation.reason === 'ALREADY_USED') {
        return NextResponse.json(
          {
            error: 'Confirmation token has already been used. This outcome may already be confirmed.',
            code: 'TOKEN_ALREADY_USED',
          },
          { status: 409 }
        );
      }
      // NOT_FOUND or mismatched
      return NextResponse.json(
        {
          error: 'Invalid confirmation token.',
          code: 'TOKEN_INVALID',
        },
        { status: 401 }
      );
    }
  }

  // 3. Confirm outcome: patch decision-record.json
  let patched: DecisionRecord;
  try {
    const confirmInput = {
      confirmed_by:         b['confirmed_by'] as string,
      confirmation_channel: confirmationChannel,
      production_impact:    b['production_impact'] as ProductionImpact,
      decision_quality:     b['decision_quality'] as DecisionQuality,
      notes:                typeof b['notes'] === 'string' ? b['notes'] : null,
    };
    if (actualCostOverride !== undefined) {
      patched = confirmOutcome(caseId, { ...confirmInput, actual_cost_eur: actualCostOverride });
    } else {
      patched = confirmOutcome(caseId, confirmInput);
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('ENOENT') || err.message.includes('not found')) {
        return NextResponse.json(
          { error: err.message.replace(/^\[DK-604\] /, ''), code: 'PREREQUISITE_MISSING' },
          { status: 404 }
        );
      }
      if (err.message.includes('already confirmed')) {
        return NextResponse.json(
          { error: err.message.replace(/^\[DK-604\] /, ''), code: 'ALREADY_CONFIRMED' },
          { status: 409 }
        );
      }
    }
    console.error('[POST confirm-outcome] confirmOutcome failed:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }

  // 4. Mark token as used (email channel, post-confirmation)
  if (confirmationChannel === 'email' && typeof b['token'] === 'string') {
    markTokenUsed(caseId, b['token'] as string);
  }

  // 5. Advance workflow: outcome_pending -> outcome_confirmed
  let newWorkflowState: WorkflowStateResponse;
  try {
    newWorkflowState = await dispatchWorkflowEvent(caseId, {
      event:      'confirm_outcome',
      emitted_by: b['confirmed_by'] as string,
      emitted_at: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof DispatchError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus }
      );
    }
    console.error('[POST confirm-outcome] dispatchWorkflowEvent failed:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }

  // 6. Return summary
  const response: ConfirmOutcomeResponse = {
    case_id:        caseId,
    workflow_state: newWorkflowState,
    outcome:        patched.outcome,
  };

  return NextResponse.json(response, { status: 200 });
}
