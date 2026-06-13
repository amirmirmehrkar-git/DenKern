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

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WORKFLOW_TRANSITIONS } from '@denkkern/types';
import { runScenarioEngine, annotateFinancialImpact } from '@denkkern/engine';
import type {
  WorkflowEvent,
  WorkflowState,
  WorkflowStateResponse,
  WorkflowEventPayload,
  ScenarioConfig,
  DecisionRecord,
} from '@denkkern/types';
import { assembleScenarioEngineInput } from './assemble-engine-input.js';
import { getAdapter } from '../adapters/index.js';
import { scenarioStore } from './scenario-store.js';
import { validateApprovalEmitter } from './approval-gate.js';
import { buildAndWriteDecisionRecord } from './decision-record-writer.js';
import { initializeOutcomeTimeline } from './outcome-timeline-writer.js';

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
  //
  // C1: decision_confirmed must originate from a human user, never the system.
  //     See docs/architecture/02-workflow-state-machine.md §C1.
  if (payload.event === 'decision_confirmed' && payload.emitted_by === 'system') {
    throw new DispatchError(
      'decision_confirmed must be emitted by a user, not the system.',
      'FORBIDDEN_SOURCE',
      400
    );
  }

  // C2: second_approval_confirmed and second_approval_rejected must be emitted
  //     by a named supervisor — never 'lena' or 'system'.
  //     See docs/architecture/sprint-2-plan.md §2 (architecture rule C2).
  if (
    payload.event === 'second_approval_confirmed' ||
    payload.event === 'second_approval_rejected'
  ) {
    const c2Error = validateApprovalEmitter(payload.emitted_by);
    if (c2Error !== null) {
      throw new DispatchError(c2Error, 'FORBIDDEN_SOURCE', 400);
    }
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

  if (payload.event === 'decision_confirmed') {
    // DK-601 — Write the immutable DecisionRecord.
    // Non-blocking: a write failure is logged but does NOT prevent the approval
    // response from returning. The state still advances to outcome_pending so the
    // operator sees the correct next step. Re-run buildAndWriteDecisionRecord()
    // manually if the file is missing after an error.
    // The return value is captured so DK-705 can initialize the timeline from it.
    let decisionRecord: DecisionRecord | null = null;
    try {
      decisionRecord = buildAndWriteDecisionRecord(caseId, payload);
    } catch (err) {
      console.error(`[DK-601] DecisionRecord write FAILED for ${caseId}:`, err);
    }

    // Existing approval gate — may advance to second_approval_pending.
    await runApprovalGateConsequence(caseId, newState);

    // DK-601 — If the gate did not fire, advance to outcome_pending.
    // (If the gate fired, state is now second_approval_pending — leave it.)
    await advanceToOutcomePending(caseId);

    // DK-705 — Initialize the OutcomeTimeline now that outcome_capture_initiated
    // has fired and the case is in outcome_pending state.
    // Non-blocking: a failure is logged but does NOT prevent the decision response
    // from returning. The timeline can be re-initialized manually by re-dispatching
    // outcome_capture_initiated if needed.
    if (decisionRecord !== null) {
      try {
        await initializeOutcomeTimeline(caseId, decisionRecord);
      } catch (err) {
        console.error(`[DK-705] OutcomeTimeline initialization FAILED for ${caseId}:`, err);
      }
    }

    // Re-read — return whatever state the above consequences settled on.
    return await adapter.getWorkflowState(caseId);
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

  const { engineInput, businessFactors } = assembleScenarioEngineInput(
    caseId,
    ctx,
    SCENARIO_CONFIG
  );

  const rawResult = runScenarioEngine(engineInput);

  // Annotate with financial impact if business factors are present.
  // annotateFinancialImpact is pure and idempotent — safe to call unconditionally.
  const result = annotateFinancialImpact(rawResult, businessFactors);

  scenarioStore.set(caseId, result);

  // DK-601: Persist ScenarioResult to file for restart durability.
  // Writes scenario-result.json (engine native format, distinct from the
  // manually crafted scenario-evaluation.json mock seed).
  // decision-record-writer.ts reads scenario-evaluation.json first and
  // uses this file as a fallback — so this write protects the full engine path.
  try {
    const mockRoot = process.env['MOCK_ROOT'] ?? process.cwd();
    const outPath = join(mockRoot, 'mock', 'cases', caseId, 'scenario-result.json');
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
    // NTFS guard
    JSON.parse(readFileSync(outPath, 'utf-8'));
  } catch (err) {
    console.error(`[DK-601] ScenarioResult file persistence failed for ${caseId}:`, err);
  }
}

/**
 * DK-601: Auto-invoked after DecisionRecord is written and the approval gate
 * consequence has run.
 *
 * If the current state is still `decision_approved` (i.e. the gate did NOT fire
 * a `second_approval_required` event), advances the case to `outcome_pending`
 * via the `outcome_capture_initiated` system event.
 *
 * If the gate fired, the state is already `second_approval_pending` — this
 * function detects that and returns without touching state.
 */
async function advanceToOutcomePending(caseId: string): Promise<void> {
  const adapter = getAdapter();
  const current = await adapter.getWorkflowState(caseId);

  // Gate fired — do not override its transition.
  if (current.state !== 'decision_approved') return;

  const transitions = WORKFLOW_TRANSITIONS['decision_approved'];
  const nextState: WorkflowState | undefined = transitions['outcome_capture_initiated'];

  // Transition not defined (shouldn't happen after workflow.ts update, but be safe).
  if (nextState === undefined) return;

  const nextTransitions = WORKFLOW_TRANSITIONS[nextState];
  const availableActions = Object.keys(nextTransitions) as WorkflowEvent[];

  await adapter.saveWorkflowState(caseId, {
    case_id: caseId,
    state: nextState,
    available_actions: availableActions,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Auto-invoked after `decision_confirmed` transitions to `decision_approved`.
 *
 * Evaluates the approval gate against the stored ScenarioResult.
 * If the gate fires, dispatches `second_approval_required` (system-emitted)
 * which transitions the case to `second_approval_pending`.
 *
 * Source: docs/architecture/sprint-2-plan.md §2
 *
 * Authority note (Sprint 4 H-4):
 *   ScenarioResult.second_approval_required is set by the Scenario Engine, which
 *   evaluates all three gate criteria (financial threshold, execution complexity,
 *   and high/critical ExternalRiskSignal severity) deterministically before the
 *   result is stored. We trust that value here rather than re-evaluating via
 *   requiresSecondApproval() — the function's criterion 3 (ActiveRiskSignal[])
 *   uses the legacy lowercase-severity type and is never populated at this call
 *   site, making a dispatcher-side re-evaluation both redundant and incomplete.
 */
async function runApprovalGateConsequence(
  caseId: string,
  _currentState: WorkflowStateResponse
): Promise<void> {
  const result = scenarioStore.get(caseId);
  if (result === undefined) {
    // No scenario result in store — gate cannot evaluate; let execution proceed directly.
    return;
  }

  // Trust the engine's authoritative gate decision (see authority note above).
  if (!result.second_approval_required) {
    return;
  }

  // Gate fires — auto-advance to second_approval_pending via system event.
  // `second_approval_required` IS a valid system-emitted event (unlike decision_confirmed).
  const adapter = getAdapter();
  const current = await adapter.getWorkflowState(caseId);
  const transitions = WORKFLOW_TRANSITIONS[current.state as WorkflowState];
  const nextState: WorkflowState | undefined = transitions['second_approval_required'];

  if (nextState === undefined) {
    // Current state does not allow this transition (e.g. already past it) — skip.
    return;
  }

  const nextTransitions = WORKFLOW_TRANSITIONS[nextState];
  const availableActions = Object.keys(nextTransitions) as WorkflowEvent[];


  const gateState: WorkflowStateResponse = {
    case_id: caseId,
    state: nextState,
    available_actions: availableActions,
    updated_at: new Date().toISOString(),
  };

  await adapter.saveWorkflowState(caseId, gateState);
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
