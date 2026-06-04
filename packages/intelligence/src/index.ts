/**
 * @denkkern/intelligence — Public API
 *
 * External risk intelligence layer for DenkKern.
 *
 * Primary usage:
 *   import { collectExternalRiskSignals } from '@denkkern/intelligence'
 *   const signals = await collectExternalRiskSignals(context)
 *   // → pass into ScenarioEngineInput.external_risk_signals
 *
 * LLM boundary (enforced throughout this package):
 *   Agents find / classify / summarise / generate ExternalRiskSignal objects.
 *   Agents NEVER recommend scenarios, approve decisions, or calculate financial impact.
 */

// Primary aggregator
export { collectExternalRiskSignals } from './collect.js';
export type { CollectOptions } from './collect.js';

// Agent interface + context types
export type { ExternalRiskAgent, AgentContext, RawPortEvent, RawGeopoliticalEvent, RawSupplierEvent } from './types.js';

// Individual agents (for custom composition or testing)
export { PortIntelligenceAgent } from './agents/port-intelligence.js';
export { GeopoliticalRiskAgent } from './agents/geopolitical-risk.js';
export { SupplierRiskAgent } from './agents/supplier-risk.js';
export { WeatherContextAgent } from './agents/weather-context.js';
export type { RawWeatherEvent } from './agents/weather-context.js';

// Validation utilities (exposed for downstream testing)
export { validateSignal, validateSignals } from './validate.js';
export type { ValidationResult, BatchValidationResult } from './validate.js';

// ---------------------------------------------------------------------------
// Agent Platform Foundation
// ---------------------------------------------------------------------------

// Execution result model
export {
  makeSuccessResult,
  makeFailureResult,
  makeTimeoutResult,
  makeSkippedResult,
} from './execution-result.js';
export type { AgentExecutionResult, AgentExecutionStatus } from './execution-result.js';

// Agent health
export { computeHealthStatus, DEFAULT_HEALTH_THRESHOLDS } from './health.js';
export type {
  AgentHealthStatus,
  AgentHealthLevel,
  HealthThresholds,
  HealthSnapshot,
} from './health.js';

// Agent metrics
export { computeAgentMetrics } from './metrics.js';
export type { AgentMetrics } from './metrics.js';

// Audit trail
export { AgentAuditTrail } from './audit.js';

// Agent registry
export { AgentRegistry } from './agent-registry.js';
export type { AgentRegistration, RegistrationOptions } from './agent-registry.js';

// Agent runner (primary platform entry point)
export { AgentRunner } from './agent-runner.js';
export type { RunnerConfig, RunResult } from './agent-runner.js';
