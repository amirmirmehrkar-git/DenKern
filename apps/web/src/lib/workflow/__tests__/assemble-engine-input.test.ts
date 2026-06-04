/**
 * assemble-engine-input.test.ts — H-9
 *
 * Tests for assembleScenarioEngineInput(): the pure mapping function that
 * converts a DisruptionContext snapshot into ScenarioEngineInput + BusinessFactors.
 *
 * Focus areas:
 *   - Weather / news signal mapping → ActiveRiskSignal[]
 *   - BusinessFactors optional-field fallbacks
 *   - external_risk_signals pass-through vs omission
 *   - business_factors always carried through
 */

import { describe, it, expect } from 'vitest';
import { assembleScenarioEngineInput } from '../assemble-engine-input.js';
import type {
  DisruptionContext,
  ScenarioConfig,
  ShipmentContext,
  ExternalRiskSignal,
} from '@denkkern/types';

// ---------------------------------------------------------------------------
// Minimal builders
// ---------------------------------------------------------------------------

function makeConfig(): ScenarioConfig {
  return {
    version: 'test-v0',
    second_approval_threshold_eur: 300_000,
    confidence_tiers: {
      HIGH:   { min_score: 0.7, wait_modifier_increment: 0.0 },
      MEDIUM: { min_score: 0.4, wait_modifier_increment: 0.1 },
      LOW:    { min_score: 0.0, wait_modifier_increment: 0.2 },
    },
    base_risk_modifiers:   { WAIT: 1.3, REROUTE: 1.1, REPLACE: 1.0 },
    strategic_weights_eur: { WAIT: 0, REROUTE: 0, REPLACE: 0 },
    risk_level_thresholds: { LOW_max_days: 2, MEDIUM_max_days: 5 },
    tiebreak_preference:   ['REPLACE', 'REROUTE', 'WAIT'],
  };
}

function makeShipmentContext(overrides: Partial<ShipmentContext['production_context']> = {}): ShipmentContext {
  return {
    shipment_id: 'SHIP-001',
    shipment_name: 'Test Shipment',
    destination: 'Hamburg',
    customer_id: 'CUST-001',
    production_context: {
      daily_downtime_cost_eur: 150_000,
      critical_part: 'Marine bolts',
      required_by: '2026-05-28',
      ...overrides,
    },
    inventory: {
      replacement_available: false,
    },
    freight_options: [],
  };
}

function makeDisruptionContext(
  overrides: Partial<DisruptionContext> = {},
  productionOverrides: Partial<ShipmentContext['production_context']> = {}
): DisruptionContext {
  return {
    case_id: 'CASE-001',
    shipment_id: 'SHIP-001',
    assembled_at: '2026-06-04T00:00:00Z',
    prediction: {
      shipment_id: 'SHIP-001',
      model_version: 'test-v0',
      generated_at: '2026-06-04T00:00:00Z',
      eta: {
        baseline:   '2026-05-28',
        expected:   '2026-06-02',
        optimistic: '2026-05-30',
        pessimistic:'2026-06-06',
      },
      delay: {
        expected_delay_days: 5,
        p_delay_over_3_days: 0.72,
        confidence_score:    0.68,
      },
      risk_drivers: [],
    },
    shipment_context: makeShipmentContext(productionOverrides),
    ...overrides,
  };
}

function makeExternalSignal(signalId: string): ExternalRiskSignal {
  return {
    signal_id:   signalId,
    signal_type: 'PORT_STRIKE',
    severity:    'HIGH',
    confidence:  0.8,
    source_type: 'simulated',
    source_name: 'fixture/test',
    location:    'Hamburg',
    time_window: { valid_from: '2026-06-01' },
    description: 'Test signal',
    decision_relevance: 'Test relevance',
    recommended_engine_effect: 'increase_urgency',
  };
}

// ---------------------------------------------------------------------------
// assembleScenarioEngineInput — core mapping
// ---------------------------------------------------------------------------

describe('assembleScenarioEngineInput', () => {
  describe('basic field mapping', () => {
    it('threads case_id through to engineInput', () => {
      const ctx = makeDisruptionContext();
      const { engineInput } = assembleScenarioEngineInput('CASE-999', ctx, makeConfig());
      expect(engineInput.case_id).toBe('CASE-999');
    });

    it('passes prediction snapshot by reference', () => {
      const ctx = makeDisruptionContext();
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.prediction_snapshot).toBe(ctx.prediction);
    });

    it('maps erp_context fields from shipment_context.production_context', () => {
      const ctx = makeDisruptionContext();
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.erp_context.daily_downtime_cost_eur).toBe(150_000);
      expect(engineInput.erp_context.required_by).toBe('2026-05-28');
      expect(engineInput.erp_context.inventory).toBe(ctx.shipment_context.inventory);
    });

    it('passes freight_options from shipment_context', () => {
      const ctx = makeDisruptionContext();
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.freight_options).toBe(ctx.shipment_context.freight_options);
    });

    it('passes scenario_config by reference', () => {
      const ctx = makeDisruptionContext();
      const config = makeConfig();
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, config);
      expect(engineInput.scenario_config).toBe(config);
    });
  });

  describe('active_risk_signals mapping', () => {
    it('produces empty active_risk_signals when no weather or news signals', () => {
      const ctx = makeDisruptionContext();
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.active_risk_signals).toHaveLength(0);
    });

    it('maps weather_signal to an ActiveRiskSignal', () => {
      const ctx = makeDisruptionContext({
        weather_signal: {
          route_id: 'route-north-atlantic',
          severity: 'high',
          description: 'Gale force winds',
          estimated_delay_impact_days: 2,
          source: 'simulated',
        },
      });
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.active_risk_signals).toHaveLength(1);
      const ws = engineInput.active_risk_signals[0];
      expect(ws?.type).toBe('weather_disruption');
      expect(ws?.location).toBe('route-north-atlantic');
      expect(ws?.severity).toBe('high');
      expect(ws?.estimated_impact_days).toBe(2);
      expect(ws?.source).toBe('simulated');
    });

    it('maps each news_signal to an ActiveRiskSignal', () => {
      const ctx = makeDisruptionContext({
        news_signals: [
          {
            region_id: 'hamburg-port',
            event_type: 'strike_risk',
            severity: 'medium',
            description: 'Warning strike',
            estimated_delay_impact_days: 2,
            source: 'simulated',
          },
          {
            region_id: 'rotterdam-port',
            event_type: 'port_congestion',
            severity: 'low',
            description: 'Congestion',
            estimated_delay_impact_days: 1,
            source: 'simulated',
          },
        ],
      });
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.active_risk_signals).toHaveLength(2);
      expect(engineInput.active_risk_signals[0]?.type).toBe('strike_risk');
      expect(engineInput.active_risk_signals[0]?.location).toBe('hamburg-port');
      expect(engineInput.active_risk_signals[1]?.type).toBe('port_congestion');
    });

    it('combines weather_signal and news_signals', () => {
      const ctx = makeDisruptionContext({
        weather_signal: {
          route_id: 'bay-of-biscay',
          severity: 'medium',
          description: 'Swell',
          estimated_delay_impact_days: 1,
          source: 'simulated',
        },
        news_signals: [
          {
            region_id: 'hamburg-port',
            event_type: 'strike_risk',
            severity: 'high',
            description: 'Strike',
            estimated_delay_impact_days: 2,
            source: 'simulated',
          },
        ],
      });
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.active_risk_signals).toHaveLength(2);
    });
  });

  describe('external_risk_signals pass-through', () => {
    it('includes external_risk_signals when present and non-empty', () => {
      const signals = [makeExternalSignal('ERS-001'), makeExternalSignal('ERS-002')];
      const ctx = makeDisruptionContext({ external_risk_signals: signals });
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.external_risk_signals).toBeDefined();
      expect(engineInput.external_risk_signals).toHaveLength(2);
    });

    it('omits external_risk_signals key when array is empty', () => {
      const ctx = makeDisruptionContext({ external_risk_signals: [] });
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.external_risk_signals).toBeUndefined();
    });

    it('omits external_risk_signals key when absent from context', () => {
      const ctx = makeDisruptionContext();
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.external_risk_signals).toBeUndefined();
    });
  });

  describe('BusinessFactors fallbacks', () => {
    it('carries cost_of_delay_eur_per_day directly', () => {
      const ctx = makeDisruptionContext();
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.cost_of_delay_eur_per_day).toBe(150_000);
    });

    it('defaults inventory_buffer_days to 0 when absent', () => {
      const ctx = makeDisruptionContext();
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.inventory_buffer_days).toBe(0);
    });

    it('uses inventory_buffer_days when provided', () => {
      const ctx = makeDisruptionContext({}, { inventory_buffer_days: 3 });
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.inventory_buffer_days).toBe(3);
    });

    it('defaults part_criticality to "LOW" when absent', () => {
      const ctx = makeDisruptionContext();
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.part_criticality).toBe('LOW');
    });

    it('uses part_criticality when provided', () => {
      const ctx = makeDisruptionContext({}, { part_criticality: 'HIGH' });
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.part_criticality).toBe('HIGH');
    });

    it('defaults affected_production_lines to 1 when absent', () => {
      const ctx = makeDisruptionContext();
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.affected_production_lines).toBe(1);
    });

    it('uses affected_production_lines when provided', () => {
      const ctx = makeDisruptionContext({}, { affected_production_lines: 4 });
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.affected_production_lines).toBe(4);
    });

    it('defaults contract_penalty_eur_per_day to 0 when absent', () => {
      const ctx = makeDisruptionContext();
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.contract_penalty_eur_per_day).toBe(0);
    });

    it('defaults contract_penalty_trigger_day to 0 when absent', () => {
      const ctx = makeDisruptionContext();
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.contract_penalty_trigger_day).toBe(0);
    });

    it('carries all business factors when fully provided', () => {
      const ctx = makeDisruptionContext({}, {
        inventory_buffer_days:        5,
        part_criticality:             'MEDIUM',
        affected_production_lines:    3,
        contract_penalty_eur_per_day: 10_000,
        contract_penalty_trigger_day: 2,
      });
      const { businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(businessFactors.inventory_buffer_days).toBe(5);
      expect(businessFactors.part_criticality).toBe('MEDIUM');
      expect(businessFactors.affected_production_lines).toBe(3);
      expect(businessFactors.contract_penalty_eur_per_day).toBe(10_000);
      expect(businessFactors.contract_penalty_trigger_day).toBe(2);
    });
  });

  describe('business_factors on engineInput', () => {
    it('always includes business_factors on the engineInput', () => {
      const ctx = makeDisruptionContext();
      const { engineInput } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.business_factors).toBeDefined();
      expect(engineInput.business_factors?.cost_of_delay_eur_per_day).toBe(150_000);
    });

    it('businessFactors and engineInput.business_factors are the same object', () => {
      const ctx = makeDisruptionContext();
      const { engineInput, businessFactors } = assembleScenarioEngineInput('CASE-001', ctx, makeConfig());
      expect(engineInput.business_factors).toBe(businessFactors);
    });
  });
});
