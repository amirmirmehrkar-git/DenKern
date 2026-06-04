/**
 * AgentRunner — DenkKern Agent Platform
 *
 * Orchestrates execution of registered agents for a given AgentContext.
 * Provides: parallel execution, per-agent timeout, failure isolation,
 * health-based skipping, audit trail recording, and result merging.
 *
 * Output contract (invariant):
 *   AgentRunner.run() always returns ExternalRiskSignal[].
 *   No scenario recommendations, no approvals, no financial calculations.
 *   Signals are deduplicated by signal_id (highest severity wins).
 *
 * LLM boundary: the runner is purely an execution harness.
 *   It never interprets signal content or influences decisions.
 */

import type { ExternalRiskSignal } from '@denkkern/types';
import type { AgentContext, ExternalRiskAgent } from './types.js';
import type { AgentHealthStatus } from './health.js';
import { AgentRegistry } from './agent-registry.js';
import { AgentAuditTrail } from './audit.js';
import {
  makeSuccessResult,
  makeFailureResult,
  makeTimeoutResult,
} from './execution-result.js';
import { computeHealthStatus } from './health.js';
import { computeAgentMetrics } from './metrics.js';
import type { AgentMetrics } from './metrics.js';

// ---------------------------------------------------------------------------
// RunnerConfig
// ---------------------------------------------------------------------------

export interface RunnerConfig {
  /**
   * Per-agent timeout in milliseconds.
   * Agents that exceed this are recorded as 'timeout' and their signals dropped.
   * Default: 10_000 (10 seconds)
   */
  agent_timeout_ms?: number;
  /**
   * If true, agents in 'unhealthy' health state are skipped.
   * Default: false (all enabled agents run regardless of health)
   */
  skip_unhealthy_agents?: boolean;
}

const DEFAULT_CONFIG: Required<RunnerConfig> = {
  agent_timeout_ms: 10_000,
  skip_unhealthy_agents: false,
};

// ---------------------------------------------------------------------------
// RunResult — full runner output including audit data
// ---------------------------------------------------------------------------

export interface RunResult {
  /** Deduplicated, merged signals from all successful agents */
  readonly signals: ExternalRiskSignal[];
  /** Per-agent execution details (for audit / monitoring) */
  readonly execution_results: import('./execution-result.js').AgentExecutionResult[];
  /** Health snapshot per agent, computed from updated history */
  readonly health_snapshot: Map<string, AgentHealthStatus>;
  /** Metrics per agent, computed from full history */
  readonly metrics_snapshot: Map<string, AgentMetrics>;
}

// ---------------------------------------------------------------------------
// AgentRunner
// ---------------------------------------------------------------------------

export class AgentRunner {
  private readonly _registry: AgentRegistry;
  private readonly _audit: AgentAuditTrail;
  private readonly _config: Required<RunnerConfig>;

  constructor(
    registry: AgentRegistry,
    audit: AgentAuditTrail,
    config: RunnerConfig = {}
  ) {
    this._registry = registry;
    this._audit = audit;
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Run all enabled (and non-unhealthy, if configured) agents for the given
   * context. Returns merged, deduplicated ExternalRiskSignal[].
   *
   * Individual agent failures are isolated — one failure does not prevent others.
   */
  async run(context: AgentContext): Promise<RunResult> {
    const { agent_timeout_ms, skip_unhealthy_agents } = this._config;

    // Build current health map for health-based skipping decision
    const healthMap = this._buildHealthMap();

    const agents = this._registry.getEnabledAgents(healthMap, skip_unhealthy_agents);

    // Run all agents in parallel with per-agent timeout + failure isolation
    const executions = await Promise.all(
      agents.map((agent) =>
        this._runSingleAgent(agent, context, agent_timeout_ms)
      )
    );

    // Record all results in audit trail
    for (const result of executions) {
      this._audit.record(result);
    }

    // Recompute health + metrics snapshots with updated history
    const health_snapshot = this._buildHealthMap();
    const metrics_snapshot = this._buildMetricsMap();

    // Merge and deduplicate signals from successful runs
    const allSignals = executions
      .filter((r) => r.status === 'success')
      .flatMap((r) => r.signals);

    const signals = deduplicateBySignalId(allSignals);

    return {
      signals,
      execution_results: executions,
      health_snapshot,
      metrics_snapshot,
    };
  }

  /** Access the audit trail for external querying. */
  get audit(): AgentAuditTrail {
    return this._audit;
  }

  /** Current health map (computed from audit history). */
  getHealthMap(): Map<string, AgentHealthStatus> {
    return this._buildHealthMap();
  }

  /** Current metrics map (computed from audit history). */
  getMetricsMap(): Map<string, AgentMetrics> {
    return this._buildMetricsMap();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _runSingleAgent(
    agent: ExternalRiskAgent,
    context: AgentContext,
    timeout_ms: number
  ): Promise<import('./execution-result.js').AgentExecutionResult> {
    const started_at = new Date().toISOString();
    const start = Date.now();

    // Wrap in timeout race
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AGENT_TIMEOUT')), timeout_ms)
    );

    try {
      const signals = await Promise.race([agent.run(context), timeoutPromise]);
      const duration_ms = Date.now() - start;
      return makeSuccessResult(
        agent.name,
        context.case_id,
        context.shipment_id,
        signals,
        started_at,
        duration_ms
      );
    } catch (err: unknown) {
      const duration_ms = Date.now() - start;
      const isTimeout =
        err instanceof Error && err.message === 'AGENT_TIMEOUT';

      if (isTimeout) {
        return makeTimeoutResult(agent.name, context.case_id, context.shipment_id, timeout_ms, started_at);
      }
      return makeFailureResult(
        agent.name,
        context.case_id,
        context.shipment_id,
        err,
        started_at,
        duration_ms
      );
    }
  }

  private _buildHealthMap(): Map<string, AgentHealthStatus> {
    const map = new Map<string, AgentHealthStatus>();
    for (const name of this._registry.getRegisteredNames()) {
      const history = this._audit.getHistory(name);
      const snapshot = {
        agent_name: name,
        outcomes: history.map((r) => ({
          status: r.status,
          duration_ms: r.duration_ms,
          completed_at: r.completed_at,
        })),
      };
      map.set(name, computeHealthStatus(snapshot));
    }
    return map;
  }

  private _buildMetricsMap(): Map<string, AgentMetrics> {
    const map = new Map<string, AgentMetrics>();
    for (const name of this._registry.getRegisteredNames()) {
      const history = this._audit.getHistory(name);
      map.set(name, computeAgentMetrics(name, history));
    }
    return map;
  }
}

// ---------------------------------------------------------------------------
// Deduplication — highest severity wins on signal_id collision
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<string, number> = {
  LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3,
};

function deduplicateBySignalId(
  signals: ExternalRiskSignal[]
): ExternalRiskSignal[] {
  const map = new Map<string, ExternalRiskSignal>();
  for (const signal of signals) {
    const existing = map.get(signal.signal_id);
    if (existing == null) {
      map.set(signal.signal_id, signal);
    } else {
      const existingRank = SEVERITY_RANK[existing.severity] ?? 0;
      const incomingRank = SEVERITY_RANK[signal.severity] ?? 0;
      if (incomingRank >= existingRank) {
        map.set(signal.signal_id, signal);
      }
    }
  }
  return Array.from(map.values());
}
