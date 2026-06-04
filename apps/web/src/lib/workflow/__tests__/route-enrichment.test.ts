/**
 * route-enrichment.test.ts — H-8
 *
 * Integration tests for the context enrichment pipeline.
 *
 * Tests verify that the route field wiring (Sprint 4 H-1/H-2/H-3) enables
 * route-specific risk signals to reach the agent output.
 *
 * We test this at the WeatherContextAgent level and through AgentRunner to avoid
 * requiring Next.js infrastructure (NextRequest, NextResponse, getAdapter()).
 * The critical path is: route in ShipmentContext → route in AgentContext →
 * WeatherContextAgent route matching → North Sea route signals included.
 */

import { describe, it, expect } from 'vitest';
import {
  WeatherContextAgent,
  AgentRegistry,
  AgentAuditTrail,
  AgentRunner,
} from '@denkkern/intelligence';
import type { AgentContext } from '@denkkern/intelligence';

// ---------------------------------------------------------------------------
// Shared context builder
// ---------------------------------------------------------------------------

function makeAgentContext(route?: string): AgentContext {
  const base: AgentContext = {
    case_id:          'CASE-001',
    shipment_id:      'SHIP-001',
    destination_port: 'Hamburg',
    required_by:      '2026-05-28',
    vessel_name:      'MSC Barcelona',
  };
  // exactOptionalPropertyTypes: omit key when absent rather than assign undefined
  return route != null ? { ...base, route } : base;
}

// ---------------------------------------------------------------------------
// WeatherContextAgent — route field wiring (H-3 end-to-end verification)
// ---------------------------------------------------------------------------

describe('WeatherContextAgent — route field wiring', () => {
  const agent = new WeatherContextAgent();

  it('returns Hamburg port signals when destination_port is "Hamburg"', async () => {
    const signals = await agent.run(makeAgentContext());
    const portSignals = signals.filter((s) =>
      s.location?.toLowerCase().includes('hamburg')
    );
    expect(portSignals.length).toBeGreaterThan(0);
  });

  it('omits North Sea route signals when no route is provided', async () => {
    const signals = await agent.run(makeAgentContext());
    const nsrSignals = signals.filter((s) =>
      s.signal_id.startsWith('WX-NSR-')
    );
    expect(nsrSignals).toHaveLength(0);
  });

  it('includes North Sea route signals when route = "Bay of Biscay — North Sea"', async () => {
    const signals = await agent.run(makeAgentContext('Bay of Biscay — North Sea'));
    const nsrSignals = signals.filter((s) =>
      s.signal_id.startsWith('WX-NSR-')
    );
    expect(nsrSignals.length).toBeGreaterThan(0);
  });

  it('all NSR signals have signal_type WEATHER_CONTEXT', async () => {
    const signals = await agent.run(makeAgentContext('Bay of Biscay — North Sea'));
    const nsrSignals = signals.filter((s) => s.signal_id.startsWith('WX-NSR-'));
    for (const s of nsrSignals) {
      expect(s.signal_type).toBe('WEATHER_CONTEXT');
    }
  });

  it('NSR signals do not appear for an unrelated route', async () => {
    const signals = await agent.run(makeAgentContext('Pacific — Trans-Pacific route'));
    const nsrSignals = signals.filter((s) => s.signal_id.startsWith('WX-NSR-'));
    // NSR events affect "North Sea route" — should not match Pacific route
    expect(nsrSignals).toHaveLength(0);
  });

  it('NSR storm signal has severity HIGH or CRITICAL', async () => {
    const signals = await agent.run(makeAgentContext('Bay of Biscay — North Sea'));
    const stormSignal = signals.find((s) => s.signal_id === 'WX-NSR-001');
    expect(stormSignal).toBeDefined();
    expect(['HIGH', 'CRITICAL']).toContain(stormSignal?.severity);
  });

  it('all returned signals are valid ExternalRiskSignal shape', async () => {
    const signals = await agent.run(makeAgentContext('Bay of Biscay — North Sea'));
    for (const s of signals) {
      expect(s.signal_id).toBeTruthy();
      expect(s.signal_type).toBe('WEATHER_CONTEXT');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(s.severity);
      expect(s.time_window).toBeDefined();
      expect(s.time_window.valid_from).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// AgentRunner — integration: route signals flow end-to-end through the platform
// ---------------------------------------------------------------------------

describe('AgentRunner — route enrichment integration', () => {
  function makeRunner() {
    const registry = new AgentRegistry();
    const audit    = new AgentAuditTrail();
    registry.register(new WeatherContextAgent(), { priority: 70 });
    return new AgentRunner(registry, audit);
  }

  it('RunResult.signals includes NSR signals when route is set', async () => {
    const runner = makeRunner();
    const { signals } = await runner.run(makeAgentContext('Bay of Biscay — North Sea'));
    const nsrSignals = signals.filter((s) => s.signal_id.startsWith('WX-NSR-'));
    expect(nsrSignals.length).toBeGreaterThan(0);
  });

  it('RunResult.signals omits NSR signals when route is absent', async () => {
    const runner = makeRunner();
    const { signals } = await runner.run(makeAgentContext());
    const nsrSignals = signals.filter((s) => s.signal_id.startsWith('WX-NSR-'));
    expect(nsrSignals).toHaveLength(0);
  });

  it('RunResult includes execution_results with success status', async () => {
    const runner = makeRunner();
    const { execution_results } = await runner.run(makeAgentContext());
    expect(execution_results).toHaveLength(1);
    expect(execution_results[0]?.status).toBe('success');
    expect(execution_results[0]?.agent_name).toBe('WeatherContextAgent');
  });

  it('RunResult.health_snapshot is defined', async () => {
    const runner = makeRunner();
    const { health_snapshot } = await runner.run(makeAgentContext());
    expect(health_snapshot).toBeDefined();
    expect(health_snapshot.get('WeatherContextAgent')).toBeDefined();
  });

  it('gracefully returns empty signals when agent throws', async () => {
    const registry = new AgentRegistry();
    const audit    = new AgentAuditTrail();

    // Register a broken agent that always throws
    registry.register(
      {
        name: 'BrokenAgent',
        run: async () => { throw new Error('Simulated agent failure'); },
      },
      { priority: 100 }
    );

    const runner  = new AgentRunner(registry, audit);
    const { signals, execution_results } = await runner.run(makeAgentContext());

    expect(signals).toHaveLength(0);
    expect(execution_results[0]?.status).toBe('failure');
    expect(execution_results[0]?.error?.message).toContain('Simulated agent failure');
  });

  it('partial failure: healthy agent signals survive alongside failed agent', async () => {
    const registry = new AgentRegistry();
    const audit    = new AgentAuditTrail();

    registry.register(
      {
        name: 'BrokenAgent',
        run: async () => { throw new Error('fail'); },
      },
      { priority: 100 }
    );
    registry.register(new WeatherContextAgent(), { priority: 70 });

    const runner = new AgentRunner(registry, audit);
    const { signals, execution_results } = await runner.run(
      makeAgentContext('Bay of Biscay — North Sea')
    );

    // WeatherContextAgent should still produce signals
    expect(signals.length).toBeGreaterThan(0);

    const statuses = Object.fromEntries(
      execution_results.map((r) => [r.agent_name, r.status])
    );
    expect(statuses['BrokenAgent']).toBe('failure');
    expect(statuses['WeatherContextAgent']).toBe('success');
  });
});
