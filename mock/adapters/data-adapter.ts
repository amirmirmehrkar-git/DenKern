/**
 * DataAdapter interface — DenkKern
 *
 * Every data source (mock or real) must implement this interface.
 * The orchestration layer and scenario engine must not contain
 * `if (mock)` branches. Shape identity is enforced at the adapter boundary.
 *
 * See docs/architecture/06-data-contracts.md §14 (Mock-to-Real Adapter Rule)
 */

import type {
  PredictionOutput,
  ShipmentContext,
  AlertEvent,
  DisruptionContext,
  WorkflowStateResponse,
} from '@denkkern/types';

export interface DataAdapter {
  /**
   * Return James' prediction for a given shipment.
   * Mock: reads from mock/cases/:caseId/prediction.json
   * Real: calls James ML API endpoint
   */
  getPrediction(shipmentId: string): Promise<PredictionOutput>;

  /**
   * Return ERP/shipment context for a given shipment.
   * Mock: reads from mock/cases/:caseId/shipment-context.json
   * Real: calls ERP adapter
   */
  getShipmentContext(shipmentId: string): Promise<ShipmentContext>;

  /**
   * Return the alert record for a given case.
   * Mock: reads from mock/cases/:caseId/alert.json
   * Real: reads from case database
   */
  getAlert(caseId: string): Promise<AlertEvent>;

  /**
   * Return the assembled disruption context for a given case.
   * Mock: reads from mock/cases/:caseId/disruption-context.json
   * Real: assembled by context enrichment layer on demand
   */
  getDisruptionContext(caseId: string): Promise<DisruptionContext>;

  /**
   * Return current workflow state for a given case.
   * Mock: reads from mock/cases/:caseId/workflow-state.json (mutable in-memory for dev)
   * Real: reads from case database
   */
  getWorkflowState(caseId: string): Promise<WorkflowStateResponse>;
}
