/**
 * MockDataAdapter — DenkKern
 *
 * Reads seed data from mock/cases/:caseId/*.json.
 * Resolves as: customerOverride ?? envDefault ?? hardcodedDefault
 *
 * This adapter implements the same DataAdapter interface as the real adapter.
 * No if(mock) branches exist outside this file.
 *
 * Usage (default — standalone scripts, non-Next.js):
 *   const adapter = new MockDataAdapter();
 *
 * Usage (Next.js — cwd is apps/web/, not project root):
 *   const adapter = new MockDataAdapter(process.env['MOCK_ROOT']!);
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { DataAdapter } from './data-adapter.js';
import type {
  PredictionOutput,
  PredictionOutputMinimal,
  ShipmentContext,
  AlertEvent,
  DisruptionContext,
  WorkflowStateResponse,
  WorkflowEvent,
  WorkflowState,
  OutcomeTimeline,
  OutcomeCheckpoint,
  CheckpointStatus,
} from '@denkkern/types';
import { WORKFLOW_TRANSITIONS, normalizeMinimalPrediction } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Case ID → shipment ID resolution
// ---------------------------------------------------------------------------

/**
 * Map from caseId to the shipmentId contained in that case.
 * In dev, caseId and shipmentId are independent — CASE-001 contains SHIP-001.
 */
const CASE_TO_SHIPMENT: Record<string, string> = {
  'CASE-001': 'SHIP-001',
};

// ---------------------------------------------------------------------------
// In-memory caches (module-level — shared across all MockDataAdapter instances)
//
// All instances share the same caches so hot-reload or a second request
// within a process sees the same state.
// ---------------------------------------------------------------------------

/** Workflow state cache. Populated on first read; updated on every save. */
const workflowStateCache = new Map<string, WorkflowStateResponse>();

/**
 * Outcome timeline cache. Populated on first read; updated on every save.
 * null sentinel is NOT stored — a missing key means "not yet loaded from disk".
 * A null return from getOutcomeTimeline() means "file does not exist on disk".
 */
const outcomeTimelineCache = new Map<string, OutcomeTimeline>();

// ---------------------------------------------------------------------------
// Reminder lifecycle advancement map
//
// Defines the valid next status for each non-terminal checkpoint status.
// 'confirmed' and 'unresolved' are terminal — not present as source keys.
// 'pending' is not advanceable via this map — use sendCheckpointTask() first.
// ---------------------------------------------------------------------------

const REMINDER_ADVANCE: Partial<Record<CheckpointStatus, CheckpointStatus>> = {
  sent:       'reminder_1',
  reminder_1: 'reminder_2',
  reminder_2: 'reminder_3',
  reminder_3: 'unresolved',
};

// ---------------------------------------------------------------------------
// MockDataAdapter
// ---------------------------------------------------------------------------

export class MockDataAdapter implements DataAdapter {
  /**
   * Absolute path to the monorepo root (the directory that contains `mock/`).
   * Defaults to `process.cwd()` which is correct when running from the root.
   * Pass `process.env['MOCK_ROOT']` when running inside Next.js (cwd = apps/web/).
   */
  readonly #basePath: string;

  constructor(basePath?: string) {
    this.#basePath = basePath ?? process.cwd();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  #seedPath(caseId: string, filename: string): string {
    return join(this.#basePath, 'mock', 'cases', caseId, filename);
  }

  #readSeedJson<T>(caseId: string, filename: string): T {
    const filePath = this.#seedPath(caseId, filename);
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  }

  #loadWorkflowState(caseId: string): WorkflowStateResponse {
    if (workflowStateCache.has(caseId)) {
      return workflowStateCache.get(caseId)!;
    }
    const state = this.#readSeedJson<WorkflowStateResponse>(caseId, 'workflow-state.json');
    workflowStateCache.set(caseId, state);
    return state;
  }

  #caseIdForShipment(shipmentId: string): string {
    const entry = Object.entries(CASE_TO_SHIPMENT).find(([, sid]) => sid === shipmentId);
    if (entry === undefined) {
      throw new Error(`No mock case found for shipment '${shipmentId}'`);
    }
    return entry[0];
  }

  /**
   * Recompute the OutcomeTimeline summary from the current checkpoint array.
   * Always called before persisting — never stored as authoritative between reads.
   */
  #recomputeSummary(checkpoints: OutcomeCheckpoint[]): OutcomeTimeline['summary'] {
    const confirmed  = checkpoints.filter(c => c.status === 'confirmed').length;
    const unresolved = checkpoints.filter(c => c.status === 'unresolved').length;
    return {
      total:      checkpoints.length,
      confirmed,
      unresolved,
      pending:    checkpoints.length - confirmed - unresolved,
    };
  }

  /**
   * Append one entry to mock/cases/:caseId/outbound-email.json.
   * Creates the file as an empty array if it does not exist.
   * Applies the NTFS null-byte guard after writing.
   *
   * This is the mock equivalent of "send an email". No real email is sent.
   * The file accumulates a log of all dispatched checkpoint tasks and reminders
   * for the case, matching the Sprint 6B mock outbound notification pattern.
   */
  #appendOutboundEmail(caseId: string, entry: Record<string, unknown>): void {
    const filePath = this.#seedPath(caseId, 'outbound-email.json');
    let existing: Record<string, unknown>[] = [];
    try {
      existing = JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>[];
    } catch (err: unknown) {
      // ENOENT — file does not exist yet; start with empty array.
      // Any other error (permissions, disk full, corrupt JSON) is re-thrown.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    existing.push(entry);
    writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
    // NTFS null-byte guard: verify the write round-trips cleanly before returning.
    JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  // ---------------------------------------------------------------------------
  // DataAdapter implementation — workflow state
  // ---------------------------------------------------------------------------

  async getWorkflowState(caseId: string): Promise<WorkflowStateResponse> {
    return this.#loadWorkflowState(caseId);
  }

  async saveWorkflowState(caseId: string, state: WorkflowStateResponse): Promise<void> {
    workflowStateCache.set(caseId, state);
    // Persist to disk so state survives a server restart.
    // The _comment field is intentionally omitted — it exists only in hand-authored
    // seed files, not in runtime state written back by the adapter.
    const filePath = this.#seedPath(caseId, 'workflow-state.json');
    writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
    // NTFS null-byte guard: verify the write round-trips cleanly before returning.
    JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  // ---------------------------------------------------------------------------
  // DataAdapter implementation — prediction / context reads
  // ---------------------------------------------------------------------------

  async getPrediction(shipmentId: string): Promise<PredictionOutput> {
    const caseId = this.#caseIdForShipment(shipmentId);
    // Seed may be full PredictionOutput or PredictionOutputMinimal.
    // normalizeMinimalPrediction() is idempotent for full output.
    // This mirrors the pattern the real adapter must follow at the James API boundary.
    const data = this.#readSeedJson<(PredictionOutput | PredictionOutputMinimal) & { _comment?: string }>(caseId, 'prediction.json');
    const { _comment: _, ...raw } = data;
    return normalizeMinimalPrediction(raw as PredictionOutput | PredictionOutputMinimal);
  }

  async getShipmentContext(shipmentId: string): Promise<ShipmentContext> {
    const caseId = this.#caseIdForShipment(shipmentId);
    const data = this.#readSeedJson<ShipmentContext & { _comment?: string }>(caseId, 'shipment-context.json');
    const { _comment: _, ...context } = data;
    return context;
  }

  async getAlert(caseId: string): Promise<AlertEvent> {
    const data = this.#readSeedJson<AlertEvent & { _comment?: string }>(caseId, 'alert.json');
    const { _comment: _, ...alert } = data;
    return alert;
  }

  async getDisruptionContext(caseId: string): Promise<DisruptionContext> {
    const data = this.#readSeedJson<DisruptionContext & { _comment?: string }>(caseId, 'disruption-context.json');
    const { _comment: _, ...ctx } = data;
    return ctx;
  }

  // ---------------------------------------------------------------------------
  // DataAdapter implementation — outcome timeline
  // ---------------------------------------------------------------------------

  /**
   * Return the outcome timeline for a given case.
   *
   * Read path: in-memory cache → disk → null (if file does not exist).
   * null means the timeline has not been initialized for this case yet —
   * it is created by the dispatcher when outcome_capture_initiated fires (DK-705).
   */
  async getOutcomeTimeline(caseId: string): Promise<OutcomeTimeline | null> {
    if (outcomeTimelineCache.has(caseId)) {
      return outcomeTimelineCache.get(caseId)!;
    }
    const filePath = this.#seedPath(caseId, 'outcome-timeline.json');
    try {
      const raw = readFileSync(filePath, 'utf-8');
      // Strip _comment — it is a hand-authored seed convention, not part of the contract.
      const { _comment: _, ...timeline } = JSON.parse(raw) as OutcomeTimeline & { _comment?: string };
      outcomeTimelineCache.set(caseId, timeline);
      return timeline;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Persist the outcome timeline for a given case.
   *
   * Before writing:
   *   1. Recomputes summary from current checkpoint statuses (never trust stale summary).
   *   2. Updates the in-memory cache.
   *   3. Writes to mock/cases/:caseId/outcome-timeline.json.
   *   4. Applies NTFS null-byte guard (read-back + JSON.parse) before returning.
   *
   * The _comment field from hand-authored seeds is intentionally omitted on
   * every runtime write — same pattern as saveWorkflowState().
   */
  async saveOutcomeTimeline(caseId: string, timeline: OutcomeTimeline): Promise<void> {
    const withSummary: OutcomeTimeline = {
      ...timeline,
      summary: this.#recomputeSummary(timeline.checkpoints),
    };
    outcomeTimelineCache.set(caseId, withSummary);
    const filePath = this.#seedPath(caseId, 'outcome-timeline.json');
    writeFileSync(filePath, JSON.stringify(withSummary, null, 2), 'utf-8');
    // NTFS null-byte guard: verify the write round-trips cleanly before returning.
    JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  // ---------------------------------------------------------------------------
  // Mock-only helpers — outcome timeline lifecycle
  //
  // These methods are NOT on the DataAdapter interface.
  // They are used by the API route handlers (DK-706) and the verification
  // script (DK-708). They encapsulate all lifecycle transition rules so the
  // API layer stays thin and rule-free.
  //
  // All helpers:
  //   1. Load the current timeline (cache-first).
  //   2. Find the target checkpoint by id.
  //   3. Validate the transition is legal.
  //   4. Build the updated checkpoint (immutable spread pattern).
  //   5. Call saveOutcomeTimeline() — single write path, summary always recomputed.
  //   6. Return the updated checkpoint.
  // ---------------------------------------------------------------------------

  /**
   * Send the checkpoint task to the recipient.
   * Transitions status: pending → sent.
   * Appends a mock outbound-email entry (type: 'checkpoint_task').
   *
   * @throws if the timeline does not exist for this case.
   * @throws if the checkpoint is not found.
   * @throws if the checkpoint status is not 'pending'.
   */
  async sendCheckpointTask(caseId: string, checkpointId: string): Promise<OutcomeCheckpoint> {
    const timeline = await this.getOutcomeTimeline(caseId);
    if (timeline === null) {
      throw new Error(`No outcome timeline for case '${caseId}' — has outcome_capture_initiated fired?`);
    }

    const idx = timeline.checkpoints.findIndex(c => c.id === checkpointId);
    if (idx === -1) {
      throw new Error(`Checkpoint '${checkpointId}' not found in timeline for case '${caseId}'`);
    }

    const checkpoint = timeline.checkpoints[idx]!;
    if (checkpoint.status !== 'pending') {
      throw new Error(
        `Cannot send checkpoint '${checkpointId}': ` +
        `current status is '${checkpoint.status}', expected 'pending'`
      );
    }

    const now = new Date().toISOString();
    const updated: OutcomeCheckpoint = {
      ...checkpoint,
      status: 'sent',
      sent_at: now,
    };

    const updatedCheckpoints = [...timeline.checkpoints];
    updatedCheckpoints[idx] = updated;
    await this.saveOutcomeTimeline(caseId, { ...timeline, checkpoints: updatedCheckpoints });

    // Append mock outbound notification — no real email sent in Sprint 7.
    this.#appendOutboundEmail(caseId, {
      type:             'checkpoint_task',
      checkpoint_id:    checkpointId,
      case_id:          caseId,
      dimension:        checkpoint.dimension,
      recipient_id:     checkpoint.recipient_id,
      task_description: checkpoint.task_description,
      due_at:           checkpoint.due_at,
      sent_at:          now,
      reminder_count:   0,
    });

    return updated;
  }

  /**
   * Advance the reminder lifecycle for a checkpoint that has not responded.
   *
   * Valid source → target transitions:
   *   sent → reminder_1
   *   reminder_1 → reminder_2
   *   reminder_2 → reminder_3
   *   reminder_3 → unresolved  (terminal — no further advances possible)
   *
   * For reminder_1/2/3: increments reminder_count, sets last_reminder_at,
   *   appends a mock outbound email (type: 'checkpoint_reminder').
   * For unresolved: sets status only — no email sent (recipient did not respond).
   *
   * @throws if the timeline does not exist.
   * @throws if the checkpoint is not found.
   * @throws if the checkpoint is 'pending', 'confirmed', or 'unresolved'.
   */
  async advanceReminderForCheckpoint(
    caseId: string,
    checkpointId: string
  ): Promise<OutcomeCheckpoint> {
    const timeline = await this.getOutcomeTimeline(caseId);
    if (timeline === null) {
      throw new Error(`No outcome timeline for case '${caseId}'`);
    }

    const idx = timeline.checkpoints.findIndex(c => c.id === checkpointId);
    if (idx === -1) {
      throw new Error(`Checkpoint '${checkpointId}' not found in timeline for case '${caseId}'`);
    }

    const checkpoint = timeline.checkpoints[idx]!;
    const nextStatus = REMINDER_ADVANCE[checkpoint.status];

    if (nextStatus === undefined) {
      throw new Error(
        `Cannot advance reminder for checkpoint '${checkpointId}': ` +
        `status is '${checkpoint.status}'. ` +
        `Valid source statuses: 'sent', 'reminder_1', 'reminder_2', 'reminder_3'`
      );
    }

    const now = new Date().toISOString();
    const isReminderEmail = nextStatus !== 'unresolved';

    const updated: OutcomeCheckpoint = {
      ...checkpoint,
      status:          nextStatus,
      reminder_count:  isReminderEmail ? checkpoint.reminder_count + 1 : checkpoint.reminder_count,
      last_reminder_at: isReminderEmail ? now : checkpoint.last_reminder_at,
    };

    const updatedCheckpoints = [...timeline.checkpoints];
    updatedCheckpoints[idx] = updated;
    await this.saveOutcomeTimeline(caseId, { ...timeline, checkpoints: updatedCheckpoints });

    // Append mock outbound notification for reminder_1/2/3 only.
    // When advancing to 'unresolved', there is nothing further to send.
    if (isReminderEmail) {
      this.#appendOutboundEmail(caseId, {
        type:             'checkpoint_reminder',
        checkpoint_id:    checkpointId,
        case_id:          caseId,
        dimension:        checkpoint.dimension,
        recipient_id:     checkpoint.recipient_id,
        task_description: checkpoint.task_description,
        due_at:           checkpoint.due_at,
        reminder_sent_at: now,
        reminder_count:   updated.reminder_count,
        next_status:      nextStatus,
      });
    }

    return updated;
  }

  /**
   * Confirm a checkpoint — the recipient has provided their outcome data.
   * Transitions status to 'confirmed' (terminal).
   *
   * Valid from any non-terminal status: pending, sent, reminder_1/2/3.
   * Confirmation can arrive at any point in the reminder lifecycle.
   *
   * @param confirmedBy  user_id of the person confirming (e.g. "lena")
   * @param outcomeData  free-form outcome facts provided by the recipient.
   *                     Shape is UI-validated — the adapter stores it as-is.
   *
   * @throws if the timeline does not exist.
   * @throws if the checkpoint is not found.
   * @throws if the checkpoint is already in a terminal state ('confirmed' or 'unresolved').
   */
  async confirmCheckpoint(
    caseId: string,
    checkpointId: string,
    confirmedBy: string,
    outcomeData: Record<string, unknown>
  ): Promise<OutcomeCheckpoint> {
    const timeline = await this.getOutcomeTimeline(caseId);
    if (timeline === null) {
      throw new Error(`No outcome timeline for case '${caseId}'`);
    }

    const idx = timeline.checkpoints.findIndex(c => c.id === checkpointId);
    if (idx === -1) {
      throw new Error(`Checkpoint '${checkpointId}' not found in timeline for case '${caseId}'`);
    }

    const checkpoint = timeline.checkpoints[idx]!;
    if (checkpoint.status === 'confirmed' || checkpoint.status === 'unresolved') {
      throw new Error(
        `Cannot confirm checkpoint '${checkpointId}': ` +
        `status is '${checkpoint.status}' (terminal — no further transitions)`
      );
    }

    const now = new Date().toISOString();
    const updated: OutcomeCheckpoint = {
      ...checkpoint,
      status:       'confirmed',
      confirmed_at: now,
      confirmed_by: confirmedBy,
      outcome_data: outcomeData,
    };

    const updatedCheckpoints = [...timeline.checkpoints];
    updatedCheckpoints[idx] = updated;
    await this.saveOutcomeTimeline(caseId, { ...timeline, checkpoints: updatedCheckpoints });

    return updated;
  }

  /**
   * Force a checkpoint to 'unresolved' (terminal) without waiting for reminder_3.
   * Used by supervisors or the UI "Mark unresolved" action.
   *
   * Idempotent if already 'unresolved' — returns the checkpoint unchanged.
   *
   * @throws if the timeline does not exist.
   * @throws if the checkpoint is not found.
   * @throws if the checkpoint is already 'confirmed' (cannot unmark a confirmation).
   */
  async markCheckpointUnresolved(
    caseId: string,
    checkpointId: string
  ): Promise<OutcomeCheckpoint> {
    const timeline = await this.getOutcomeTimeline(caseId);
    if (timeline === null) {
      throw new Error(`No outcome timeline for case '${caseId}'`);
    }

    const idx = timeline.checkpoints.findIndex(c => c.id === checkpointId);
    if (idx === -1) {
      throw new Error(`Checkpoint '${checkpointId}' not found in timeline for case '${caseId}'`);
    }

    const checkpoint = timeline.checkpoints[idx]!;

    if (checkpoint.status === 'confirmed') {
      throw new Error(
        `Cannot mark checkpoint '${checkpointId}' as unresolved: already 'confirmed' (terminal)`
      );
    }

    // Idempotent — already unresolved, nothing to do.
    if (checkpoint.status === 'unresolved') {
      return checkpoint;
    }

    const updated: OutcomeCheckpoint = {
      ...checkpoint,
      status: 'unresolved',
    };

    const updatedCheckpoints = [...timeline.checkpoints];
    updatedCheckpoints[idx] = updated;
    await this.saveOutcomeTimeline(caseId, { ...timeline, checkpoints: updatedCheckpoints });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Mock-only helpers — workflow (pre-Sprint 7, kept for backward compatibility)
  // ---------------------------------------------------------------------------

  /**
   * Convenience method for tests and scripts that need to advance state
   * without going through the full dispatcher.
   * @deprecated Prefer dispatchWorkflowEvent() from the API dispatcher for
   *   production-equivalent flows. This method skips consequence handling.
   */
  dispatchEventDirect(caseId: string, event: WorkflowEvent): WorkflowStateResponse {
    const current = this.#loadWorkflowState(caseId);
    const transitions = WORKFLOW_TRANSITIONS[current.state as WorkflowState];
    const nextState = transitions[event];

    if (nextState === undefined) {
      throw new Error(
        `Invalid transition: event '${event}' is not valid from state '${current.state}' (case ${caseId})`
      );
    }

    const nextTransitions = WORKFLOW_TRANSITIONS[nextState];
    const availableActions = Object.keys(nextTransitions) as WorkflowEvent[];

    const updated: WorkflowStateResponse = {
      case_id:           caseId,
      state:             nextState,
      available_actions: availableActions,
      updated_at:        new Date().toISOString(),
    };

    // Route through saveWorkflowState so disk persistence applies here too.
    void this.saveWorkflowState(caseId, updated);
    return updated;
  }

  /** Reset in-memory workflow state for a case back to the seed file value. Test helper. */
  resetState(caseId: string): void {
    workflowStateCache.delete(caseId);
  }

  /**
   * Reset in-memory outcome timeline cache for a case.
   * Next getOutcomeTimeline() call will re-read from disk.
   * Test helper — simulates an adapter reload / server restart.
   */
  resetOutcomeTimeline(caseId: string): void {
    outcomeTimelineCache.delete(caseId);
  }
}
