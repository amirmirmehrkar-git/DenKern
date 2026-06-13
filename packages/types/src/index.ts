/**
 * @denkkern/types -- Public API
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

// Prediction (James -> DenkKern boundary)
export type {
  PredictionOutput,
  PredictionOutputMinimal,
  ConfidenceTier,
} from './prediction.js';

export {
  classifyConfidence,
  isPredictionOutputFull,
  normalizeMinimalPrediction,
} from './prediction.js';

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
  BusinessFactors,
  FinancialImpactAnnotation,
} from './scenario.js';

export { DECISION_NOTE } from './scenario.js';

// Decision approval (legacy per-event record)
export type { DecisionApproval, DecisionContext } from './decision.js';

// Decision Memory -- DecisionRecord + OutcomeRecord + OutcomeDraft (Sprint 6)
export type {
  DecisionRecord,
  OutcomeRecord,
  OutcomeDraft,
  ProductionImpact,
  DecisionQuality,
  PredictionAccuracyAssessment,
} from './decision-record.js';

// Outcome Timeline -- parallel to DecisionRecord.outcome (Sprint 7)
// OutcomeTimeline does NOT replace or modify OutcomeRecord.
// See docs/strategy/outcome-reality-model-v1.md for the separation rationale.
export type {
  OutcomeTimeline,
  OutcomeCheckpoint,
  OutcomeTimelineSummary,
  CheckpointStatus,
  OutcomeDimension,
  CheckpointTemplate,
} from './outcome-timeline.js';

// Execution task
export type {
  ExecutionTask,
  ExecutionStep,
  StepStatus,
  TaskStatus,
} from './execution.js';

// Audit
export type { AuditEntry, AuditOutcome, OutcomeStatus } from './audit.js';

// External risk signals (LLM extraction / mock layer)
export type {
  ExternalRiskSignalType,
  ExternalRiskSeverity,
  ExternalRiskSourceType,
  ExternalRiskEngineEffect,
  ExternalRiskTimeWindow,
  ExternalRiskSignal,
} from './external-risk.js';

// Financial impact layer
export type {
  FinancialImpactInput,
  FinancialImpactResult,
  BufferExhaustionRisk,
} from './financial.js';

export { calculateFinancialImpact } from './financial.js';
