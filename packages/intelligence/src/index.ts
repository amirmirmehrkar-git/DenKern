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

// Validation utilities (exposed for downstream testing)
export { validateSignal, validateSignals } from './validate.js';
export type { ValidationResult, BatchValidationResult } from './validate.js';
