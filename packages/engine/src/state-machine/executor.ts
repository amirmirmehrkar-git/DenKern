// ─── executor.ts ──────────────────────────────────────────────────────────────
// StateMachineExecutor — validates state transitions against the declared
// state_machine block in the canonical decision-engine-output.json.
//
// Usage:
//   const result = attemptTransition(engine, 'decision_pending', 'decision_approved', 'supply_planner')
//   if (!result.allowed) return Response.json({ errors: result.errors }, { status: 403 })
//
// No UI changes. No external dependencies. Deterministic and testable.
// ─────────────────────────────────────────────────────────────────────────────

import { evaluateCondition } from './condition-registry.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TransitionErrorCode =
  | 'INVALID_TRANSITION'   // no declared transition for this from→to pair
  | 'ROLE_NOT_PERMITTED'   // userRole not in allowed_roles[]
  | 'CONDITION_NOT_MET'    // required_condition evaluated false
  | 'IRREVERSIBLE_STATE';  // attempting backward move past irreversible_after

export interface TransitionError {
  code: TransitionErrorCode;
  message: string;
  detail?: string;
}

export interface TransitionResult {
  allowed: boolean;
  transitionId?: string;   // id of the matched transition (e.g. "TRN-007")
  errors: TransitionError[];
}

// ── State ordinals ────────────────────────────────────────────────────────────
// Used to detect backward transitions past the irreversible_after boundary.
// Must match the ShipmentState enum in schemas/decision-engine.schema.v1.json.

const STATE_ORDINALS: Record<string, number> = {
  monitoring_active:            0,
  disruption_detected:          1,
  alert_generated:              2,
  disruption_context_opened:    3,
  scenarios_generated:          4,
  recommendation_ranked:        5,
  decision_pending:             6,
  decision_approved:            7,
  second_approval_pending:      8,
  second_approval_confirmed:    9,
  execution_validation_pending: 10,
  execution_started:            11,  // ← irreversible_after in demo case
  execution_monitoring:         12,
  needs_re_evaluation:          13,
  outcome_pending:              14,
  outcome_confirmed:            15,
  audit_logged:                 16,
  closed:                       17,
};

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Attempt a state transition against the declared state_machine.
 *
 * Validates in order:
 *   1. Transition exists (from → to declared in state_machine.transitions)
 *   2. userRole appears in transition.allowed_roles
 *   3. All transition.required_conditions evaluate true
 *   4. Not attempting a backward move past state_machine.irreversible_after
 *
 * All failing checks are collected — errors[] is never partial.
 *
 * @param engine     The full parsed decision-engine-output.json object
 * @param fromState  Current state (must match meta.current_state in practice)
 * @param toState    Target state
 * @param userRole   Role of the requesting user/system (e.g. "supply_planner")
 */
export function attemptTransition(
  engine: Record<string, any>,
  fromState: string,
  toState: string,
  userRole: string,
): TransitionResult {
  const errors: TransitionError[] = [];
  const stateMachine = engine?.state_machine;

  if (!stateMachine) {
    return {
      allowed: false,
      errors: [{
        code: 'INVALID_TRANSITION',
        message: 'state_machine block not found in engine output',
      }],
    };
  }

  // ── Check 1: transition must be declared ────────────────────────────────────
  const transitions: any[] = stateMachine.transitions ?? [];
  const transition = transitions.find(
    (t: any) => t.from === fromState && t.to === toState,
  );

  if (!transition) {
    const validTargets = transitions
      .filter((t: any) => t.from === fromState)
      .map((t: any) => t.to);

    return {
      allowed: false,
      errors: [{
        code: 'INVALID_TRANSITION',
        message: `No declared transition from "${fromState}" to "${toState}"`,
        detail: validTargets.length > 0
          ? `Valid targets from "${fromState}": ${validTargets.join(', ')}`
          : `No transitions declared from "${fromState}"`,
      }],
    };
  }

  // ── Check 2: role must be permitted ────────────────────────────────────────
  const allowedRoles: string[] = transition.allowed_roles ?? [];
  if (!allowedRoles.includes(userRole)) {
    errors.push({
      code: 'ROLE_NOT_PERMITTED',
      message: `Role "${userRole}" is not permitted for transition ${transition.id}`,
      detail: `Allowed roles: ${allowedRoles.join(', ')}`,
    });
  }

  // ── Check 3: all required conditions must pass ──────────────────────────────
  const conditions: string[] = transition.required_conditions ?? [];
  for (const condition of conditions) {
    const passed = evaluateCondition(condition, engine);
    if (!passed) {
      errors.push({
        code: 'CONDITION_NOT_MET',
        message: `Required condition not satisfied: "${condition}"`,
        detail: `Transition ${transition.id} (${fromState} → ${toState}) requires: ${condition}`,
      });
    }
  }

  // ── Check 4: irreversible_after boundary ────────────────────────────────────
  const irreversibleAfter: string | undefined = stateMachine.irreversible_after;
  if (irreversibleAfter) {
    const irreversibleOrdinal = STATE_ORDINALS[irreversibleAfter] ?? -1;
    const fromOrdinal = STATE_ORDINALS[fromState] ?? -1;
    const toOrdinal = STATE_ORDINALS[toState] ?? -1;

    // Backward move = toOrdinal < fromOrdinal, and we are past the boundary
    if (
      fromOrdinal >= irreversibleOrdinal &&
      toOrdinal < irreversibleOrdinal
    ) {
      errors.push({
        code: 'IRREVERSIBLE_STATE',
        message: `Cannot move backward past "${irreversibleAfter}"`,
        detail: `Transition ${transition.id}: workflow has passed the irreversible boundary "${irreversibleAfter}"`,
      });
    }
  }

  return {
    allowed: errors.length === 0,
    transitionId: transition.id,
    errors,
  };
}
