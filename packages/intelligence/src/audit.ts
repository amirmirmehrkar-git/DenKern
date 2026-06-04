/**
 * AgentAuditTrail — DenkKern Agent Platform
 *
 * Append-only in-memory log of every agent execution result within a session.
 * Provides query methods used by monitoring, health computation, and metrics.
 *
 * Design:
 *   - Append-only: entries are never mutated or deleted within a session.
 *   - Per-agent history is capped at MAX_HISTORY_PER_AGENT to bound memory.
 *   - The trail is not persisted between process restarts (session-scoped).
 *   - LLM boundary: the trail records what happened — it never drives decisions.
 */

import type { AgentExecutionResult } from './execution-result.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum execution results kept per agent (FIFO eviction beyond this) */
const MAX_HISTORY_PER_AGENT = 100;

// ---------------------------------------------------------------------------
// AgentAuditTrail
// ---------------------------------------------------------------------------

export class AgentAuditTrail {
  /** agent_name → ordered history (oldest first, newest last) */
  private readonly _history = new Map<string, AgentExecutionResult[]>();

  // ── Write ────────────────────────────────────────────────────────────────

  /**
   * Append a completed execution result to the trail.
   * Evicts the oldest entry per agent if the cap is exceeded.
   */
  record(result: AgentExecutionResult): void {
    let history = this._history.get(result.agent_name);
    if (history == null) {
      history = [];
      this._history.set(result.agent_name, history);
    }
    history.push(result);
    if (history.length > MAX_HISTORY_PER_AGENT) {
      history.shift(); // FIFO eviction
    }
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  /** All results for a specific agent (oldest first). */
  getHistory(agent_name: string): AgentExecutionResult[] {
    return [...(this._history.get(agent_name) ?? [])];
  }

  /** Most recent result for a specific agent, or undefined if never run. */
  getLastResult(agent_name: string): AgentExecutionResult | undefined {
    const history = this._history.get(agent_name);
    return history != null && history.length > 0
      ? history[history.length - 1]
      : undefined;
  }

  /** All results across all agents, ordered by completed_at ascending. */
  getAllResults(): AgentExecutionResult[] {
    const all: AgentExecutionResult[] = [];
    for (const history of this._history.values()) {
      all.push(...history);
    }
    return all.sort((a, b) =>
      a.completed_at < b.completed_at ? -1 : a.completed_at > b.completed_at ? 1 : 0
    );
  }

  /** All results for a specific case_id across all agents. */
  getResultsForCase(case_id: string): AgentExecutionResult[] {
    return this.getAllResults().filter((r) => r.case_id === case_id);
  }

  /** Names of all agents that have ever been recorded. */
  getKnownAgents(): string[] {
    return Array.from(this._history.keys());
  }

  /** Total number of results recorded across all agents. */
  get totalRecorded(): number {
    let count = 0;
    for (const history of this._history.values()) {
      count += history.length;
    }
    return count;
  }

  /** Clear all history (used in tests only). */
  clear(): void {
    this._history.clear();
  }
}
