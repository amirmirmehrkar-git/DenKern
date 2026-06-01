/**
 * Financial impact layer — DenkKern
 *
 * Pure function — no DB reads, no API calls, no side effects, no LLM.
 * All inputs must be passed in explicitly.
 *
 * Purpose:
 *   Translates the scenario engine's cost scores into human-readable financial
 *   context for Lena: cost of inaction, deadline risk, savings vs. waiting,
 *   and a plain-text summary she can read at a glance.
 *
 * This layer is separate from the scenario engine (packages/engine) because:
 *   - The scenario engine owns scoring. This layer owns explanation.
 *   - UI components can call calculateFinancialImpact() independently, at
 *     render time, without re-running the engine.
 *   - The output is display-oriented, not decision-critical — it must never
 *     gate a transition or feed back into scoring.
 *
 * Source: docs/architecture/sprint-2-plan.md §4
 */

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * All fields required to compute the financial impact for a single scenario.
 * The caller extracts these from PredictionOutput + ShipmentContext + ScenarioResult.
 */
export interface FinancialImpactInput {
  // ── From PredictionOutput ─────────────────────────────────────────────────

  /** Expected delay in days beyond the contracted baseline arrival date. */
  predicted_delay_days: number;

  /**
   * ISO date string — the contracted (original) arrival date before any delay.
   * Source: PredictionOutput.eta.baseline
   */
  baseline_eta_date: string;

  // ── From ShipmentContext.production_context ───────────────────────────────

  /** Cost in EUR of each day the production line is halted (ERP-sourced). */
  daily_downtime_cost_eur: number;

  /**
   * ISO date string — the hard deadline by which the part must arrive for
   * production to continue uninterrupted.
   * Source: ShipmentContext.production_context.required_by
   */
  required_by: string;

  // ── From ScenarioResult ───────────────────────────────────────────────────

  /** final_score_eur of the scenario being evaluated. */
  scenario_cost_eur: number;

  /**
   * final_score_eur of the WAIT scenario — the do-nothing baseline.
   * Used to derive savings vs. inaction.
   */
  wait_scenario_cost_eur: number;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export type BufferExhaustionRisk = 'none' | 'moderate' | 'critical';

export interface FinancialImpactResult {
  /**
   * Total production loss if no action is taken.
   * = predicted_delay_days × daily_downtime_cost_eur
   *
   * Represents the full downside of waiting — the upper bound on what
   * an intervention is worth.
   */
  cost_of_inaction_eur: number;

  /**
   * Days by which the expected arrival overshoots the required_by deadline.
   *
   * Derivation:
   *   buffer_days        = floor((required_by - baseline_eta_date) / MS_PER_DAY)
   *                        (positive when required_by is after baseline; may be negative)
   *   days_over_deadline = max(0, predicted_delay_days - max(0, buffer_days))
   *
   * Example — CASE-001:
   *   baseline = 2026-05-28, required_by = 2026-05-28 → buffer = 0
   *   predicted_delay = 5 → days_over_deadline = 5
   */
  days_over_deadline: number;

  /**
   * Categorical production risk from deadline overshoot.
   *   none     — expected arrival on or before required_by
   *   moderate — 1–3 days past deadline
   *   critical — >3 days past deadline
   */
  buffer_exhaustion_risk: BufferExhaustionRisk;

  /**
   * How much cheaper this scenario is compared to waiting.
   * = wait_scenario_cost_eur - scenario_cost_eur
   * Positive = saves money vs. waiting.
   */
  expected_savings_vs_wait_eur: number;

  /**
   * Days of avoided downtime required to pay for this action.
   * = scenario_cost_eur / daily_downtime_cost_eur
   * Zero when daily_downtime_cost_eur is zero.
   */
  break_even_days: number;

  /**
   * Plain-text one-paragraph summary for Lena.
   * Deterministically composed from numeric outputs — never AI-generated.
   */
  financial_summary: string;
}

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Compute the financial impact of a single scenario relative to inaction.
 */
export function calculateFinancialImpact(input: FinancialImpactInput): FinancialImpactResult {
  const {
    predicted_delay_days,
    baseline_eta_date,
    daily_downtime_cost_eur,
    required_by,
    scenario_cost_eur,
    wait_scenario_cost_eur,
  } = input;

  // Buffer = how many spare days exist between baseline arrival and production deadline.
  // Positive  → shipment was contractually due before the deadline (buffer exists).
  // Zero      → baseline arrival IS the deadline (CASE-001).
  // Negative  → deadline is before the contracted arrival (already tight before any delay).
  const baselineDate   = new Date(baseline_eta_date);
  const requiredByDate = new Date(required_by);
  const buffer_days    = Math.floor(
    (requiredByDate.getTime() - baselineDate.getTime()) / MS_PER_DAY
  );

  // Days the expected arrival overshoots the deadline.
  // Delay absorbs the buffer first; only what remains is a miss.
  const days_over_deadline = Math.max(0, predicted_delay_days - Math.max(0, buffer_days));

  // Categorical risk
  const buffer_exhaustion_risk: BufferExhaustionRisk =
    days_over_deadline === 0  ? 'none'     :
    days_over_deadline <= 3   ? 'moderate' :
                                'critical';

  // Financial outputs
  const cost_of_inaction_eur         = Math.round(predicted_delay_days * daily_downtime_cost_eur);
  const expected_savings_vs_wait_eur = Math.round(wait_scenario_cost_eur - scenario_cost_eur);
  const break_even_days              =
    daily_downtime_cost_eur > 0
      ? Math.round((scenario_cost_eur / daily_downtime_cost_eur) * 10) / 10
      : 0;

  const financial_summary = buildSummary({
    predicted_delay_days,
    cost_of_inaction_eur,
    days_over_deadline,
    buffer_exhaustion_risk,
    expected_savings_vs_wait_eur,
    break_even_days,
    scenario_cost_eur,
  });

  return {
    cost_of_inaction_eur,
    days_over_deadline,
    buffer_exhaustion_risk,
    expected_savings_vs_wait_eur,
    break_even_days,
    financial_summary,
  };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

interface SummaryParams {
  predicted_delay_days: number;
  cost_of_inaction_eur: number;
  days_over_deadline: number;
  buffer_exhaustion_risk: BufferExhaustionRisk;
  expected_savings_vs_wait_eur: number;
  break_even_days: number;
  scenario_cost_eur: number;
}

function formatEur(amount: number): string {
  if (amount >= 1_000_000) return `€${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)     return `€${Math.round(amount / 1_000)}k`;
  return `€${amount}`;
}

function buildSummary(p: SummaryParams): string {
  const inactionStr   = formatEur(p.cost_of_inaction_eur);
  const actionCostStr = formatEur(p.scenario_cost_eur);
  const savingsStr    = formatEur(Math.abs(p.expected_savings_vs_wait_eur));

  const deadlineStr =
    p.buffer_exhaustion_risk === 'none'
      ? 'Shipment is expected to arrive within the production deadline.'
      : p.buffer_exhaustion_risk === 'moderate'
      ? `Expected arrival is ${p.days_over_deadline} day${p.days_over_deadline !== 1 ? 's' : ''} past the production deadline — partial disruption likely.`
      : `Expected arrival is ${p.days_over_deadline} days past the production deadline — production stoppage likely without intervention.`;

  const savingsSentence =
    p.expected_savings_vs_wait_eur > 0
      ? `This action costs ${actionCostStr} and saves ${savingsStr} compared to waiting.`
      : p.expected_savings_vs_wait_eur < 0
      ? `This action costs ${actionCostStr}, which is ${savingsStr} more than waiting — justified only if speed or certainty outweighs cost.`
      : `This action costs ${actionCostStr} — equivalent to waiting on a financial basis.`;

  const breakEvenSentence =
    p.break_even_days > 0
      ? `It pays for itself after ${p.break_even_days} day${p.break_even_days !== 1 ? 's' : ''} of avoided downtime.`
      : '';

  return [
    `The ${p.predicted_delay_days}-day predicted delay exposes ${inactionStr} in production losses if no action is taken.`,
    deadlineStr,
    savingsSentence,
    breakEvenSentence,
  ]
    .filter((s) => s.length > 0)
    .join(' ');
}
