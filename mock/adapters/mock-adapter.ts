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

import { readFileSync } from 'fs';
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
// In-memory workflow state (mutable during dev session)
//
// Module-level so all MockDataAdapter instances share the same state cache.
// This is intentional: a hot-reload or second request must see the same state.
// ---------------------------------------------------------------------------

const workflowStateCache = new Map<string, WorkflowStateResponse>();

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

  // ---------------------------------------------------------------------------
  // DataAdapter implementation
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

  async getWorkflowState(caseId: string): Promise<WorkflowStateResponse> {
    return this.#loadWorkflowState(caseId);
  }

  async saveWorkflowState(caseId: string, state: WorkflowStateResponse): Promise<void> {
    workflowStateCache.set(caseId, state);
  }

  // ---------------------------------------------------------------------------
  // Mock-only helpers (not on DataAdapter interface)
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
      case_id: caseId,
      state: nextState,
      available_actions: availableActions,
      updated_at: new Date().toISOString(),
    };

    workflowStateCache.set(caseId, updated);
    return updated;
  }

  /** Reset in-memory state for a case back to the seed file value. Test helper. */
  resetState(caseId: string): void {
    workflowStateCache.delete(caseId);
  }
}
