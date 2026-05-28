/**
 * Scenario engine tests — DenkKern
 *
 * All 10 required test cases from docs/architecture/03-scenario-engine.md §8.3
 *
 * These tests use fixed inputs. No mocks, no snapshots, no randomness.
 * The engine is a pure function — same input must always produce same output.
 */

import { describe, it, expect } from 'vitest';
import { runScenarioEngine } from '../engine.js';
import type { ScenarioEngineInput, ScenarioConfig } from '@denkkern/types';
import { DECISION_NOTE } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_CONFIG: ScenarioConfig = {
  version: 'scenario-config-v0.1',
  confidence_tiers: {
    HIGH:   { min_score: 0.75, wait_modifier_increment: 0.0 },
    MEDIUM: { min_score: 0.50, wait_modifier_increment: 0.1 },
    LOW:    { min_score: 0.0,  wait_modifier_increment: 0.2 },
  },
  base_risk_modifiers: {
    WAIT:    1.2,
    REROUTE: 1.1,
    REPLACE: 1.0,
  },
  strategic_weights_eur: {
    WAIT:    0,
    REROUTE: 0,
    REPLACE: 0,
  },
  risk_level_thresholds: {
    LOW_max_days:    2,
    MEDIUM_max_days: 5,
  },
  tiebreak_preference: ['REPLACE', 'REROUTE', 'WAIT'],
};

/** Lena 2.0 Hamburg case — the canonical MVP input */
const LENA_INPUT: ScenarioEngineInput = {
  case_id: 'CASE-001',
  prediction_snapshot: {
    shipment_id: 'SHIP-001',
    model_version: 'eta-delay-v0.1',
    generated_at: '2026-05-25T08:30:00Z',
    eta: {
      baseline:    '2026-05-28',
      expected:    '2026-06-02',
      optimistic:  '2026-05-30',
      pessimistic: '2026-06-06',
    },
    delay: {
      expected_delay_days: 5,
      p_delay_over_3_days: 0.72,
      confidence_score:    0.68,     // MEDIUM tier
    },
    risk_drivers: [
      { type: 'strike_risk',         location: 'Hamburg',       severity: 'medium', estimated_impact_days: 2 },
      { type: 'port_congestion',     location: 'Amsterdam',     severity: 'low',    estimated_impact_days: 1 },
      { type: 'maritime_disruption', location: 'Bay of Biscay', severity: 'medium', estimated_impact_days: 2 },
    ],
  },
  erp_context: {
    daily_downtime_cost_eur: 150_000,
    required_by: '2026-05-28',
    inventory: {
      replacement_available:    true,
      replacement_location:     'Poland warehouse',
      replacement_cost_eur:     500_000,
      replacement_arrival_date: '2026-05-27',
    },
  },
  freight_options: [
    {
      option_id:              'FRT-AMS-001',
      from:                   'Amsterdam',
      to:                     'Hamburg',
      cost_eur:               200_000,
      estimated_arrival_date: '2026-05-30',
      confidence_score:       0.70,
    },
  ],
  active_risk_signals: [
    { type: 'strike_risk', location: 'Hamburg', severity: 'medium', estimated_impact_days: 2, source: 'simulated' },
  ],
  scenario_config: BASE_CONFIG,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lenaResult() {
  return runScenarioEngine(LENA_INPUT);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runScenarioEngine — Lena 2.0 Hamburg case', () => {

  // §8.3 case 1: WAIT scores higher than REPLACE when delay days are high
  it('WAIT final_score > REPLACE final_score when delay is 5 days', () => {
    const result = lenaResult();
    const wait    = result.scenarios.find(s => s.scenario_id === 'WAIT')!;
    const replace = result.scenarios.find(s => s.scenario_id === 'REPLACE')!;
    expect(wait.final_score_eur).toBeGreaterThan(replace.final_score_eur);
  });

  // §8.3 case 2: MEDIUM confidence (0.50–0.74) increases WAIT effective modifier to 1.3
  it('MEDIUM confidence (0.68) raises WAIT effective modifier to 1.3', () => {
    const result = lenaResult();
    const wait = result.scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.confidence_tier).toBe('MEDIUM');
    expect(wait.confidence_increment).toBe(0.1);
    expect(wait.effective_risk_modifier).toBeCloseTo(1.3);
  });

  // §8.3 case 3: LOW confidence (< 0.50) increases WAIT effective modifier to 1.4
  it('LOW confidence (0.40) raises WAIT effective modifier to 1.4', () => {
    const input: ScenarioEngineInput = {
      ...LENA_INPUT,
      prediction_snapshot: {
        ...LENA_INPUT.prediction_snapshot,
        delay: { ...LENA_INPUT.prediction_snapshot.delay, confidence_score: 0.40 },
      },
    };
    const result = runScenarioEngine(input);
    const wait = result.scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.confidence_tier).toBe('LOW');
    expect(wait.confidence_increment).toBe(0.2);
    expect(wait.effective_risk_modifier).toBeCloseTo(1.4);
  });

  // §8.3 case 4: HIGH confidence (≥ 0.75) leaves WAIT modifier at base 1.2
  it('HIGH confidence (0.80) leaves WAIT modifier at base 1.2', () => {
    const input: ScenarioEngineInput = {
      ...LENA_INPUT,
      prediction_snapshot: {
        ...LENA_INPUT.prediction_snapshot,
        delay: { ...LENA_INPUT.prediction_snapshot.delay, confidence_score: 0.80 },
      },
    };
    const result = runScenarioEngine(input);
    const wait = result.scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.confidence_tier).toBe('HIGH');
    expect(wait.confidence_increment).toBe(0);
    expect(wait.effective_risk_modifier).toBeCloseTo(1.2);
  });

  // §8.3 case 5: Confidence tier and increment are present in explanation
  it('risk_modifier_reason contains confidence tier and increment for WAIT', () => {
    const result = lenaResult();
    const wait = result.scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.risk_modifier_reason).toContain('0.1');      // increment
    expect(wait.risk_modifier_reason.toLowerCase()).toContain('medium');
    expect(wait.explanation.cost_breakdown.risk_modifier_label).toContain('1.3');
  });

  // §8.3 case 6: REPLACE is absent when replacement_available = false
  it('REPLACE scenario is absent when inventory.replacement_available = false', () => {
    const input: ScenarioEngineInput = {
      ...LENA_INPUT,
      erp_context: {
        ...LENA_INPUT.erp_context,
        inventory: { replacement_available: false },
      },
    };
    const result = runScenarioEngine(input);
    const replace = result.scenarios.find(s => s.scenario_id === 'REPLACE');
    expect(replace).toBeUndefined();
  });

  // §8.3 case 6 (corollary): REROUTE is absent when freight_options is empty
  it('REROUTE scenario is absent when freight_options is empty', () => {
    const input: ScenarioEngineInput = { ...LENA_INPUT, freight_options: [] };
    const result = runScenarioEngine(input);
    const reroute = result.scenarios.find(s => s.scenario_id === 'REROUTE');
    expect(reroute).toBeUndefined();
  });

  // §8.3 case 7: Tiebreak logic resolves correctly
  //
  // Architecture (03-scenario-engine.md §5):
  //   1. Sort by final_score_eur ascending
  //   2. Tie on score → prefer LOWER execution_complexity
  //   3. Tie on complexity → use tiebreak_preference order
  //
  // WAIT=LOW, REROUTE=MEDIUM, REPLACE=HIGH complexity — always different.
  // So when all final scores are equal, WAIT wins (lowest complexity).
  // tiebreak_preference ['REPLACE','REROUTE','WAIT'] is the last resort for
  // scenarios of the SAME type competing (e.g. multiple REROUTE options).
  it('tiebreak: when all scores equal, WAIT wins on lowest execution_complexity', () => {
    const input: ScenarioEngineInput = {
      ...LENA_INPUT,
      prediction_snapshot: {
        ...LENA_INPUT.prediction_snapshot,
        delay: { ...LENA_INPUT.prediction_snapshot.delay, expected_delay_days: 0 },
      },
      erp_context: {
        ...LENA_INPUT.erp_context,
        inventory: {
          replacement_available:    true,
          replacement_cost_eur:     0,
          replacement_location:     'Poland warehouse',
          replacement_arrival_date: '2026-05-27',
        },
      },
      freight_options: [
        { ...LENA_INPUT.freight_options[0]!, cost_eur: 0, estimated_arrival_date: '2026-05-28' },
      ],
    };
    const result = runScenarioEngine(input);
    // All final_score_eur = 0 → complexity tiebreak applies
    // WAIT(LOW=0) < REROUTE(MEDIUM=1) < REPLACE(HIGH=2) → WAIT recommended
    const recommended = result.scenarios.find(s => s.recommended)!;
    expect(recommended.scenario_id).toBe('WAIT');
    expect(recommended.execution_complexity).toBe('LOW');
  });

  // §8.3 case 8: recommended flag is set on exactly one scenario
  it('exactly one scenario has recommended = true', () => {
    const result = lenaResult();
    const recommended = result.scenarios.filter(s => s.recommended);
    expect(recommended).toHaveLength(1);
  });

  // §8.3 case 9: decision_note string is always present in recommendation
  it('recommendation.decision_note is the fixed governance string', () => {
    const result = lenaResult();
    expect(result.recommendation.decision_note).toBe(DECISION_NOTE);
    expect(result.recommendation.decision_note).toBe(
      'The system ranks and explains. Lena makes the final decision.'
    );
  });

  // §8.3 case 10: Assumptions log contains immutable copy of James' prediction fields
  it('assumptions_log.prediction_snapshot matches prediction_snapshot.delay exactly', () => {
    const result = lenaResult();
    const log = result.assumptions_log.prediction_snapshot;
    const src = LENA_INPUT.prediction_snapshot.delay;
    expect(log.expected_delay_days).toBe(src.expected_delay_days);
    expect(log.p_delay_over_3_days).toBe(src.p_delay_over_3_days);
    expect(log.confidence_score).toBe(src.confidence_score);
    expect(log.model_version).toBe(LENA_INPUT.prediction_snapshot.model_version);
  });
});

describe('runScenarioEngine — scoring formula verification (Lena 2.0 numbers)', () => {

  it('WAIT: production_loss = 5 × 150,000 = 750,000', () => {
    const wait = lenaResult().scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.production_loss_eur).toBe(750_000);
  });

  it('WAIT: base_cost = 0 + 750,000 = 750,000', () => {
    const wait = lenaResult().scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.base_cost_eur).toBe(750_000);
  });

  it('WAIT: adjusted_cost = 750,000 × 1.3 = 975,000', () => {
    const wait = lenaResult().scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.adjusted_cost_eur).toBeCloseTo(975_000);
  });

  it('WAIT: final_score = 975,000', () => {
    const wait = lenaResult().scenarios.find(s => s.scenario_id === 'WAIT')!;
    expect(wait.final_score_eur).toBeCloseTo(975_000);
  });

  it('REPLACE: production_loss = 0 × 150,000 = 0', () => {
    const replace = lenaResult().scenarios.find(s => s.scenario_id === 'REPLACE')!;
    expect(replace.production_loss_eur).toBe(0);
  });

  it('REPLACE: base_cost = 500,000 + 0 = 500,000', () => {
    const replace = lenaResult().scenarios.find(s => s.scenario_id === 'REPLACE')!;
    expect(replace.base_cost_eur).toBe(500_000);
  });

  it('REPLACE: adjusted_cost = 500,000 × 1.0 = 500,000', () => {
    const replace = lenaResult().scenarios.find(s => s.scenario_id === 'REPLACE')!;
    expect(replace.adjusted_cost_eur).toBe(500_000);
  });

  it('REPLACE is recommended (lowest final_score_eur: 500,000)', () => {
    const replace = lenaResult().scenarios.find(s => s.scenario_id === 'REPLACE')!;
    expect(replace.recommended).toBe(true);
    expect(replace.final_score_eur).toBe(500_000);
  });

  it('scenario_count equals scenarios.length', () => {
    const result = lenaResult();
    expect(result.scenario_count).toBe(result.scenarios.length);
  });

  it('result.recommendation.recommended_option_id is REPLACE', () => {
    expect(lenaResult().recommendation.recommended_option_id).toBe('REPLACE');
  });

  it('estimated_savings_vs_waiting = WAIT(975k) - REPLACE(500k) = 475,000', () => {
    const result = lenaResult();
    expect(result.recommendation.estimated_savings_vs_waiting_eur).toBeCloseTo(475_000);
  });
});

describe('runScenarioEngine — determinism', () => {

  it('same input produces identical output on repeated calls', () => {
    const r1 = runScenarioEngine(LENA_INPUT);
    const r2 = runScenarioEngine(LENA_INPUT);
    // Exclude timestamps (computed_at, assumptions_log.generated_at)
    expect(r1.scenarios.map(s => s.final_score_eur))
      .toEqual(r2.scenarios.map(s => s.final_score_eur));
    expect(r1.recommendation.recommended_option_id)
      .toBe(r2.recommendation.recommended_option_id);
    expect(r1.scenario_count).toBe(r2.scenario_count);
  });
});
