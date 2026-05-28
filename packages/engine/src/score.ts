/**
 * Core scoring formula — DenkKern scenario engine
 *
 * All scoring is deterministic. Same inputs → same outputs, always.
 * Source of truth: docs/architecture/03-scenario-engine.md §4
 */

import type {
  Scenario,
  ScenarioConfig,
  ScenarioType,
  ExecutionComplexity,
  ConfidenceTier,
} from '@denkkern/types';

import {
  classifyRiskLevel,
  getConfidenceIncrement,
  formatEur,
} from './classify.js';

export interface ScoreInput {
  scenario_id: string;
  name: string;
  description: string;
  scenario_type: ScenarioType;
  action_cost_eur: number;
  expected_delay_days: number;
  daily_production_loss_eur: number;
  confidence_tier: ConfidenceTier;
  execution_complexity: ExecutionComplexity;
  config: ScenarioConfig;
  data_sources: string[];
}

/**
 * Apply the four-step scoring formula to a scenario input.
 * Returns a fully-scored Scenario (recommended defaults to false — set by ranking step).
 *
 * Step 1: base_cost = action_cost + (delay_days × daily_loss)
 * Step 2: confidence_increment — only for WAIT
 * Step 3: adjusted_cost = base_cost × (base_modifier + confidence_increment)
 * Step 4: final_score = adjusted_cost + strategic_weight
 */
export function scoreScenario(input: ScoreInput): Scenario {
  const {
    scenario_id,
    name,
    description,
    scenario_type,
    action_cost_eur,
    expected_delay_days,
    daily_production_loss_eur,
    confidence_tier,
    execution_complexity,
    config,
    data_sources,
  } = input;

  const isWait = scenario_type === 'wait';

  // Step 1: base cost
  const production_loss_eur = expected_delay_days * daily_production_loss_eur;
  const base_cost_eur = action_cost_eur + production_loss_eur;

  // Step 2 + 3: risk adjustment
  const baseModifierKey = scenario_id as keyof typeof config.base_risk_modifiers;
  const base_risk_modifier = config.base_risk_modifiers[baseModifierKey] ?? 1.0;
  const confidence_increment = getConfidenceIncrement(confidence_tier, isWait, config);
  const effective_risk_modifier = base_risk_modifier + confidence_increment;
  const adjusted_cost_eur = base_cost_eur * effective_risk_modifier;

  // Step 4: strategic weight
  const weightKey = scenario_id as keyof typeof config.strategic_weights_eur;
  const strategic_weight_eur = config.strategic_weights_eur[weightKey] ?? 0;
  const final_score_eur = adjusted_cost_eur + strategic_weight_eur;

  // Risk level (informational — not used in scoring)
  const risk_level = classifyRiskLevel(expected_delay_days, config);

  // Explainability labels
  const action_cost_label =
    action_cost_eur === 0
      ? 'No direct action cost'
      : `Action cost: ${formatEur(action_cost_eur)}`;

  const production_loss_label =
    expected_delay_days === 0
      ? `0 days × ${formatEur(daily_production_loss_eur)} = €0`
      : `${expected_delay_days} days × ${formatEur(daily_production_loss_eur)} = ${formatEur(production_loss_eur)}`;

  const risk_modifier_label = buildRiskModifierLabel(
    base_risk_modifier,
    confidence_increment,
    confidence_tier,
    isWait
  );

  const strategic_weight_label =
    strategic_weight_eur === 0
      ? 'No strategic adjustment'
      : `Strategic adjustment: ${formatEur(strategic_weight_eur)}`;

  const risk_modifier_reason = buildRiskModifierReason(
    base_risk_modifier,
    confidence_increment,
    confidence_tier,
    isWait,
    scenario_type
  );

  const strategic_weight_reason =
    strategic_weight_eur === 0
      ? 'No strategic adjustment'
      : `Strategic weight applied: ${formatEur(strategic_weight_eur)}`;

  const key_assumption = buildKeyAssumption(scenario_type, expected_delay_days, confidence_tier);

  const risk_note = buildRiskNote(scenario_type, risk_level);

  return {
    scenario_id,
    name,
    description,
    scenario_type,
    action_cost_eur,
    expected_delay_days,
    daily_production_loss_eur,
    production_loss_eur,
    base_cost_eur,
    confidence_tier,
    confidence_increment,
    base_risk_modifier,
    effective_risk_modifier,
    adjusted_cost_eur,
    risk_modifier_reason,
    strategic_weight_eur,
    strategic_weight_reason,
    final_score_eur,
    risk_level,
    execution_complexity,
    recommended: false, // set by ranking step
    explanation: {
      cost_breakdown: {
        action_cost_label,
        production_loss_label,
        base_cost_label: `Base cost: ${formatEur(base_cost_eur)}`,
        risk_modifier_label,
        adjusted_cost_label: `Adjusted cost: ${formatEur(adjusted_cost_eur)}`,
        strategic_weight_label,
        final_score_label: `Final score: ${formatEur(final_score_eur)}`,
      },
      key_assumption,
      risk_note,
      data_sources,
    },
  };
}

// ---------------------------------------------------------------------------
// Label builders
// ---------------------------------------------------------------------------

function buildRiskModifierLabel(
  base: number,
  increment: number,
  tier: ConfidenceTier,
  isWait: boolean
): string {
  if (!isWait || increment === 0) {
    return `Risk modifier ×${base.toFixed(1)} (no confidence adjustment)`;
  }
  const effective = base + increment;
  return `Risk modifier ×${effective.toFixed(1)} (base ×${base.toFixed(1)} + ${increment.toFixed(1)} ${tier.toLowerCase()} confidence uncertainty)`;
}

function buildRiskModifierReason(
  base: number,
  increment: number,
  tier: ConfidenceTier,
  isWait: boolean,
  type: ScenarioType
): string {
  if (type === 'replace') {
    return 'No risk modifier adjustment (REPLACE has fixed supplier cost)';
  }
  if (type === 'reroute') {
    return `Reroute risk modifier ×${base.toFixed(1)} (freight logistics risk)`;
  }
  // WAIT
  if (increment === 0) {
    return `Delay risk modifier ×${base.toFixed(1)} (delays commonly exceed prediction) — confidence HIGH, no uncertainty increment`;
  }
  const effective = base + increment;
  return (
    `Delay risk modifier ×${base.toFixed(1)} (delays commonly exceed prediction) ` +
    `+ ${increment.toFixed(1)} uncertainty increment (prediction confidence: ${tierLabel(tier)})`
  );
}

function buildKeyAssumption(
  type: ScenarioType,
  delayDays: number,
  tier: ConfidenceTier
): string {
  switch (type) {
    case 'wait':
      return `Delay of ${delayDays} days based on James' model (confidence: ${tierLabel(tier)})`;
    case 'reroute':
      return `Rerouting reduces delay to ${delayDays} days; freight arrival estimate is firm`;
    case 'replace':
      return `Replacement parts available and confirmed to arrive before production deadline`;
  }
}

function buildRiskNote(type: ScenarioType, risk_level: string): string {
  switch (type) {
    case 'wait':
      return 'Active disruption signals (port congestion, strike risk) may extend delay beyond model estimate';
    case 'reroute':
      return risk_level === 'LOW'
        ? 'Freight option carries execution risk — confirm availability before committing'
        : 'Reroute still results in partial delay; confirm freight ETA is reliable';
    case 'replace':
      return 'Requires procurement action — highest execution complexity of the three options';
  }
}

function tierLabel(tier: ConfidenceTier): string {
  switch (tier) {
    case 'HIGH': return 'High — no uncertainty adjustment';
    case 'MEDIUM': return 'Medium — uncertainty risk applied';
    case 'LOW': return 'Low — elevated uncertainty risk applied';
  }
}
