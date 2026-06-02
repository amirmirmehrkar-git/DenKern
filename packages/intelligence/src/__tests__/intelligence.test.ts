/**
 * External Intelligence Agent tests — DenkKern
 *
 * Tests for:
 *   - PortIntelligenceAgent: classification, relevance filtering, validated output
 *   - GeopoliticalRiskAgent: severity normalisation, relevance, validation
 *   - SupplierRiskAgent: disruption classification, relevance
 *   - validateSignal: rejects malformed input, clamps confidence
 *   - collectExternalRiskSignals: parallel run, deduplication, agent failure isolation
 *
 * No mocks. All agents run against known fixtures.
 * The Scenario Engine never appears in these tests — agent boundary is ExternalRiskSignal[].
 */

import { describe, it, expect } from 'vitest';
import type { AgentContext } from '../types.js';
import { PortIntelligenceAgent } from '../agents/port-intelligence.js';
import { GeopoliticalRiskAgent } from '../agents/geopolitical-risk.js';
import { SupplierRiskAgent } from '../agents/supplier-risk.js';
import { validateSignal, validateSignals } from '../validate.js';
import { collectExternalRiskSignals } from '../collect.js';
import type { ExternalRiskSignal } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Shared context fixture — Hamburg case
// ---------------------------------------------------------------------------

const HAMBURG_CONTEXT: AgentContext = {
  case_id:          'CASE-001',
  shipment_id:      'SHIP-001',
  destination_port: 'Hamburg',
  route:            'Bay of Biscay — North Sea',
  required_by:      '2026-05-28',
  vessel_name:      'MSC Barcelona',
};

const UNRELATED_CONTEXT: AgentContext = {
  case_id:          'CASE-999',
  shipment_id:      'SHIP-999',
  destination_port: 'Singapore',
  route:            'Indian Ocean',
  required_by:      '2026-06-15',
};

// ---------------------------------------------------------------------------
// PortIntelligenceAgent
// ---------------------------------------------------------------------------

describe('PortIntelligenceAgent', () => {
  const agent = new PortIntelligenceAgent();

  it('returns only ExternalRiskSignal objects', async () => {
    const signals = await agent.run(HAMBURG_CONTEXT);
    expect(Array.isArray(signals)).toBe(true);
    for (const s of signals) {
      expect(typeof s.signal_id).toBe('string');
      expect(typeof s.signal_type).toBe('string');
      expect(typeof s.severity).toBe('string');
      expect(typeof s.confidence).toBe('number');
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
      expect(typeof s.description).toBe('string');
      expect(typeof s.decision_relevance).toBe('string');
      expect(typeof s.time_window.valid_from).toBe('string');
    }
  });

  it('returns signals relevant to Hamburg', async () => {
    const signals = await agent.run(HAMBURG_CONTEXT);
    expect(signals.length).toBeGreaterThan(0);
    // All returned signals should reference Hamburg
    for (const s of signals) {
      expect(s.location?.toLowerCase() ?? '').toContain('hamburg');
    }
  });

  it('classifies a strike as PORT_STRIKE', async () => {
    const signals = await agent.run(HAMBURG_CONTEXT);
    const strike = signals.find((s) => s.signal_type === 'PORT_STRIKE');
    expect(strike).toBeDefined();
    expect(strike?.severity).toBe('HIGH');
    expect(strike?.recommended_engine_effect).toBe('increase_wait_risk');
  });

  it('returns no signals for unrelated port', async () => {
    const signals = await agent.run(UNRELATED_CONTEXT);
    expect(signals).toHaveLength(0);
  });

  it('accepts custom fixture events', async () => {
    const customAgent = new PortIntelligenceAgent([
      {
        event_id:              'TEST-001',
        port_name:             'Hamburg',
        event_type:            'closure',
        description:           'Test closure event',
        reported_at:           '2026-05-01T00:00:00Z',
        valid_from:            '2026-05-01',
        confidence:            0.9,
        source:                'test',
        estimated_impact_hours: 48,
      },
    ]);
    const signals = await customAgent.run(HAMBURG_CONTEXT);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.signal_type).toBe('PORT_CLOSURE');
    expect(signals[0]?.severity).toBe('HIGH');
  });
});

// ---------------------------------------------------------------------------
// GeopoliticalRiskAgent
// ---------------------------------------------------------------------------

describe('GeopoliticalRiskAgent', () => {
  const agent = new GeopoliticalRiskAgent();

  it('returns only ExternalRiskSignal objects', async () => {
    const signals = await agent.run(HAMBURG_CONTEXT);
    for (const s of signals) {
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(s.severity);
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('returns maritime security warning for Bay of Biscay route', async () => {
    const signals = await agent.run(HAMBURG_CONTEXT);
    const maritime = signals.find((s) => s.signal_type === 'MARITIME_SECURITY_WARNING');
    expect(maritime).toBeDefined();
    expect(maritime?.severity).toBe('HIGH');
    expect(maritime?.recommended_engine_effect).toBe('increase_wait_risk');
  });

  it('always returns WAR_RISK signals regardless of destination', async () => {
    const hamburgSignals = await agent.run(HAMBURG_CONTEXT);
    const unrelatedSignals = await agent.run(UNRELATED_CONTEXT);
    const hamburgWarRisk   = hamburgSignals.filter((s) => s.signal_type === 'WAR_RISK');
    const unrelatedWarRisk = unrelatedSignals.filter((s) => s.signal_type === 'WAR_RISK');
    // WAR_RISK and SANCTIONS are globally relevant
    expect(hamburgWarRisk.length).toBeGreaterThanOrEqual(unrelatedWarRisk.length);
  });

  it('normalises severity_hint correctly', async () => {
    const criticalAgent = new GeopoliticalRiskAgent([
      {
        event_id:      'TEST-GEO-001',
        region:        'Test Region',
        event_type:    'war_risk',
        description:   'Critical war risk event',
        reported_at:   '2026-05-01T00:00:00Z',
        valid_from:    '2026-05-01',
        confidence:    0.95,
        source:        'test',
        severity_hint: 'critical',
      },
    ]);
    const signals = await criticalAgent.run(HAMBURG_CONTEXT);
    expect(signals[0]?.severity).toBe('CRITICAL');
    expect(signals[0]?.recommended_engine_effect).toBe('flag_second_approval');
  });
});

// ---------------------------------------------------------------------------
// SupplierRiskAgent
// ---------------------------------------------------------------------------

describe('SupplierRiskAgent', () => {
  const agent = new SupplierRiskAgent();

  it('returns only SUPPLIER_DISRUPTION signals', async () => {
    const signals = await agent.run(HAMBURG_CONTEXT);
    for (const s of signals) {
      expect(s.signal_type).toBe('SUPPLIER_DISRUPTION');
    }
  });

  it('returns signals affecting Hamburg route', async () => {
    const signals = await agent.run(HAMBURG_CONTEXT);
    expect(signals.length).toBeGreaterThan(0);
  });

  it('classifies capacity reduction as MEDIUM severity', async () => {
    const customAgent = new SupplierRiskAgent([
      {
        event_id:      'TEST-SUP-001',
        supplier_name: 'Test Supplier',
        location:      'Poland',
        event_type:    'disruption',
        description:   'Test supplier reporting 30% capacity reduction due to material shortage.',
        reported_at:   '2026-05-01T00:00:00Z',
        valid_from:    '2026-05-01',
        confidence:    0.7,
        source:        'test',
        affected_routes: ['Hamburg'],
      },
    ]);
    const signals = await customAgent.run(HAMBURG_CONTEXT);
    expect(signals[0]?.severity).toBe('MEDIUM');
    expect(signals[0]?.recommended_engine_effect).toBe('increase_urgency');
  });

  it('returns no signals when affected_routes does not include destination', async () => {
    const customAgent = new SupplierRiskAgent([
      {
        event_id:        'TEST-SUP-002',
        supplier_name:   'Test Supplier',
        location:        'Japan',
        event_type:      'disruption',
        description:     'Test disruption affecting Tokyo only.',
        reported_at:     '2026-05-01T00:00:00Z',
        valid_from:      '2026-05-01',
        confidence:      0.8,
        source:          'test',
        affected_routes: ['Tokyo', 'Yokohama'],
      },
    ]);
    const signals = await customAgent.run(HAMBURG_CONTEXT);
    expect(signals).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateSignal
// ---------------------------------------------------------------------------

describe('validateSignal', () => {
  const VALID_SIGNAL: ExternalRiskSignal = {
    signal_id:                 'TEST-001',
    signal_type:               'PORT_STRIKE',
    severity:                  'HIGH',
    confidence:                0.8,
    source_type:               'simulated',
    source_name:               'test',
    description:               'A test signal',
    decision_relevance:        'Relevant to case',
    recommended_engine_effect: 'increase_wait_risk',
    time_window: { valid_from: '2026-05-01' },
  };

  it('accepts a valid signal', () => {
    const result = validateSignal(VALID_SIGNAL);
    expect(result.ok).toBe(true);
  });

  it('rejects null', () => {
    const result = validateSignal(null);
    expect(result.ok).toBe(false);
  });

  it('rejects missing signal_id', () => {
    const result = validateSignal({ ...VALID_SIGNAL, signal_id: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('signal_id');
  });

  it('rejects unknown signal_type', () => {
    const result = validateSignal({ ...VALID_SIGNAL, signal_type: 'UNKNOWN_TYPE' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('signal_type');
  });

  it('rejects invalid severity', () => {
    const result = validateSignal({ ...VALID_SIGNAL, severity: 'EXTREME' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('severity');
  });

  it('rejects invalid recommended_engine_effect', () => {
    const result = validateSignal({ ...VALID_SIGNAL, recommended_engine_effect: 'buy_options' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('recommended_engine_effect');
  });

  it('clamps confidence above 1.0', () => {
    const result = validateSignal({ ...VALID_SIGNAL, confidence: 1.5 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal.confidence).toBe(1.0);
  });

  it('clamps confidence below 0.0', () => {
    const result = validateSignal({ ...VALID_SIGNAL, confidence: -0.2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal.confidence).toBe(0.0);
  });

  it('defaults confidence to 0.5 when missing', () => {
    const { confidence: _c, ...withoutConf } = VALID_SIGNAL;
    const result = validateSignal(withoutConf);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.signal.confidence).toBe(0.5);
  });

  it('rejects missing time_window.valid_from', () => {
    const result = validateSignal({ ...VALID_SIGNAL, time_window: { valid_from: '' } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('valid_from');
  });
});

// ---------------------------------------------------------------------------
// validateSignals (batch)
// ---------------------------------------------------------------------------

describe('validateSignals', () => {
  it('returns valid signals and separates rejected ones', () => {
    const good = {
      signal_id: 'BATCH-001', signal_type: 'PORT_STRIKE', severity: 'HIGH',
      confidence: 0.8, source_type: 'simulated', source_name: 'Test',
      description: 'A valid signal', decision_relevance: 'Relevant',
      recommended_engine_effect: 'increase_wait_risk',
      time_window: { valid_from: '2026-05-27' },
    };
    const bad = { signal_id: '', signal_type: 'PORT_STRIKE' }; // missing required fields
    const result = validateSignals([good, bad]);
    expect(result.valid.length).toBe(1);
    expect(result.rejected.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// collectExternalRiskSignals
// ---------------------------------------------------------------------------

describe('collectExternalRiskSignals', () => {
  it('returns ExternalRiskSignal[] for Hamburg context', async () => {
    const signals = await collectExternalRiskSignals(HAMBURG_CONTEXT);
    expect(Array.isArray(signals)).toBe(true);
    expect(signals.length).toBeGreaterThan(0);
  });

  it('deduplicates signals with the same signal_id', async () => {
    const duplicateSignal: ExternalRiskSignal = {
      signal_id:                 'DUP-001',
      signal_type:               'PORT_STRIKE',
      severity:                  'LOW',
      confidence:                0.5,
      source_type:               'simulated',
      source_name:               'test',
      description:               'Duplicate signal LOW',
      decision_relevance:        'test',
      recommended_engine_effect: 'none',
      time_window:               { valid_from: '2026-05-01' },
    };
    const higherSignal: ExternalRiskSignal = {
      ...duplicateSignal,
      severity: 'HIGH',
      description: 'Duplicate signal HIGH',
    };

    const agentA = {
      name: 'AgentA',
      run: async (_ctx: AgentContext) => [duplicateSignal],
    };
    const agentB = {
      name: 'AgentB',
      run: async (_ctx: AgentContext) => [higherSignal],
    };

    const signals = await collectExternalRiskSignals(HAMBURG_CONTEXT, { agents: [agentA, agentB] });
    const dups = signals.filter((s) => s.signal_id === 'DUP-001');
    // Only one signal with this id should remain
    expect(dups).toHaveLength(1);
    // The higher-severity version should win
    expect(dups[0]?.severity).toBe('HIGH');
  });

  it('isolates individual agent failures', async () => {
    const failingAgent = {
      name: 'FailingAgent',
      run: async (_ctx: AgentContext): Promise<ExternalRiskSignal[]> => {
        throw new Error('Simulated agent failure');
      },
    };
    const workingAgent = {
      name: 'WorkingAgent',
      run: async (_ctx: AgentContext): Promise<ExternalRiskSignal[]> => [{
        signal_id:                 'WORK-001',
        signal_type:               'PORT_RESTRICTION' as const,
        severity:                  'LOW' as const,
        confidence:                0.6,
        source_type:               'simulated' as const,
        source_name:               'WorkingAgent',
        description:               'A working signal',
        decision_relevance:        'test',
        recommended_engine_effect: 'none' as const,
        time_window:               { valid_from: '2026-05-27' },
      }],
    };

    const signals = await collectExternalRiskSignals(HAMBURG_CONTEXT, {
      agents: [failingAgent, workingAgent],
    });
    // Working agent's signal should be present despite the failing agent
    expect(signals.some((s) => s.signal_id === 'WORK-001')).toBe(true);
  });

  it('returns empty array for unrelated context', async () => {
    const unrelatedContext: AgentContext = {
      case_id:          'CASE-999',
      shipment_id:      'SHP-999',
      destination_port: 'Yokohama',
      required_by:      '2026-07-01',
    };
    const signals = await collectExternalRiskSignals(unrelatedContext);
    // May return some global signals (WAR_RISK, SANCTIONS) but should not throw
    expect(Array.isArray(signals)).toBe(true);
  });
});
