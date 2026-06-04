/**
 * approval-gate.test.ts
 *
 * Tests for requiresSecondApproval() and validateApprovalEmitter().
 *
 * requiresSecondApproval() evaluates three criteria:
 *   1. Financial risk — recommended.final_score_eur >= threshold
 *   2. Operational risk — recommended.execution_complexity === 'HIGH'
 *   3. External risk — any riskSignal.severity === 'high'
 *
 * NOTE: The Scenario Engine is the authoritative evaluator of these criteria
 * (see ScenarioResult.second_approval_required). This function is used for
 * standalone gate evaluation (tests, tooling) and its criterion 3 uses the
 * legacy ActiveRiskSignal[] type (lowercase severity).
 */

import { describe, it, expect } from 'vitest';
import {
  requiresSecondApproval,
  validateApprovalEmitter,
  FORBIDDEN_APPROVAL_EMITTERS,
} from '../approval-gate.js';
import type { ScenarioResult, ScenarioConfig, ActiveRiskSignal } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Minimal test builders
// Only populate fields read by requiresSecondApproval(). Use `as unknown as`
// to avoid satisfying all Scenario/ScenarioResult fields in test helpers.
// ---------------------------------------------------------------------------

const THRESHOLD_EUR = 300_000;

/** Minimal ScenarioConfig for gate tests */
function makeConfig(threshold = THRESHOLD_EUR): ScenarioConfig {
  return {
    version: 'test-v0',
    second_approval_threshold_eur: threshold,
    confidence_tiers: {
      HIGH:   { min_score: 0.7, wait_modifier_increment: 0.0 },
      MEDIUM: { min_score: 0.4, wait_modifier_increment: 0.1 },
      LOW:    { min_score: 0.0, wait_modifier_increment: 0.2 },
    },
    base_risk_modifiers: { WAIT: 1.3, REROUTE: 1.1, REPLACE: 1.0 },
    strategic_weights_eur: { WAIT: 0, REROUTE: 0, REPLACE: 0 },
    risk_level_thresholds: { LOW_max_days: 2, MEDIUM_max_days: 5 },
    tiebreak_preference: ['REPLACE', 'REROUTE', 'WAIT'],
    harbor_congestion_weight: 0.15,
  };
}

type MinimalScenario = {
  recommended: boolean;
  final_score_eur: number;
  execution_complexity: 'LOW' | 'MEDIUM' | 'HIGH';
};

/** Build a ScenarioResult with one recommended scenario and controllable fields */
function makeResult(
  recommended: MinimalScenario,
  overrides: Partial<{ second_approval_required: boolean }> = {}
): ScenarioResult {
  return {
    case_id: 'TEST-001',
    computed_at: '2026-06-04T00:00:00Z',
    engine_version: 'test',
    scenario_count: 1,
    scenarios: [recommended] as unknown as ScenarioResult['scenarios'],
    recommendation: {} as unknown as ScenarioResult['recommendation'],
    assumptions_log: {} as unknown as ScenarioResult['assumptions_log'],
    second_approval_required: overrides.second_approval_required ?? false,
    urgency_signals: [],
  };
}

function makeRiskSignal(
  severity: 'low' | 'medium' | 'high',
  type = 'strike_risk',
  location = 'Hamburg'
): ActiveRiskSignal {
  return {
    type,
    location,
    severity,
    estimated_impact_days: 2,
    source: 'simulated',
  };
}

// ---------------------------------------------------------------------------
// requiresSecondApproval
// ---------------------------------------------------------------------------

describe('requiresSecondApproval', () => {
  describe('no recommended scenario', () => {
    it('returns required=false when scenarios array is empty', () => {
      const result = {
        ...makeResult({ recommended: false, final_score_eur: 999_999, execution_complexity: 'HIGH' }),
        scenarios: [],
      } as unknown as ScenarioResult;

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(false);
      expect(gate.reasons).toHaveLength(0);
    });

    it('returns required=false when no scenario is marked recommended', () => {
      const result = makeResult({ recommended: false, final_score_eur: 500_000, execution_complexity: 'HIGH' });

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(false);
    });
  });

  describe('criterion 1 — financial threshold', () => {
    it('fires when final_score_eur equals the threshold exactly', () => {
      const result = makeResult({ recommended: true, final_score_eur: THRESHOLD_EUR, execution_complexity: 'LOW' });

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(true);
      expect(gate.reasons).toHaveLength(1);
      expect(gate.reasons[0]).toContain('€300k');
      expect(gate.reasons[0]).toContain('second-approval threshold');
    });

    it('fires when final_score_eur exceeds the threshold', () => {
      const result = makeResult({ recommended: true, final_score_eur: 500_000, execution_complexity: 'LOW' });

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(true);
      expect(gate.reasons[0]).toContain('€500k');
    });

    it('does not fire when final_score_eur is below the threshold', () => {
      const result = makeResult({ recommended: true, final_score_eur: 299_999, execution_complexity: 'LOW' });

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(false);
      expect(gate.reasons).toHaveLength(0);
    });

    it('fires when threshold is 0 (require approval on all decisions)', () => {
      const result = makeResult({ recommended: true, final_score_eur: 1, execution_complexity: 'LOW' });

      const gate = requiresSecondApproval(result, makeConfig(0));
      expect(gate.required).toBe(true);
    });

    it('reason message includes scenario cost and threshold in rounded thousands', () => {
      const result = makeResult({ recommended: true, final_score_eur: 450_000, execution_complexity: 'LOW' });

      const gate = requiresSecondApproval(result, makeConfig(300_000));
      expect(gate.reasons[0]).toMatch(/€450k/);
      expect(gate.reasons[0]).toMatch(/€300k/);
    });
  });

  describe('criterion 2 — execution complexity', () => {
    it('fires when execution_complexity is HIGH', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'HIGH' });

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(true);
      expect(gate.reasons).toHaveLength(1);
      expect(gate.reasons[0]).toContain('HIGH execution complexity');
    });

    it('does not fire when execution_complexity is MEDIUM', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'MEDIUM' });

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(false);
    });

    it('does not fire when execution_complexity is LOW', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'LOW' });

      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(false);
    });
  });

  describe('criterion 3 — active high-severity risk signal', () => {
    it('fires when a riskSignal has severity "high"', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'LOW' });
      const signals = [makeRiskSignal('high', 'PORT_STRIKE', 'Hamburg')];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(true);
      expect(gate.reasons).toHaveLength(1);
      expect(gate.reasons[0]).toContain('PORT_STRIKE');
      expect(gate.reasons[0]).toContain('Hamburg');
    });

    it('does not fire on severity "medium"', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'LOW' });
      const signals = [makeRiskSignal('medium')];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(false);
    });

    it('does not fire on severity "low"', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'LOW' });
      const signals = [makeRiskSignal('low')];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(false);
    });

    it('fires on the first high-severity signal when multiple signals present', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'LOW' });
      const signals = [
        makeRiskSignal('medium', 'PORT_CONGESTION', 'Rotterdam'),
        makeRiskSignal('high',   'PORT_STRIKE',     'Hamburg'),
        makeRiskSignal('low',    'WEATHER_CONTEXT',  'Kiel'),
      ];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(true);
      expect(gate.reasons).toHaveLength(1);
      expect(gate.reasons[0]).toContain('PORT_STRIKE');
      expect(gate.reasons[0]).toContain('Hamburg');
    });

    it('returns required=false when riskSignals defaults to empty array', () => {
      const result = makeResult({ recommended: true, final_score_eur: 0, execution_complexity: 'LOW' });

      // Called without third argument — default is []
      const gate = requiresSecondApproval(result, makeConfig());
      expect(gate.required).toBe(false);
    });
  });

  describe('multiple criteria', () => {
    it('accumulates reasons for all firing criteria', () => {
      const result = makeResult({ recommended: true, final_score_eur: 500_000, execution_complexity: 'HIGH' });
      const signals = [makeRiskSignal('high', 'PORT_STRIKE', 'Hamburg')];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(true);
      expect(gate.reasons).toHaveLength(3);
    });

    it('accumulates exactly two reasons when criteria 1+2 fire, criterion 3 does not', () => {
      const result = makeResult({ recommended: true, final_score_eur: 400_000, execution_complexity: 'HIGH' });
      const signals = [makeRiskSignal('low')];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(true);
      expect(gate.reasons).toHaveLength(2);
    });

    it('accumulates exactly two reasons when criteria 1+3 fire, criterion 2 does not', () => {
      const result = makeResult({ recommended: true, final_score_eur: 400_000, execution_complexity: 'LOW' });
      const signals = [makeRiskSignal('high', 'WEATHER_CONTEXT', 'North Sea')];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(true);
      expect(gate.reasons).toHaveLength(2);
    });
  });

  describe('no criteria firing', () => {
    it('returns required=false when all criteria are clear', () => {
      const result = makeResult({ recommended: true, final_score_eur: 100_000, execution_complexity: 'LOW' });
      const signals = [makeRiskSignal('low'), makeRiskSignal('medium')];

      const gate = requiresSecondApproval(result, makeConfig(), signals);
      expect(gate.required).toBe(false);
      expect(gate.reasons).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// validateApprovalEmitter
// ---------------------------------------------------------------------------

describe('validateApprovalEmitter', () => {
  it('returns null for a valid named supervisor', () => {
    expect(validateApprovalEmitter('supervisor_maria')).toBeNull();
    expect(validateApprovalEmitter('Jan Müller')).toBeNull();
    expect(validateApprovalEmitter('admin')).toBeNull();
  });

  it('returns an error string for "lena"', () => {
    const result = validateApprovalEmitter('lena');
    expect(result).not.toBeNull();
    expect(result).toContain('lena');
    expect(result).toContain('C2');
  });

  it('returns an error string for "system"', () => {
    const result = validateApprovalEmitter('system');
    expect(result).not.toBeNull();
    expect(result).toContain('system');
  });

  it('is case-insensitive — rejects "LENA"', () => {
    expect(validateApprovalEmitter('LENA')).not.toBeNull();
  });

  it('is case-insensitive — rejects "System"', () => {
    expect(validateApprovalEmitter('System')).not.toBeNull();
  });

  it('trims whitespace before checking', () => {
    expect(validateApprovalEmitter('  lena  ')).not.toBeNull();
    expect(validateApprovalEmitter('  system  ')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FORBIDDEN_APPROVAL_EMITTERS constant
// ---------------------------------------------------------------------------

describe('FORBIDDEN_APPROVAL_EMITTERS', () => {
  it('contains "lena" and "system"', () => {
    expect(FORBIDDEN_APPROVAL_EMITTERS.has('lena')).toBe(true);
    expect(FORBIDDEN_APPROVAL_EMITTERS.has('system')).toBe(true);
  });

  it('is a ReadonlySet — runtime values are enumerable', () => {
    const values = Array.from(FORBIDDEN_APPROVAL_EMITTERS);
    expect(values).toContain('lena');
    expect(values).toContain('system');
  });
});
