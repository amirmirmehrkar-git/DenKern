/**
 * AgentHealthStatus — DenkKern Agent Platform
 *
 * Tracks operational health for each registered agent.
 * Health is computed from recent execution history — it is never
 * set by agents themselves (agents are output-only).
 *
 * Health levels:
 *   healthy   — last N runs succeeded, error rate below threshold
 *   degraded  — error rate elevated but agent still producing signals
 *   unhealthy — consecutive failure threshold exceeded
 *   unknown   — no runs recorded yet
 */

// ---------------------------------------------------------------------------
// Health level
// ---------------------------------------------------------------------------

export type AgentHealthLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// ---------------------------------------------------------------------------
// AgentHealthStatus
// ---------------------------------------------------------------------------

export interface AgentHealthStatus {
  /** Agent name this status describes */
  readonly agent_name: string;
  /** Current health level */
  readonly level: AgentHealthLevel;
  /** Total runs recorded in the history window */
  readonly total_runs: number;
  /** Successful runs in the history window */
  readonly success_runs: number;
  /** Failed or timed-out runs in the history window */
  readonly failed_runs: number;
  /** Consecutive failures at the tail of recorded history */
  readonly consecutive_failures: number;
  /** Error rate in the history window (0.0–1.0) */
  readonly error_rate: number;
  /** Average duration of successful runs in milliseconds */
  readonly avg_duration_ms: number;
  /** ISO timestamp of the most recent run — absent if no runs yet */
  readonly last_run_at?: string;
  /** ISO timestamp of the most recent successful run — absent if never succeeded */
  readonly last_success_at?: string;
}

// ---------------------------------------------------------------------------
// Health thresholds (tunable)
// ---------------------------------------------------------------------------

export interface HealthThresholds {
  /** Consecutive failures before status becomes unhealthy. Default: 3 */
  unhealthy_consecutive_failures: number;
  /** Error rate above which status becomes degraded. Default: 0.3 (30%) */
  degraded_error_rate: number;
  /** Error rate above which status becomes unhealthy. Default: 0.6 (60%) */
  unhealthy_error_rate: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
  unhealthy_consecutive_failures: 3,
  degraded_error_rate: 0.3,
  unhealthy_error_rate: 0.6,
};

// ---------------------------------------------------------------------------
// computeHealthStatus — pure function
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  agent_name: string;
  /** Ordered list of run outcomes (oldest first) */
  outcomes: Array<{
    status: 'success' | 'failure' | 'timeout' | 'skipped';
    duration_ms: number;
    completed_at: string;
  }>;
}

export function computeHealthStatus(
  snapshot: HealthSnapshot,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS
): AgentHealthStatus {
  const { agent_name, outcomes } = snapshot;

  if (outcomes.length === 0) {
    return {
      agent_name,
      level: 'unknown',
      total_runs: 0,
      success_runs: 0,
      failed_runs: 0,
      consecutive_failures: 0,
      error_rate: 0,
      avg_duration_ms: 0,
    };
  }

  const total_runs = outcomes.length;
  const success_runs = outcomes.filter((o) => o.status === 'success').length;
  const failed_runs = outcomes.filter(
    (o) => o.status === 'failure' || o.status === 'timeout'
  ).length;
  const error_rate = total_runs > 0 ? failed_runs / total_runs : 0;

  // Consecutive failures at the tail
  let consecutive_failures = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    const s = outcomes[i]?.status;
    if (s === 'failure' || s === 'timeout') {
      consecutive_failures++;
    } else {
      break;
    }
  }

  // Average duration of successful runs
  const successDurations = outcomes
    .filter((o) => o.status === 'success')
    .map((o) => o.duration_ms);
  const avg_duration_ms =
    successDurations.length > 0
      ? successDurations.reduce((a, b) => a + b, 0) / successDurations.length
      : 0;

  const last_run_at = outcomes[outcomes.length - 1]?.completed_at;
  const lastSuccess = [...outcomes].reverse().find((o) => o.status === 'success');
  const last_success_at = lastSuccess?.completed_at;

  // Determine health level
  let level: AgentHealthLevel;
  if (consecutive_failures >= thresholds.unhealthy_consecutive_failures) {
    level = 'unhealthy';
  } else if (error_rate >= thresholds.unhealthy_error_rate) {
    level = 'unhealthy';
  } else if (error_rate >= thresholds.degraded_error_rate) {
    level = 'degraded';
  } else {
    level = 'healthy';
  }

  return {
    agent_name,
    level,
    total_runs,
    success_runs,
    failed_runs,
    consecutive_failures,
    error_rate,
    avg_duration_ms,
    ...(last_run_at != null ? { last_run_at } : {}),
    ...(last_success_at != null ? { last_success_at } : {}),
  };
}
