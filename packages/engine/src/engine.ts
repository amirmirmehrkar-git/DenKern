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
  ExternalRiskSignal,
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
    external_risk_signals = [],
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
        expected_delay_days: 0,
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
  // Apply external risk signal boosts to WAIT scenario
  // HIGH/CRITICAL signals with effect 'increase_wait_risk' boost the WAIT modifier.
  // LLM boundary: LLM classifies signals; engine applies scoring effects deterministically.
  // ---------------------------------------------------------------------------

  const waitBoostSignals = external_risk_signals.filter(
    (s) => (s.severity === 'HIGH' || s.severity === 'CRITICAL') &&
            s.recommended_engine_effect === 'increase_wait_risk'
  );

  const boostedScenarios = waitBoostSignals.length > 0
    ? applyExternalSignalBoosts(scenarios, waitBoostSignals)
    : scenarios;

  // ---------------------------------------------------------------------------
  // Rank and recommend
  // ---------------------------------------------------------------------------

  const ranked = rankScenarios(boostedScenarios, scenario_config.tiebreak_preference);

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

  // All HIGH/CRITICAL signals inform urgency layer (not only wait-risk ones)
  const allUrgentSignals = external_risk_signals.filter(
    (s) => s.severity === 'HIGH' || s.severity === 'CRITICAL'
  );

  const recommendation: RecommendationResult = {
    recommended_option_id: recommended.scenario_id,
    recommended_action: recommended.name,
    reason: buildRecommendationReason(recommended, ranked, savings, allUrgentSignals),
    estimated_savings_vs_waiting_eur: savings,
    confidence_note: buildConfidenceNote(delay.confidence_score, confidence_tier),
    decision_note: DECISION_NOTE,
  };

  // ---------------------------------------------------------------------------
  // Second-approval gate
  // Financial threshold OR HIGH execution complexity OR signal-flagged
  // ---------------------------------------------------------------------------

  const financiallyGated =
    recommended.final_score_eur >= scenario_config.second_approval_threshold_eur;
  const complexityGated = recommended.execution_complexity === 'HIGH';
  const signalGated = allUrgentSignals.some(
    (s) => s.recommended_engine_effect === 'flag_second_approval'
  );

  const second_approval_required = financiallyGated || complexityGated || signalGated;

  // exactOptionalPropertyTypes: true — conditionally spread rather than setting to undefined
  const secondApprovalReasonEntry = second_approval_required
    ? {
        second_approval_reason: buildSecondApprovalReason(
          financiallyGated,
          complexityGated,
          signalGated,
          allUrgentSignals,
          recommended,
          scenario_config.second_approval_threshold_eur
        ),
      }
    : {};

  return {
    case_id,
    computed_at: new Date().toISOString(),
    engine_version: ENGINE_VERSION,
    scenarios: ranked,
    recommendation,
    assumptions_log,
    scenario_count: ranked.length,
    second_approval_required,
    ...secondApprovalReasonEntry,
    urgency_signals: allUrgentSignals,
  };
}

// ---------------------------------------------------------------------------
// External signal boost — deterministic, applied to WAIT scenario only
// ---------------------------------------------------------------------------

function applyExternalSignalBoosts(
  scenarios: Scenario[],
  boostSignals: ExternalRiskSignal[]
): Scenario[] {
  // CRITICAL = +0.10 per signal, HIGH = +0.05 per signal — total capped at +0.30
  const rawBoost = boostSignals.reduce(
    (sum, s) => sum + (s.severity === 'CRITICAL' ? 0.10 : 0.05),
    0
  );
  const boost = Math.min(0.30, rawBoost);

  return scenarios.map((s) => {
    if (s.scenario_id !== 'WAIT') return s;

    const new_effective = s.effective_risk_modifier + boost;
    const new_adjusted  = s.base_cost_eur * new_effective;
    const new_final     = new_adjusted + s.strategic_weight_eur;

    const signalLabels = boostSignals.map((sig) => sig.signal_type).join(', ');

    return {
      ...s,
      effective_risk_modifier: new_effective,
      adjusted_cost_eur: new_adjusted,
      final_score_eur: new_final,
      risk_modifier_reason:
        s.risk_modifier_reason +
        ` External signal boost +${boost.toFixed(2)} applied (${signalLabels}).`,
      explanation: {
        ...s.explanation,
        cost_breakdown: {
          ...s.explanation.cost_breakdown,
          risk_modifier_label:
            s.explanation.cost_breakdown.risk_modifier_label +
            ` +${boost.toFixed(2)} external signal boost`,
          adjusted_cost_label: `Adjusted cost: ${formatEur(new_adjusted)}`,
          final_score_label: `Final score: ${formatEur(new_final)}`,
        },
        risk_note:
          s.explanation.risk_note +
          ` Active external signals (${signalLabels}) increase WAIT exposure.`,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

function rankScenarios(
  scenarios: Scenario[],
  tiebreak_preference: string[]
): Scenario[] {
  if (scenarios.length === 0) return [];

  const sorted = [...scenarios].sort((a, b) => {
    if (a.final_score_eur !== b.final_score_eur) {
      return a.final_score_eur - b.final_score_eur;
    }
    const complexityOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    const complexDiff =
      (complexityOrder[a.execution_complexity] ?? 0) -
      (complexityOrder[b.execution_complexity] ?? 0);
    if (complexDiff !== 0) return complexDiff;
    const aIdx = tiebreak_preference.indexOf(a.scenario_id);
    const bIdx = tiebreak_preference.indexOf(b.scenario_id);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return sorted.map((s, i) => ({ ...s, recommended: i === 0 }));
}

// ---------------------------------------------------------------------------
// Recommendation prose builders
// ---------------------------------------------------------------------------

function buildRecommendationReason(
  recommended: Scenario,
  all: Scenario[],
  savings: number,
  urgentSignals: ExternalRiskSignal[]
): string {
  const others = all
    .filter((s) => !s.recommended)
    .map((s) => `${s.scenario_id} (${formatEur(s.final_score_eur)})`)
    .join(', ');

  let reason =
    `This option has the lowest total expected cost (${formatEur(recommended.final_score_eur)}) ` +
    (others ? `compared to ${others}. ` : '. ') +
    (savings > 0
      ? `Estimated saving vs. waiting: ${formatEur(savings)}.`
      : '');

  if (urgentSignals.length > 0) {
    const signalDescriptions = urgentSignals
      .map((s) => `${s.signal_type} at ${s.location ?? s.route ?? 'route'} (${s.severity})`)
      .join('; ');
    reason +=
      ` Active external signal(s): ${signalDescriptions}.` +
      ` DenkKern recommends; the operator reviews and the supervisor approves where required.`;
  }

  return reason;
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

function buildSecondApprovalReason(
  financial: boolean,
  complexity: boolean,
  signal: boolean,
  urgentSignals: ExternalRiskSignal[],
  recommended: Scenario,
  threshold: number
): string {
  const reasons: string[] = [];
  if (financial) {
    reasons.push(
      `recommended scenario cost (${formatEur(recommended.final_score_eur)}) meets or exceeds the ${formatEur(threshold)} supervisor threshold`
    );
  }
  if (complexity) {
    reasons.push(`recommended scenario has HIGH execution complexity`);
  }
  if (signal) {
    const labels = urgentSignals
      .filter((s) => s.recommended_engine_effect === 'flag_second_approval')
      .map((s) => s.signal_type)
      .join(", ");
    reasons.push(`active external signal(s) require supervisor review: ${labels}`);
  }
  return `Supervisor second approval required — ${reasons.join('; ')}.`;
}
