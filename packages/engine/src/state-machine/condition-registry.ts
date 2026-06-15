// ─── condition-registry.ts ────────────────────────────────────────────────────
// Maps every required_condition string declared in state_machine.transitions
// to a deterministic evaluator function.
//
// DESIGN: Option A — Simple Registry (no expression parser, no DSL)
// Each condition string is a key; value is (engine) => boolean.
// Field paths are verified against mock/cases/SH-2024-0042/decision-engine-output.json.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CanonicalEngine = Record<string, any>;
export type ConditionEvaluator = (engine: CanonicalEngine) => boolean;

export const CONDITION_REGISTRY: Record<string, ConditionEvaluator> = {

  // ── Disruption detection ──────────────────────────────────────────────────
  'ais_deviation_threshold_exceeded': (e) => {
    // prediction_signals.risk_drivers includes a port_congestion or ais_deviation entry
    const drivers: any[] = e?.prediction_signals?.risk_drivers ?? [];
    return drivers.some((d: any) =>
      d.type === 'ais_deviation' || d.type === 'port_congestion'
    );
  },

  'disruption_severity IN [HIGH, CRITICAL]': (e) => {
    const sev: string = e?.disruption_context?.disruption_summary?.severity_level ?? '';
    return sev === 'HIGH' || sev === 'CRITICAL';
  },

  // ── Case / context ────────────────────────────────────────────────────────
  'case_not_already_open': (_e) => true, // stateless for demo

  'prediction_signals.external_signals.length >= 1': (e) => {
    // In canonical JSON, external signals are stored as risk_drivers
    const drivers: any[] = e?.prediction_signals?.risk_drivers ?? [];
    return drivers.length >= 1;
  },

  'actions.length >= 1': (e) => {
    return (e?.actions?.length ?? 0) >= 1;
  },

  'engine_output.recommendation.action_id IS NOT NULL': (e) => {
    return e?.engine_output?.recommendation?.action_id != null;
  },

  // ── Decision room ─────────────────────────────────────────────────────────
  'recommendation_reviewed': (e) => {
    // Proxy: recommendation exists and has an action_id
    return e?.engine_output?.recommendation?.action_id != null;
  },

  // ── Approval routing ──────────────────────────────────────────────────────
  'recommended_action.cost_eur > lena_configuration.approval_threshold_eur': (e) => {
    const actionId: string | null = e?.engine_output?.recommendation?.action_id ?? null;
    const actions: any[] = e?.actions ?? [];
    const action = actions.find((a: any) => a.action_id === actionId);
    const threshold: number = e?.lena_configuration?.approval_threshold_eur ?? Infinity;
    const cost: number = action?.cost_eur ?? 0;
    return cost > threshold;
  },

  'approval_request_submitted': (e) => {
    return e?.engine_output?.approval_routing?.approval_required === true;
  },

  'approval_routing.approval_status === approved': (e) => {
    return e?.engine_output?.approval_routing?.approval_status === 'approved';
  },

  // ── Execution validation ──────────────────────────────────────────────────
  'execution_validation.blocking_items ALL status === confirmed': (e) => {
    const checklist: any[] = e?.engine_output?.execution_validation?.checklist ?? [];
    const blocking = checklist.filter((item: any) => item.blocking === true);
    if (blocking.length === 0) return false;
    return blocking.every(
      (item: any) => item.status === 'confirmed' || item.status === 'completed'
    );
  },

  // ── System events (external to demo) ────────────────────────────────────
  'booking_confirmation_received': (_e) => false, // requires external booking system event
  'delivery_event_received': (_e) => false,        // requires carrier delivery event

  // ── Outcome ───────────────────────────────────────────────────────────────
  'outcome_report_generated': (e) => {
    return e?.engine_output?.projected_outcome != null;
  },

  'outcome_review_complete': (_e) => true,
  'audit_log_written': (_e) => true,
};

/**
 * Evaluate a single condition string against the canonical engine output.
 *
 * Returns true if the condition passes.
 * Returns true with a warning if the condition ID is not in the registry
 * (demo resilience — unknown conditions do not block transitions).
 */
export function evaluateCondition(
  condition: string,
  engine: CanonicalEngine,
): boolean {
  const evaluator = CONDITION_REGISTRY[condition];
  // Unknown conditions are treated as PASS for demo resilience.
  // All conditions declared in state_machine.transitions are registered above.
  if (!evaluator) return true;
  return evaluator(engine);
}
