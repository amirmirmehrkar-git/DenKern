/**
 * Approval gate — DenkKern
 *
 * Determines whether a confirmed decision requires supervisor second-approval
 * before execution can be triggered.
 *
 * Architecture rule C2 (source: docs/architecture/sprint-2-plan.md §2):
 *   `second_approval_confirmed` must be emitted_by a named supervisor.
 *   Never 'lena'. Never 'system'.
 *
 * Gate criteria (evaluated against the recommended scenario only):
 *   - final_score_eur >= config.second_approval_threshold_eur  (financial risk)
 *   - execution_complexity === 'HIGH'                           (operational risk)
 *   - any active risk signal has severity === 'high'            (external risk)
 *
 * This is a pure function — no DB reads, no API calls, no side effects.
 * All inputs must be passed in; no ambient/global state.
 */

import type { ScenarioResult, ScenarioConfig, ActiveRiskSignal } from '@denkkern/types';

export interface ApprovalGateResult {
  required: boolean;
  reasons: string[];   // Human-readable list of reasons — surfaced in the UI
}

/**
 * Evaluate whether a second supervisor approval is required for the recommended scenario.
 *
 * @param result       The ScenarioResult stored after the engine ran.
 * @param config       The versioned ScenarioConfig (provides threshold).
 * @param riskSignals  Active risk signals at time of decision (may be empty).
 */
export function requiresSecondApproval(
  result: ScenarioResult,
  config: ScenarioConfig,
  riskSignals: ActiveRiskSignal[] = []
): ApprovalGateResult {
  const recommended = result.scenarios.find((s) => s.recommended);

  // If no recommended scenario exists, gate does not apply (engine error path).
  if (recommended === undefined) {
    return { required: false, reasons: [] };
  }

  const threshold = config.second_approval_threshold_eur;
  const reasons: string[] = [];

  // Criterion 1 — Financial risk threshold
  if (recommended.final_score_eur >= threshold) {
    reasons.push(
      `Recommended scenario cost (€${Math.round(recommended.final_score_eur / 1000)}k) ` +
      `exceeds second-approval threshold (€${Math.round(threshold / 1000)}k).`
    );
  }

  // Criterion 2 — Operational execution complexity
  if (recommended.execution_complexity === 'HIGH') {
    reasons.push(
      `Selected scenario (${recommended.scenario_id}) has HIGH execution complexity.`
    );
  }

  // Criterion 3 — Active high-severity external risk signal
  const highSignal = riskSignals.find((s) => s.severity === 'high');
  if (highSignal !== undefined) {
    reasons.push(
      `Active high-severity risk signal: ${highSignal.type} at ${highSignal.location}.`
    );
  }

  return {
    required: reasons.length > 0,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// C2 rule — enforced here and in the dispatcher
// ---------------------------------------------------------------------------

/**
 * Forbidden emitter values for `second_approval_confirmed` and `second_approval_rejected`.
 * Architecture rule C2: supervisor approval events must originate from a named human,
 * never from 'lena' (the reviewing operator) or 'system' (automated process).
 */
export const FORBIDDEN_APPROVAL_EMITTERS: ReadonlySet<string> = new Set([
  'lena',
  'system',
]);

/**
 * Validate that a `second_approval_confirmed` or `second_approval_rejected` event
 * was not emitted by a forbidden source.
 *
 * @returns An error message string if forbidden; null if valid.
 */
export function validateApprovalEmitter(emitted_by: string): string | null {
  if (FORBIDDEN_APPROVAL_EMITTERS.has(emitted_by.toLowerCase().trim())) {
    return (
      `'${emitted_by}' is not permitted to emit second-approval events. ` +
      `Architecture rule C2: second_approval_confirmed and second_approval_rejected ` +
      `must be emitted by a named supervisor, never by 'lena' or 'system'.`
    );
  }
  return null;
}
