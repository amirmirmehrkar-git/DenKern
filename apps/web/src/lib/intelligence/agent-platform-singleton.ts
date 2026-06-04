/**
 * Agent Platform Singleton — DenkKern web app
 *
 * Creates a single AgentRunner instance per Node.js module lifetime.
 * All server-side enrichment calls (context/route.ts) should use
 * getAgentRunner() rather than calling collectExternalRiskSignals() directly.
 *
 * Platform components:
 *   AgentRegistry   — priority-ordered agent catalogue; health-aware skipping
 *   AgentAuditTrail — FIFO per-agent execution history (100 results/agent)
 *   AgentRunner     — parallel dispatch, per-agent timeout, deduplication
 *
 * LLM boundary (enforced throughout @denkkern/intelligence):
 *   Agents produce ExternalRiskSignal[] only.
 *   No scenarios, no approvals, no financial calculations.
 *
 * Agent registration order (priority high → low):
 *   1. PortIntelligenceAgent     (priority 90) — port-level disruptions
 *   2. GeopoliticalRiskAgent     (priority 80) — region/route geopolitical risk
 *   3. WeatherContextAgent       (priority 70) — route + port weather events
 *   4. SupplierRiskAgent         (priority 60) — supplier-side risk
 */

import {
  AgentRegistry,
  AgentAuditTrail,
  AgentRunner,
  PortIntelligenceAgent,
  GeopoliticalRiskAgent,
  SupplierRiskAgent,
  WeatherContextAgent,
} from '@denkkern/intelligence';
import type { AgentRunner as AgentRunnerType } from '@denkkern/intelligence';

// ---------------------------------------------------------------------------
// Singleton — one instance per module lifetime (one Next.js worker)
// ---------------------------------------------------------------------------

let _runner: AgentRunnerType | null = null;

export function getAgentRunner(): AgentRunnerType {
  if (_runner !== null) return _runner;

  const registry = new AgentRegistry();
  const audit    = new AgentAuditTrail();

  registry.register(new PortIntelligenceAgent(),  { priority: 90 });
  registry.register(new GeopoliticalRiskAgent(),  { priority: 80 });
  registry.register(new WeatherContextAgent(),    { priority: 70 });
  registry.register(new SupplierRiskAgent(),      { priority: 60 });

  _runner = new AgentRunner(registry, audit, {
    agent_timeout_ms:      10_000,
    skip_unhealthy_agents: false,
  });

  return _runner;
}

// Exposed for tests that need a fresh runner (e.g. with custom agents).
export function _resetAgentRunnerForTests(runner?: AgentRunnerType): void {
  _runner = runner ?? null;
}
