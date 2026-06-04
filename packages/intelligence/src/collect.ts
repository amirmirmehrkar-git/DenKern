/**
 * collectExternalRiskSignals — DenkKern intelligence aggregator
 *
 * Runs all three external risk agents in parallel, merges their output,
 * deduplicates by signal_id, and returns a single ExternalRiskSignal[].
 *
 * This is the primary public API for the orchestration layer.
 * The result is passed directly into ScenarioEngineInput.external_risk_signals.
 *
 * Flow:
 *   Fixtures / future feeds
 *     → PortIntelligenceAgent
 *     → GeopoliticalRiskAgent    ─── parallel ───→ merge → deduplicate → ExternalRiskSignal[]
 *     → SupplierRiskAgent
 *
 * Error policy:
 *   Agent failures are isolated — one agent throwing does not prevent others from running.
 *   Failed agents are logged; their signals are omitted from the result.
 */

import type { ExternalRiskSignal } from '@denkkern/types';
import type { AgentContext, ExternalRiskAgent } from './types.js';
import { PortIntelligenceAgent } from './agents/port-intelligence.js';
import { GeopoliticalRiskAgent } from './agents/geopolitical-risk.js';
import { SupplierRiskAgent } from './agents/supplier-risk.js';
import { WeatherContextAgent } from './agents/weather-context.js';

// ---------------------------------------------------------------------------
// Default agent set
// ---------------------------------------------------------------------------

function defaultAgents(): ExternalRiskAgent[] {
  return [
    new PortIntelligenceAgent(),
    new GeopoliticalRiskAgent(),
    new SupplierRiskAgent(),
    new WeatherContextAgent(),
  ];
}

// ---------------------------------------------------------------------------
// Deduplication — last-write-wins by signal_id (preserves highest severity)
// ---------------------------------------------------------------------------

function deduplicateBySignalId(signals: ExternalRiskSignal[]): ExternalRiskSignal[] {
  const severityRank: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

  const map = new Map<string, ExternalRiskSignal>();
  for (const signal of signals) {
    const existing = map.get(signal.signal_id);
    if (existing == null) {
      map.set(signal.signal_id, signal);
    } else {
      // Keep the higher-severity version if there's a conflict
      const existingRank = severityRank[existing.severity] ?? 0;
      const incomingRank = severityRank[signal.severity] ?? 0;
      if (incomingRank >= existingRank) {
        map.set(signal.signal_id, signal);
      }
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// collectExternalRiskSignals
// ---------------------------------------------------------------------------

export interface CollectOptions {
  /** Override the default agent set — useful for testing */
  agents?: ExternalRiskAgent[];
}

/**
 * Run all external risk agents for the given context and return a merged,
 * deduplicated ExternalRiskSignal[].
 *
 * Individual agent failures are isolated and logged — they do not throw.
 */
export async function collectExternalRiskSignals(
  context: AgentContext,
  options: CollectOptions = {}
): Promise<ExternalRiskSignal[]> {
  const agents = options.agents ?? defaultAgents();

  // Run all agents in parallel — isolate failures
  const results = await Promise.allSettled(
    agents.map((agent) => agent.run(context))
  );

  const allSignals: ExternalRiskSignal[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const agent  = agents[i];

    if (result == null || agent == null) continue;

    if (result.status === 'fulfilled') {
      allSignals.push(...result.value);
    } else {
      console.error(
        `[collectExternalRiskSignals] Agent "${agent.name}" failed:`,
        result.reason
      );
    }
  }

  return deduplicateBySignalId(allSignals);
}
