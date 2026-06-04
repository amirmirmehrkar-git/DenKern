/**
 * Agent Platform Foundation — test suite
 *
 * Covers: AgentRegistry, AgentRunner, AgentAuditTrail,
 *         computeHealthStatus, computeAgentMetrics,
 *         execution result factories.
 *
 * All agents are stub implementations — no real feeds, no LLM calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ExternalRiskSignal } from '@denkkern/types';
import type { AgentContext, ExternalRiskAgent } from '../types.js';
import { AgentRegistry } from '../agent-registry.js';
import { AgentAuditTrail } from '../audit.js';
import { AgentRunner } from '../agent-runner.js';
import {
  makeSuccessResult,
  makeFailureResult,
  makeTimeoutResult,
  makeSkippedResult,
} from '../execution-result.js';
import { computeHealthStatus } from '../health.js';
import { computeAgentMetrics } from '../metrics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignal(id: string, severity: ExternalRiskSignal['severity'] = 'LOW'): ExternalRiskSignal {
  return {
    signal_id: id,
    signal_type: 'PORT_RESTRICTION',
    severity,
    confidence: 0.8,
    source_type: 'simulated',
    source_name: 'test-fixture',
    location: 'Hamburg',
    description: `Test signal ${id}`,
    decision_relevance: 'Test signal for platform tests',
    recommended_engine_effect: 'none',
    time_window: { valid_from: '2026-06-04' },
  };
}

function makeContext(override: Partial<AgentContext> = {}): AgentContext {
  return {
    case_id: 'CASE-001',
    shipment_id: 'SHIP-001',
    destination_port: 'Hamburg',
    required_by: '2026-06-10',
    ...override,
  };
}

function makeAgent(
  name: string,
  signals: ExternalRiskSignal[] = [],
  shouldFail = false,
  delayMs = 0
): ExternalRiskAgent {
  return {
    name,
    run: async (_ctx: AgentContext) => {
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      if (shouldFail) throw new Error(`${name} failed intentionally`);
      return signals;
    },
  };
}

// ---------------------------------------------------------------------------
// Execution result factories
// ---------------------------------------------------------------------------

describe('makeSuccessResult', () => {
  it('returns status success with correct fields', () => {
    const result = makeSuccessResult('TestAgent', 'CASE-001', 'SHIP-001', [], '2026-06-04T10:00:00.000Z', 42);
    expect(result.status).toBe('success');
    expect(result.agent_name).toBe('TestAgent');
    expect(result.duration_ms).toBe(42);
    expect(result.signals).toEqual([]);
    expect(result.error).toBeUndefined();
  });
});

describe('makeFailureResult', () => {
  it('captures error message and sets status failure', () => {
    const err = new Error('boom');
    const result = makeFailureResult('TestAgent', 'CASE-001', 'SHIP-001', err, '2026-06-04T10:00:00.000Z', 5);
    expect(result.status).toBe('failure');
    expect(result.signals).toEqual([]);
    expect(result.error?.message).toBe('boom');
  });
});

describe('makeTimeoutResult', () => {
  it('sets status timeout with AGENT_TIMEOUT code', () => {
    const result = makeTimeoutResult('TestAgent', 'CASE-001', 'SHIP-001', 5000, '2026-06-04T10:00:00.000Z');
    expect(result.status).toBe('timeout');
    expect(result.error?.code).toBe('AGENT_TIMEOUT');
  });
});

describe('makeSkippedResult', () => {
  it('sets status skipped with zero duration', () => {
    const result = makeSkippedResult('TestAgent', 'CASE-001', 'SHIP-001', 'unhealthy');
    expect(result.status).toBe('skipped');
    expect(result.duration_ms).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeHealthStatus
// ---------------------------------------------------------------------------

describe('computeHealthStatus', () => {
  it('returns unknown when no history', () => {
    const status = computeHealthStatus({ agent_name: 'A', outcomes: [] });
    expect(status.level).toBe('unknown');
  });

  it('returns healthy after all successes', () => {
    const outcomes = Array.from({ length: 5 }, (_, i) => ({
      status: 'success' as const,
      duration_ms: 100,
      completed_at: `2026-06-04T10:0${i}:00Z`,
    }));
    const status = computeHealthStatus({ agent_name: 'A', outcomes });
    expect(status.level).toBe('healthy');
    expect(status.success_runs).toBe(5);
    expect(status.error_rate).toBe(0);
  });

  it('becomes unhealthy after 3 consecutive failures', () => {
    const outcomes = [
      { status: 'success' as const, duration_ms: 100, completed_at: '2026-06-04T10:00:00Z' },
      { status: 'failure' as const, duration_ms: 100, completed_at: '2026-06-04T10:01:00Z' },
      { status: 'failure' as const, duration_ms: 100, completed_at: '2026-06-04T10:02:00Z' },
      { status: 'failure' as const, duration_ms: 100, completed_at: '2026-06-04T10:03:00Z' },
    ];
    const status = computeHealthStatus({ agent_name: 'A', outcomes });
    expect(status.level).toBe('unhealthy');
    expect(status.consecutive_failures).toBe(3);
  });

  it('becomes degraded when error rate exceeds 30%', () => {
    const outcomes = [
      ...Array.from({ length: 7 }, (_, i) => ({
        status: 'success' as const,
        duration_ms: 100,
        completed_at: `2026-06-04T10:0${i}:00Z`,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        status: 'failure' as const,
        duration_ms: 100,
        completed_at: `2026-06-04T11:0${i}:00Z`,
      })),
    ];
    const status = computeHealthStatus({ agent_name: 'A', outcomes });
    expect(status.level).toBe('degraded');
    expect(status.error_rate).toBeCloseTo(0.3, 5);
  });
});

// ---------------------------------------------------------------------------
// computeAgentMetrics
// ---------------------------------------------------------------------------

describe('computeAgentMetrics', () => {
  it('returns zero metrics for empty results', () => {
    const metrics = computeAgentMetrics('A', []);
    expect(metrics.total_runs).toBe(0);
    expect(metrics.success_rate).toBe(0);
    expect(metrics.total_signals_produced).toBe(0);
  });

  it('computes severity distribution correctly', () => {
    const now = '2026-06-04T10:00:00.000Z';
    const results = [
      makeSuccessResult('A', 'C', 'S', [makeSignal('s1', 'HIGH'), makeSignal('s2', 'LOW')], now, 100),
      makeSuccessResult('A', 'C', 'S', [makeSignal('s3', 'CRITICAL')], now, 80),
    ];
    const metrics = computeAgentMetrics('A', results);
    expect(metrics.total_signals_produced).toBe(3);
    expect(metrics.severity_distribution.HIGH).toBe(1);
    expect(metrics.severity_distribution.LOW).toBe(1);
    expect(metrics.severity_distribution.CRITICAL).toBe(1);
    expect(metrics.mean_signals_per_run).toBeCloseTo(1.5, 5);
  });
});

// ---------------------------------------------------------------------------
// AgentRegistry
// ---------------------------------------------------------------------------

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  beforeEach(() => { registry = new AgentRegistry(); });

  it('registers and retrieves an agent', () => {
    const agent = makeAgent('A');
    registry.register(agent);
    expect(registry.size).toBe(1);
    expect(registry.getRegistration('A')?.agent.name).toBe('A');
  });

  it('throws on duplicate registration', () => {
    registry.register(makeAgent('A'));
    expect(() => registry.register(makeAgent('A'))).toThrow('already registered');
  });

  it('deregisters an agent', () => {
    registry.register(makeAgent('A'));
    registry.deregister('A');
    expect(registry.size).toBe(0);
  });

  it('returns agents sorted by priority descending', () => {
    registry.register(makeAgent('Low'), { priority: 0 });
    registry.register(makeAgent('High'), { priority: 10 });
    registry.register(makeAgent('Mid'), { priority: 5 });
    const agents = registry.getEnabledAgents();
    expect(agents.map((a) => a.name)).toEqual(['High', 'Mid', 'Low']);
  });

  it('excludes disabled agents', () => {
    registry.register(makeAgent('A'), { enabled: true });
    registry.register(makeAgent('B'), { enabled: false });
    expect(registry.getEnabledAgents().map((a) => a.name)).toEqual(['A']);
  });

  it('setEnabled toggles an agent', () => {
    registry.register(makeAgent('A'));
    registry.setEnabled('A', false);
    expect(registry.getEnabledAgents()).toHaveLength(0);
    registry.setEnabled('A', true);
    expect(registry.getEnabledAgents()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AgentAuditTrail
// ---------------------------------------------------------------------------

describe('AgentAuditTrail', () => {
  let trail: AgentAuditTrail;
  beforeEach(() => { trail = new AgentAuditTrail(); });

  it('records and retrieves history', () => {
    const r = makeSuccessResult('A', 'CASE-001', 'SHIP-001', [], '2026-06-04T10:00:00.000Z', 10);
    trail.record(r);
    expect(trail.getHistory('A')).toHaveLength(1);
    expect(trail.totalRecorded).toBe(1);
  });

  it('filters results by case_id', () => {
    trail.record(makeSuccessResult('A', 'CASE-001', 'SHIP-001', [], '2026-06-04T10:00:00.000Z', 10));
    trail.record(makeSuccessResult('B', 'CASE-002', 'SHIP-002', [], '2026-06-04T10:01:00.000Z', 10));
    expect(trail.getResultsForCase('CASE-001')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AgentRunner — integration
// ---------------------------------------------------------------------------

describe('AgentRunner', () => {
  let registry: AgentRegistry;
  let audit: AgentAuditTrail;
  let runner: AgentRunner;

  beforeEach(() => {
    registry = new AgentRegistry();
    audit = new AgentAuditTrail();
    runner = new AgentRunner(registry, audit);
  });

  it('returns merged signals from all agents', async () => {
    registry.register(makeAgent('A', [makeSignal('s1', 'HIGH')]));
    registry.register(makeAgent('B', [makeSignal('s2', 'LOW')]));
    const result = await runner.run(makeContext());
    expect(result.signals).toHaveLength(2);
    expect(result.execution_results.every((r) => r.status === 'success')).toBe(true);
  });

  it('isolates a failing agent — other agents still produce signals', async () => {
    registry.register(makeAgent('A', [makeSignal('s1')]));
    registry.register(makeAgent('B', [], true)); // throws
    const result = await runner.run(makeContext());
    expect(result.signals).toHaveLength(1);
    const bResult = result.execution_results.find((r) => r.agent_name === 'B');
    expect(bResult?.status).toBe('failure');
    expect(bResult?.error?.message).toContain('failed intentionally');
  });

  it('deduplicates signals by signal_id keeping highest severity', async () => {
    registry.register(makeAgent('A', [makeSignal('dup', 'LOW')]));
    registry.register(makeAgent('B', [makeSignal('dup', 'HIGH')]));
    const result = await runner.run(makeContext());
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0]?.severity).toBe('HIGH');
  });

  it('times out slow agents and records timeout result', async () => {
    const fastRunner = new AgentRunner(registry, audit, { agent_timeout_ms: 50 });
    registry.register(makeAgent('SlowAgent', [makeSignal('s1')], false, 200));
    const result = await fastRunner.run(makeContext());
    expect(result.signals).toHaveLength(0);
    expect(result.execution_results[0]?.status).toBe('timeout');
  }, 2000);

  it('skips unhealthy agents when skip_unhealthy_agents is true', async () => {
    const skipRunner = new AgentRunner(registry, audit, { skip_unhealthy_agents: true });
    const unhealthyAgent = makeAgent('Sick', [], true);
    registry.register(unhealthyAgent);
    // Record 3 consecutive failures to mark as unhealthy
    for (let i = 0; i < 3; i++) {
      audit.record(makeFailureResult('Sick', 'CASE-001', 'SHIP-001', new Error('err'), '2026-06-04T10:00:00.000Z', 10));
    }
    const result = await skipRunner.run(makeContext());
    // Agent was skipped, so execution_results is empty (no run attempted)
    expect(result.execution_results).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
  });

  it('records all results in the audit trail', async () => {
    registry.register(makeAgent('A', [makeSignal('s1')]));
    await runner.run(makeContext());
    expect(audit.getHistory('A')).toHaveLength(1);
  });

  it('returns health and metrics snapshots', async () => {
    registry.register(makeAgent('A', [makeSignal('s1')]));
    const result = await runner.run(makeContext());
    expect(result.health_snapshot.has('A')).toBe(true);
    expect(result.metrics_snapshot.has('A')).toBe(true);
    expect(result.health_snapshot.get('A')?.level).toBe('healthy');
  });
});
