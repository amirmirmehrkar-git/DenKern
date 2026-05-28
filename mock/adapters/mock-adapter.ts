/**
 * MockDataAdapter — DenkKern
 *
 * Reads seed data from mock/cases/:caseId/*.json.
 * Resolves as: customerOverride ?? envDefault ?? hardcodedDefault
 *
 * This adapter implements the same DataAdapter interface as the real adapter.
 * No if(mock) branches exist outside this file.
 *
 * Usage:
 *   const adapter = new MockDataAdapter();
 *   const prediction = await adapter.getPrediction('SHIP-001');
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { DataAdapter } from './data-adapter.js';
import type {
  PredictionOutput,
  ShipmentContext,
  AlertEvent,
  DisruptionContext,
  WorkflowStateResponse,
  WorkflowEvent,
  WorkflowState,
} from '@denkkern/types';
import { WORKFLOW_TRANSITIONS } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Case ID → file path resolution
// ---------------------------------------------------------------------------

/**
 * Map from caseId to the directory containing seed JSON files.
 * In dev, caseId and shipmentId are independent — CASE-001 contains SHIP-001.
 */
const CASE_TO_SHIPMENT: Record<string, string> = {
  'CASE-001': 'SHIP-001',
};

function seedPath(caseId: string, filename: string): string {
  const mockRoot = join(process.cwd(), 'mock', 'cases', caseId);
  return join(mockRoot, filename);
}

function readSeedJson<T>(caseId: string, filename: string): T {
  const path = seedPath(caseId, filename);
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as T;
}

// ---------------------------------------------------------------------------
// In-memory workflow state (mutable during dev session)
// ---------------------------------------------------------------------------

const workflowStateCache = new Map<string, WorkflowStateResponse>();

function loadWorkflowState(caseId: string): WorkflowStateResponse {
  if (workflowStateCache.has(caseId)) {
    return workflowStateCache.get(caseId)!;
  }
  const state = readSeedJson<WorkflowStateResponse>(caseId, 'workflow-state.json');
  workflowStateCache.set(caseId, state);
  return state;
}

// ---------------------------------------------------------------------------
// MockDataAdapter
// ---------------------------------------------------------------------------

export class MockDataAdapter implements DataAdapter {
  async getPrediction(shipmentId: string): Promise<PredictionOutput> {
    // Reverse-lookup caseId from shipmentId
    const caseId = this.#caseIdForShipment(shipmentId);
    const data = readSeedJson<PredictionOutput & { _comment?: string }>(caseId, 'prediction.json');
    const { _comment: _, ...prediction } = data;
    return prediction;
  }

  async getShipmentContext(shipmentId: string): Promise<ShipmentContext> {
    const caseId = this.#caseIdForShipment(shipmentId);
    const data = readSeedJson<ShipmentContext & { _comment?: string }>(caseId, 'shipment-context.json');
    const { _comment: _, ...context } = data;
    return context;
  }

  async getAlert(caseId: string): Promise<AlertEvent> {
    const data = readSeedJson<AlertEvent & { _comment?: string }>(caseId, 'alert.json');
    const { _comment: _, ...alert } = data;
    return alert;
  }

  async getDisruptionContext(caseId: string): Promise<DisruptionContext> {
    const data = readSeedJson<DisruptionContext & { _comment?: string }>(caseId, 'disruption-context.json');
    const { _comment: _, ...ctx } = data;
    return ctx;
  }

  async getWorkflowState(caseId: string): Promise<WorkflowStateResponse> {
    return loadWorkflowState(caseId);
  }

  /**
   * Advance workflow state by dispatching an event.
   * Only used by the mock API handler — not part of the DataAdapter interface.
   * Real adapter equivalent: POST to the orchestration layer's dispatcher.
   */
  dispatchEvent(caseId: string, event: WorkflowEvent): WorkflowStateResponse {
    const current = loadWorkflowState(caseId);
    const transitions = WORKFLOW_TRANSITIONS[current.state as WorkflowState];
    const nextState = transitions[event];

    if (nextState === undefined) {
      throw new Error(
        `Invalid transition: event '${event}' is not valid from state '${current.state}' (case ${caseId})`
      );
    }

    // Compute available_actions for the next state
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

  // ---------------------------------------------------------------------------

  #caseIdForShipment(shipmentId: string): string {
    const entry = Object.entries(CASE_TO_SHIPMENT).find(([, sid]) => sid === shipmentId);
    if (entry === undefined) {
      throw new Error(`No mock case found for shipment '${shipmentId}'`);
    }
    return entry[0];
  }
}
