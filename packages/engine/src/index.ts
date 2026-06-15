/**
 * @denkkern/engine — Public API
 *
 * The scenario engine is a pure function:
 *   runScenarioEngine(ScenarioEngineInput): ScenarioResult
 *
 * Import only what you need:
 *   import { runScenarioEngine } from '@denkkern/engine'
 */

export { runScenarioEngine, ENGINE_VERSION } from './engine.js';
export { annotateFinancialImpact } from './financial-impact.js';

// Expose helpers used by tests and the API layer
export { classifyConfidenceTier, classifyRiskLevel, daysBetween, formatEur } from './classify.js';

// State machine executor — DK-806
export { attemptTransition } from './state-machine/executor.js';
export { evaluateCondition, CONDITION_REGISTRY } from './state-machine/condition-registry.js';
export type { TransitionResult, TransitionError, TransitionErrorCode } from './state-machine/executor.js';
