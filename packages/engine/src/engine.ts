/**
 * runScenarioEngine — DenkKern
 *
 * Pure function. No DB writes. No API calls. No LLM inference.
 * No reads from global/ambient config — everything is passed in.
 *
 * Same input always produces the same output.
 *
 * Source of truth: docs/architecture/03-scenario-engine.md
 *                  docs/architecture/06-data-contracts.md §5–6
 */

import type {
  ScenarioEngineInput,
  ScenarioResult,
  Scenario,
  RecommendationResult,
  AssumptionsLog,
} from '@denkkern/types';
import { DECISION_NOTE } from '@denkkern/types';

import { classifyConfidenceTier, daysBetween, formatEur } from './classify.js';
import { scoreScenario } from './score.js';

export const ENGINE_VERSION = 'scenario-engine-v0.1';

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runScenarioEngine(input: ScenarioEngineInput): ScenarioResult {
  const {
    case_id,
    prediction_snapshot,
    erp_context,
    freight_options,
    active_risk_signals,
    scenario_config,
  } = input;

  const { delay } = prediction_snapshot;
  const { daily_downtime_cost_eur, required_by, inventory } = erp_context;

  const confidence_tier = classifyConfidenceTier(delay.confidence_score, scenario_config);

  // Common data sources label (appended per scenario)
  const baseSources = [
    `James prediction model ${prediction_snapshot.model_version}`,
    'ERP context (simulated)',
  ];

  const signalSources = active_risk_signals.map(
    (s) => `${s.type} signal — ${s.location} (${s.source})`
  );

  // ---------------------------------------------------------------------------
  // Build scenarios
  // ---------------------------------------------------------------------------

  const scenarios: Scenario[] = [];

  // WAIT — always included
  scenarios.push(
    scoreScenario({
      scenario_id: 'WAIT',
      name: 'Wait for shipment',
      description: 'Accept the delay. Allow the original shipment to arrive on its current trajectory.',
      scenario_type: 'wait',
      action_cost_eur: 0,
      expected_delay_days: delay.expected_delay_days,
      daily_production_loss_eur: daily_downtime_cost_eur,
      confidence_tier,
      execution_complexity: 'LOW',
      config: scenario_config,
      data_sources: [...baseSources, ...signalSources],
    })
  );

  // REROUTE — included only if freight options exist
  if (freight_options.length > 0) {
    // Use the freight option with the lowest estimated cost (best reroute option)
    const bestFreight = freight_options.reduce((best, opt) => {
      const daysA = Math.max(0, daysBetween(required_by, best.estimated_arrival_date));
      const daysB = Math.max(0, daysBetween(required_by, opt.estimated_arrival_date));
      const scoreA = best.cost_eur + daysA * daily_downtime_cost_eur;
      const scoreB = opt.cost_eur + daysB * daily_downtime_cost_eur;
      return scoreB < scoreA ? opt : best;
    });

    const reroute_delay_days = Math.max(
      0,
      daysBetween(required_by, bestFreight.estimated_arrival_date)
    );

    scenarios.push(
      scoreScenario({
        scenario_id: 'REROUTE',
        name: `Expedite via ${bestFreight.from} → ${bestFreight.to}`,
        description: `Use freight forwarding (option ${bestFreight.option_id}) to receive the shipment faster via ${bestFreight.from}.`,
        scenario_type: 'reroute',
        action_cost_eur: bestFreight.cost_eur,
        expected_delay_days: reroute_delay_days,
        daily_production_loss_eur: daily_downtime_cost_eur,
        confidence_tier,
        execution_complexity: 'MEDIUM',
        config: scenario_config,
        data_sources: [
          ...baseSources,
          `Freight option ${bestFreight.option_id} (simulated)`,
        ],
      })
    );
  }

  // REPLACE — included only if replacement_available = true
  if (inventory.replacement_available) {
    const replacement_cost = inventory.replacement_cost_eur ?? 0;

    scenarios.push(
      scoreScenario({
        scenario_id: 'REPLACE',
        name: `Order replacement from ${inventory.replacement_location ?? 'alternative supplier'}`,
        description: 'Source the critical part from an alternative supplier before the original shipment arrives.',
        scenario_type: 'replace',
        action_cost_eur: replacement_cost,
        expected_delay_days: 0, // replacement eliminates production delay
        daily_production_loss_eur: daily_downtime_cost_eur,
        confidence_tier,
        execution_complexity: 'HIGH',
        config: scenario_config,
        data_sources: [
          ...baseSources,
          `Inventory: ${inventory.replacement_location ?? 'alternative supplier'} (simulated)`,
        ],
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Rank and recommend
  // ---------------------------------------------------------------------------

  const ranked = rankScenarios(scenarios, scenario_config.tiebreak_preference);

  // ---------------------------------------------------------------------------
  // Assumptions log
  // ---------------------------------------------------------------------------

  const risk_modifiers_applied: Record<string, number> = {};
  const strategic_weights_applied: Record<string, number> = {};
  for (const s of ranked) {
    risk_modifiers_applied[s.scenario_id] = s.effective_risk_modifier;
    strategic_weights_applied[s.scenario_id] = s.strategic_weight_eur;
  }

  const assumptions_log: AssumptionsLog = {
    generated_at: new Date().toISOString(),
    prediction_snapshot: {
      expected_delay_days: delay.expected_delay_days,
      p_delay_over_3_days: delay.p_delay_over_3_days,
      confidence_score: delay.confidence_score,
      confidence_tier,
      model_version: prediction_snapshot.model_version,
    },
    risk_modifiers_applied,
    strategic_weights_applied,
    daily_production_loss_eur: daily_downtime_cost_eur,
    scenario_config_version: scenario_config.version,
    required_by:       erp_context.required_by,
    baseline_eta_date: prediction_snapshot.eta.baseline,
  };

  // ---------------------------------------------------------------------------
  // Recommendation
  // ---------------------------------------------------------------------------

  const recommended = ranked.find((s) => s.recommended)!;
  const waitScenario = ranked.find((s) => s.scenario_id === 'WAIT');
  const savings = waitScenario
    ? waitScenario.final_score_eur - recommended.final_score_eur
    : 0;

  const recommendation: RecommendationResult = {
    recommended_option_id: recommended.scenario_id,
    recommended_action: recommended.name,
    reason: buildRecommendationReason(recommended, ranked, savings),
    estimated_savings_vs_waiting_eur: savings,
    confidence_note: buildConfidenceNote(delay.confidence_score, confidence_tier),
    decision_note: DECISION_NOTE,
  };

  return {
    case_id,
    computed_at: new Date().toISOString(),
    engine_version: ENGINE_VERSION,
    scenarios: ranked,
    recommendation,
    assumptions_log,
    scenario_count: ranked.length,
  };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

function rankScenarios(
  scenarios: Scenario[],
  tiebreak_preference: string[]
): Scenario[] {
  if (scenarios.length === 0) return [];

  // Sort by final_score_eur ascending, then by tiebreak_preference
  const sorted = [...scenarios].sort((a, b) => {
    if (a.final_score_eur !== b.final_score_eur) {
      return a.final_score_eur - b.final_score_eur;
    }
    // Tie: prefer lower execution_complexity
    const complexityOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    const complexDiff =
      (complexityOrder[a.execution_complexity] ?? 0) -
      (complexityOrder[b.execution_complexity] ?? 0);
    if (complexDiff !== 0) return complexDiff;
    // Still tied: use tiebreak_preference
    const aIdx = tiebreak_preference.indexOf(a.scenario_id);
    const bIdx = tiebreak_preference.indexOf(b.scenario_id);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  // Set recommended flag — exactly one scenario
  return sorted.map((s, i) => ({ ...s, recommended: i === 0 }));
}

// ---------------------------------------------------------------------------
// Recommendation prose builders
// ---------------------------------------------------------------------------

function buildRecommendationReason(
  recommended: Scenario,
  all: Scenario[],
  savings: number
): string {
  const others = all
    .filter((s) => !s.recommended)
    .map((s) => `${s.scenario_id} (${formatEur(s.final_score_eur)})`)
    .join(', ');

  return (
    `This option has the lowest total expected cost (${formatEur(recommended.final_score_eur)}) ` +
    (others ? `compared to ${others}. ` : '. ') +
    (savings > 0
      ? `Estimated saving vs. waiting: ${formatEur(savings)}.`
      : '')
  );
}

function buildConfidenceNote(score: number, tier: string): string {
  const pct = Math.round(score * 100);
  if (tier === 'HIGH') {
    return `Prediction confidence is ${pct}% (High tier). No uncertainty adjustment applied.`;
  }
  if (tier === 'MEDIUM') {
    return `Prediction confidence is ${pct}% (Medium tier). Uncertainty risk has been applied to the WAIT scenario score.`;
  }
  return `Prediction confidence is ${pct}% (Low tier). Elevated uncertainty risk has been applied to the WAIT scenario score.`;
}
idence is ${pct}% (Low tier). Elevated uncertainty risk has been applied to the WAIT scenario score.`;
}
