/**
 * Workflow event dispatcher — DenkKern
 *
 * Single entry point for all workflow state transitions in the API layer.
 *
 * Dispatcher steps (source: docs/architecture/05-event-orchestration.md):
 *   1. Validate source rules (decision_confirmed must come from a user)
 *   2. Load current workflow state
 *   3. Validate the event is a legal transition from the current state
 *   4. Compute next state + available_actions
 *   5. Persist new state via adapter.saveWorkflowState()
 *   6. Invoke consequences (context_confirmed → run scenario engine)
 *   7. Return the new WorkflowStateResponse
 *
 * The dispatcher owns the transition logic. The adapter is a dumb
 * read/write layer — it does not contain transition rules.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { WORKFLOW_TRANSITIONS } from '@denkkern/types';
import { runScenarioEngine } from '@denkkern/engine';
import type {
  WorkflowEvent,
  WorkflowState,
  WorkflowStateResponse,
  WorkflowEventPayload,
  ScenarioConfig,
  ScenarioEngineInput,
  ActiveRiskSignal,
} from '@denkkern/types';
import { getAdapter } from '../adapters/index.js';
import { scenarioStore } from './scenario-store.js';

// ---------------------------------------------------------------------------
// Scenario config — loaded once at module init from config/scenario-defaults.json
// ---------------------------------------------------------------------------

function loadScenarioConfig(): ScenarioConfig {
  const mockRoot = process.env['MOCK_ROOT'] ?? process.cwd();
  const configPath = join(mockRoot, 'config', 'scenario-defaults.json');
  const raw = readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as ScenarioConfig;
}

// Evaluated once when the module is first imported. Next.js keeps server
// modules alive for the process lifetime, so this is effectively a singleton.
const SCENARIO_CONFIG: ScenarioConfig = loadScenarioConfig();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Dispatch a workflow event for a given case.
 *
 * @throws {DispatchError} if the transition is invalid or source rules are violated
 */
export async function dispatchWorkflowEvent(
  caseId: string,
  payload: WorkflowEventPayload
): Promise<WorkflowStateResponse> {
  // Step 1 — Source validation
  // decision_confirmed must originate from a human user, never the system.
  // See docs/architecture/02-workflow-state-machine.md §C1.
  if (payload.event === 'decision_confirmed' && payload.emitted_by === 'system') {
    throw new DispatchError(
      'decision_confirmed must be emitted by a user, not the system.',
      'FORBIDDEN_SOURCE',
      400
    );
  }

  const adapter = getAdapter();

  // Step 2 — Load current state
  const current = await adapter.getWorkflowState(caseId);

  // Step 3 — Validate transition
  const transitions = WORKFLOW_TRANSITIONS[current.state as WorkflowState];
  const nextState: WorkflowState | undefined = transitions[payload.event];

  if (nextState === undefined) {
    throw new DispatchError(
      `Event '${payload.event}' is not a valid transition from state '${current.state}'.`,
      'INVALID_TRANSITION',
      422
    );
  }

  // Step 4 — Compute available_actions for the new state
  const nextTransitions = WORKFLOW_TRANSITIONS[nextState];
  const availableActions = Object.keys(nextTransitions) as WorkflowEvent[];

  const newState: WorkflowStateResponse = {
    case_id: caseId,
    state: nextState,
    available_actions: availableActions,
    updated_at: new Date().toISOString(),
  };

  // Step 5 — Persist
  await adapter.saveWorkflowState(caseId, newState);

  // Step 6 — Consequences
  if (payload.event === 'context_confirmed') {
    await runScenarioConsequence(caseId);
  }

  // Step 7 — Return
  return newState;
}

// ---------------------------------------------------------------------------
// Consequences
// ---------------------------------------------------------------------------

/**
 * Auto-invoked when `context_confirmed` is dispatched.
 *
 * Loads the disruption context (immutable snapshot assembled before this event),
 * builds ScenarioEngineInput, runs the pure scenario engine, and stores the result.
 *
 * Source: docs/architecture/05-event-orchestration.md §3 (Consequence layer)
 */
async function runScenarioConsequence(caseId: string): Promise<void> {
  const adapter = getAdapter();
  const ctx = await adapter.getDisruptionContext(caseId);
  const sc = ctx.shipment_context;

  // Map DisruptionContext signals → ActiveRiskSignal[]
  const signals: ActiveRiskSignal[] = [];

  if (ctx.weather_signal !== undefined) {
    signals.push({
      type: 'weather_disruption',
      location: ctx.weather_signal.route_id,
      severity: ctx.weather_signal.severity,
      estimated_impact_days: ctx.weather_signal.estimated_delay_impact_days,
      source: ctx.weather_signal.source,
    });
  }

  for (const news of ctx.news_signals ?? []) {
    signals.push({
      type: news.event_type,
      location: news.region_id,
      severity: news.severity,
      estimated_impact_days: news.estimated_delay_impact_days,
      source: news.source,
    });
  }

  const input: ScenarioEngineInput = {
    case_id: caseId,
    prediction_snapshot: ctx.prediction,
    erp_context: {
      daily_downtime_cost_eur: sc.production_context.daily_downtime_cost_eur,
      required_by:             sc.production_context.required_by,
      inventory:               sc.inventory,
    },
    freight_options:     sc.freight_options,
    active_risk_signals: signals,
    scenario_config:     SCENARIO_CONFIG,
  };

  const result = runScenarioEngine(input);
  scenarioStore.set(caseId, result);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class DispatchError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name = 'DispatchError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
