/**
 * AgentMetrics — DenkKern Agent Platform
 *
 * Aggregated performance and signal-quality metrics for a registered agent.
 * Computed from execution history — never set by agents themselves.
 *
 * LLM boundary: this module is strictly observability. It never influences
 * agent behaviour, scenario decisions, or financial calculations.
 */

import type { AgentExecutionResult } from './execution-result.js';

// ---------------------------------------------------------------------------
// AgentMetrics
// ---------------------------------------------------------------------------

export interface AgentMetrics {
  /** Agent name these metrics describe */
  readonly agent_name: string;
  /** ISO timestamp when these metrics were computed */
  readonly computed_at: string;

  // ── Throughput ──────────────────────────────────────────────────────────
  /** Total run count in the observation window */
  readonly total_runs: number;
  /** Successful runs */
  readonly successful_runs: number;
  /** Failed runs (failure + timeout) */
  readonly failed_runs: number;
  /** Skipped runs */
  readonly skipped_runs: number;
  /** Success rate (0.0–1.0) */
  readonly success_rate: number;

  // ── Latency (successful runs only) ─────────────────────────────────────
  /** Minimum run duration in ms (successful runs) */
  readonly min_duration_ms: number;
  /** Maximum run duration in ms (successful runs) */
  readonly max_duration_ms: number;
  /** Mean run duration in ms (successful runs) */
  readonly mean_duration_ms: number;
  /** p95 run duration in ms (successful runs) */
  readonly p95_duration_ms: number;

  // ── Signal quality ──────────────────────────────────────────────────────
  /** Total signals produced across all successful runs */
  readonly total_signals_produced: number;
  /** Mean signals per successful run */
  readonly mean_signals_per_run: number;
  /** Distribution of severity levels across all produced signals */
  readonly severity_distribution: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

// ---------------------------------------------------------------------------
// computeAgentMetrics — pure function
// ---------------------------------------------------------------------------

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))] ?? 0;
}

export function computeAgentMetrics(
  agent_name: string,
  results: AgentExecutionResult[]
): AgentMetrics {
  const computed_at = new Date().toISOString();

  const total_runs = results.length;
  const successful = results.filter((r) => r.status === 'success');
  const failed = results.filter(
    (r) => r.status === 'failure' || r.status === 'timeout'
  );
  const skipped = results.filter((r) => r.status === 'skipped');

  const successful_runs = successful.length;
  const failed_runs = failed.length;
  const skipped_runs = skipped.length;
  const success_rate = total_runs > 0 ? successful_runs / total_runs : 0;

  // Latency from successful runs
  const durations = successful.map((r) => r.duration_ms).sort((a, b) => a - b);
  const min_duration_ms = durations[0] ?? 0;
  const max_duration_ms = durations[durations.length - 1] ?? 0;
  const mean_duration_ms =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
  const p95_duration_ms = percentile(durations, 95);

  // Signal quality from successful runs
  const allSignals = successful.flatMap((r) => r.signals);
  const total_signals_produced = allSignals.length;
  const mean_signals_per_run =
    successful_runs > 0 ? total_signals_produced / successful_runs : 0;

  const severity_distribution = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const signal of allSignals) {
    const sev = signal.severity as keyof typeof severity_distribution;
    if (sev in severity_distribution) {
      severity_distribution[sev]++;
    }
  }

  return {
    agent_name,
    computed_at,
    total_runs,
    successful_runs,
    failed_runs,
    skipped_runs,
    success_rate,
    min_duration_ms,
    max_duration_ms,
    mean_duration_ms,
    p95_duration_ms,
    total_signals_produced,
    mean_signals_per_run,
    severity_distribution,
  };
}
