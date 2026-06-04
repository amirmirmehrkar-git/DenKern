/**
 * AgentRegistry — DenkKern Agent Platform
 *
 * Central registry for ExternalRiskAgent instances.
 * Manages registration, priority ordering, and health-based skipping.
 *
 * Priority:
 *   Higher number = runs earlier. Agents with equal priority run in
 *   registration order. The runner respects this order; it never
 *   changes based on agent output.
 *
 * Health-based skipping:
 *   Agents in 'unhealthy' state can be skipped to avoid timeout cascades.
 *   This is a platform-level decision — agents are never aware of it.
 *
 * LLM boundary: the registry manages agent lifecycle only.
 *   It never reads signal content, influences scenarios, or makes decisions.
 */

import type { ExternalRiskAgent } from './types.js';
import type { AgentHealthStatus } from './health.js';

// ---------------------------------------------------------------------------
// AgentRegistration
// ---------------------------------------------------------------------------

export interface AgentRegistration {
  /** The agent instance */
  readonly agent: ExternalRiskAgent;
  /**
   * Execution priority. Higher = runs earlier in the batch.
   * Default: 0
   */
  readonly priority: number;
  /**
   * Whether this agent is enabled. Disabled agents are never run.
   * Default: true
   */
  readonly enabled: boolean;
  /**
   * ISO timestamp when this agent was registered.
   */
  readonly registered_at: string;
}

// ---------------------------------------------------------------------------
// AgentRegistry
// ---------------------------------------------------------------------------

export interface RegistrationOptions {
  /** Execution priority. Higher = runs earlier. Default: 0 */
  priority?: number;
  /** Enable/disable the agent. Default: true */
  enabled?: boolean;
}

export class AgentRegistry {
  private readonly _registrations = new Map<string, AgentRegistration>();

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register an agent. Throws if an agent with the same name is already registered.
   */
  register(agent: ExternalRiskAgent, options: RegistrationOptions = {}): void {
    const { name } = agent;
    if (this._registrations.has(name)) {
      throw new Error(
        `AgentRegistry: agent "${name}" is already registered. ` +
        'Deregister it first or use a unique name.'
      );
    }
    this._registrations.set(name, {
      agent,
      priority: options.priority ?? 0,
      enabled: options.enabled ?? true,
      registered_at: new Date().toISOString(),
    });
  }

  /**
   * Remove a registered agent. No-op if not found.
   */
  deregister(name: string): void {
    this._registrations.delete(name);
  }

  /**
   * Enable or disable a registered agent at runtime.
   * Throws if agent not found.
   */
  setEnabled(name: string, enabled: boolean): void {
    const reg = this._registrations.get(name);
    if (reg == null) {
      throw new Error(`AgentRegistry: agent "${name}" not found.`);
    }
    this._registrations.set(name, { ...reg, enabled });
  }

  // ── Query ─────────────────────────────────────────────────────────────────

  /**
   * Returns all enabled agents sorted by priority descending (highest first),
   * then by registration order for equal priorities.
   *
   * @param skipUnhealthy - If provided, agents whose health is 'unhealthy' are excluded.
   */
  getEnabledAgents(
    healthMap?: Map<string, AgentHealthStatus>,
    skipUnhealthy = false
  ): ExternalRiskAgent[] {
    const entries = Array.from(this._registrations.entries())
      .filter(([, reg]) => reg.enabled)
      .filter(([name]) => {
        if (!skipUnhealthy || healthMap == null) return true;
        const health = healthMap.get(name);
        return health == null || health.level !== 'unhealthy';
      });

    // Sort: higher priority first, then insertion order (Map preserves it)
    entries.sort(([, a], [, b]) => b.priority - a.priority);

    return entries.map(([, reg]) => reg.agent);
  }

  /** Returns the registration for a given agent name, or undefined. */
  getRegistration(name: string): AgentRegistration | undefined {
    return this._registrations.get(name);
  }

  /** All registered agent names (including disabled). */
  getRegisteredNames(): string[] {
    return Array.from(this._registrations.keys());
  }

  /** Total count of registered agents (including disabled). */
  get size(): number {
    return this._registrations.size;
  }

  /** Clear all registrations (used in tests only). */
  clear(): void {
    this._registrations.clear();
  }
}
