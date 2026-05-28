/**
 * @denkkern/types — Public API
 *
 * All shared TypeScript contracts for the DenkKern platform.
 * Import from this package: import type { WorkflowState, ... } from '@denkkern/types'
 *
 * Source of truth for all contracts: docs/architecture/06-data-contracts.md
 */

// Workflow state machine
export type {
  WorkflowState,
  WorkflowEvent,
  TransitionMap,
  WorkflowStateResponse,
  WorkflowEventPayload,
} from './workflow.js';

export { WORKFLOW_TRANSITIONS } from './workflow.js';

// Prediction (James → DenkKern boundary)
export type {
  PredictionOutput,
  PredictionOutputMinimal,
  ConfidenceTier,
} from './prediction.js';

export { classifyConfidence } from './prediction.js';

// Shipment context (ERP adapter)
export type { ShipmentContext } from './shipment.js';

// Alert
export type { AlertEvent, AlertSeverity } from './alert.js';

// Disruption context
export type {
  DisruptionContext,
  WeatherSignal,
  NewsSignal,
  SignalSeverity,
  SignalSource,
} from './disruption.js';

// Scenario engine (input, output, config)
export type {
  ScenarioConfig,
  ScenarioEngineInput,
  ActiveRiskSignal,
  Scenario,
  ScenarioType,
  ScenarioExplanation,
  AssumptionsLog,
  RecommendationResult,
  ScenarioResult,
  RiskLevel,
  ExecutionComplexity,
} from './scenario.js';

export { DECISION_NOTE } from './scenario.js';

// Decision approval
export type { DecisionApproval, DecisionContext } from './decision.js';

// Execution task
export type {
  ExecutionTask,
  ExecutionStep,
  StepStatus,
  TaskStatus,
} from './execution.js';

// Audit
export type { AuditEntry, AuditOutcome, OutcomeStatus } from './audit.js';
