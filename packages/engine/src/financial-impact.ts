/**
 * annotateFinancialImpact — DenkKern engine
 *
 * Pure annotation function. Takes a ScenarioResult and BusinessFactors and
 * returns the same result enriched with a FinancialImpactAnnotation.
 *
 * Architecture rules enforced:
 *   - Pure function: no DB reads, no API calls, no LLM inference, no side effects.
 *   - strategic_summary is template-generated — never LLM-generated — so it is
 *     always auditable and reproducible from the same inputs.
 *   - Uses the WAIT scenario's expected_delay_days for risk framing (full exposure
 *     picture regardless of which option is recommended).
 *   - financial_impact is additive — it never alters scenario scores or rankings.
 *
 * Source: docs/architecture/sprint-2-plan.md §7
 */

import type {
  ScenarioResult,
  BusinessFactors,
  FinancialImpactAnnotation,
} from '@denkkern/types';

// ---------------------------------------------------------------------------
// annotateFinancialImpact
// ---------------------------------------------------------------------------

/**
 * Enrich a ScenarioResult with engine-owned financial impact framing.
 *
 * @param result   The ScenarioResult produced by runScenarioEngine().
 * @param factors  Business context — from ShipmentContext.production_context.
 * @returns        The same result with financial_impact populated.
 *
 * Uses the WAIT scenario delay for risk framing: this represents the full
 * exposure if no action is taken, giving the operator the complete picture
 * regardless of which scenario is recommended.
 */
export function annotateFinancialImpact(
  result: ScenarioResult,
  factors: BusinessFactors
): ScenarioResult {
  const waitScenario = result.scenarios.find((s) => s.scenario_id === 'WAIT');

  // Fall back to the recommended scenario delay if WAIT was not generated
  // (degenerate case — should not occur in normal Hamburg flow).
  const recommended = result.scenarios.find((s) => s.recommended);
  const waitDelayDays =
    waitScenario?.expected_delay_days ??
    recommended?.expected_delay_days ??
    0;

  // ── Production downtime risk ─────────────────────────────────────────────
  const total_exposure_eur =
    waitDelayDays *
    factors.cost_of_delay_eur_per_day *
    factors.affected_production_lines;

  const buffer_remaining_days = factors.inventory_buffer_days - waitDelayDays;
  const buffer_exhausted = buffer_remaining_days <= 0;

  // ── Contract exposure ────────────────────────────────────────────────────
  const exceedsTrigger =
    factors.contract_penalty_eur_per_day > 0 &&
    waitDelayDays > factors.contract_penalty_trigger_day;

  const penalty_applies = exceedsTrigger;

  const estimated_penalty_eur = penalty_applies
    ? (waitDelayDays - factors.contract_penalty_trigger_day) *
      factors.contract_penalty_eur_per_day
    : 0;

  // ── Strategic summary — deterministic template, never LLM-generated ─────

  const strategic_summary = buildStrategicSummary(
    buffer_exhausted,
    buffer_remaining_days,
    factors.part_criticality,
    penalty_applies,
    factors.contract_penalty_eur_per_day,
    factors.contract_penalty_trigger_day,
    estimated_penalty_eur,
    waitDelayDays,
    total_exposure_eur
  );

  const financial_impact: FinancialImpactAnnotation = {
    production_downtime_risk: {
      total_exposure_eur,
      buffer_remaining_days,
      buffer_exhausted,
      affected_production_lines: factors.affected_production_lines,
    },
    contract_exposure: {
      penalty_applies,
      estimated_penalty_eur,
      penalty_trigger_day: factors.contract_penalty_trigger_day,
    },
    strategic_summary,
  };

  return { ...result, financial_impact };
}

// ---------------------------------------------------------------------------
// Strategic summary template
// ---------------------------------------------------------------------------

function buildStrategicSummary(
  buffer_exhausted: boolean,
  buffer_remaining_days: number,
  part_criticality: BusinessFactors['part_criticality'],
  penalty_applies: boolean,
  penalty_per_day: number,
  penalty_trigger_day: number,
  estimated_penalty_eur: number,
  delay_days: number,
  total_exposure_eur: number
): string {
  const fmt = (eur: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eur);

  if (buffer_exhausted && part_criticality === 'HIGH') {
    const overrun = Math.abs(buffer_remaining_days);
    return (
      `Production halt risk: buffer exhausted — predicted ${delay_days}-day delay exceeds ` +
      `${delay_days - overrun}-day buffer by ${overrun} day${overrun !== 1 ? 's' : ''}. ` +
      (penalty_applies
        ? `Contract penalty of ${fmt(penalty_per_day)}/day activates on day ${penalty_trigger_day} — estimated ${fmt(estimated_penalty_eur)}.`
        : `Total production exposure: ${fmt(total_exposure_eur)}.`)
    );
  }

  if (penalty_applies) {
    return (
      `Contract penalty of ${fmt(penalty_per_day)}/day activates on day ${penalty_trigger_day} ` +
      `— total exposure ${fmt(estimated_penalty_eur)}. ` +
      `Production buffer: ${buffer_remaining_days} day${buffer_remaining_days !== 1 ? 's' : ''} remaining.`
    );
  }

  const bufferNote =
    buffer_remaining_days > 0
      ? `Buffer absorbs ${buffer_remaining_days} day${buffer_remaining_days !== 1 ? 's' : ''}.`
      : `Buffer exhausted.`;

  return (
    `Delay of ${delay_days} day${delay_days !== 1 ? 's' : ''} exposes ${fmt(total_exposure_eur)} in production loss. ${bufferNote}`
  );
}
