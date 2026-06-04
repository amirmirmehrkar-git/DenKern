/**
 * AgentExecutionResult — DenkKern Agent Platform
 *
 * Represents the outcome of a single agent run: success with signals,
 * or failure with a captured error. Never contains scenarios, decisions,
 * recommendations, or financial calculations.
 *
 * LLM boundary: agents return ExternalRiskSignal[] only.
 * This model carries those signals plus execution metadata.
 */

import type { ExternalRiskSignal } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Execution status
// ---------------------------------------------------------------------------

export type AgentExecutionStatus = 'success' | 'failure' | 'timeout' | 'skipped';

// ---------------------------------------------------------------------------
// AgentExecutionResult
// ---------------------------------------------------------------------------

export interface AgentExecutionResult {
  /** Agent that produced this result */
  readonly agent_name: string;
  /** Case this run was for */
  readonly case_id: string;
  /** Shipment this run was for */
  readonly shipment_id: string;
  /** Outcome of the run */
  readonly status: AgentExecutionStatus;
  /** Signals produced on success — empty array on failure/timeout/skipped */
  readonly signals: ExternalRiskSignal[];
  /** Wall-clock duration in milliseconds */
  readonly duration_ms: number;
  /** ISO timestamp when the run started */
  readonly started_at: string;
  /** ISO timestamp when the run completed */
  readonly completed_at: string;
  /** Error captured on failure — absent on success */
  readonly error?: {
    readonly message: string;
    readonly code?: string;
    readonly stack?: string;
  };
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function makeSuccessResult(
  agent_name: string,
  case_id: string,
  shipment_id: string,
  signals: ExternalRiskSignal[],
  started_at: string,
  duration_ms: number
): AgentExecutionResult {
  return {
    agent_name,
    case_id,
    shipment_id,
    status: 'success',
    signals,
    duration_ms,
    started_at,
    completed_at: new Date(new Date(started_at).getTime() + duration_ms).toISOString(),
  };
}

export function makeFailureResult(
  agent_name: string,
  case_id: string,
  shipment_id: string,
  error: unknown,
  started_at: string,
  duration_ms: number
): AgentExecutionResult {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    agent_name,
    case_id,
    shipment_id,
    status: 'failure',
    signals: [],
    duration_ms,
    started_at,
    completed_at: new Date(new Date(started_at).getTime() + duration_ms).toISOString(),
    error: {
      message: err.message,
      ...(err.name !== 'Error' ? { code: err.name } : {}),
    },
  };
}

export function makeTimeoutResult(
  agent_name: string,
  case_id: string,
  shipment_id: string,
  timeout_ms: number,
  started_at: string
): AgentExecutionResult {
  return {
    agent_name,
    case_id,
    shipment_id,
    status: 'timeout',
    signals: [],
    duration_ms: timeout_ms,
    started_at,
    completed_at: new Date(new Date(started_at).getTime() + timeout_ms).toISOString(),
    error: {
      message: `Agent timed out after ${timeout_ms}ms`,
      code: 'AGENT_TIMEOUT',
    },
  };
}

export function makeSkippedResult(
  agent_name: string,
  case_id: string,
  shipment_id: string,
  reason: string
): AgentExecutionResult {
  const now = new Date().toISOString();
  return {
    agent_name,
    case_id,
    shipment_id,
    status: 'skipped',
    signals: [],
    duration_ms: 0,
    started_at: now,
    completed_at: now,
    error: { message: reason, code: 'AGENT_SKIPPED' },
  };
}
