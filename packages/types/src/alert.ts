/**
 * Alert event contracts — DenkKern
 *
 * Source of truth: docs/architecture/06-data-contracts.md §3
 * Owner: Orchestration layer
 *
 * IMMUTABILITY RULE: Immutable once generated. A new prediction event produces
 * a new alert — it does not update the existing one.
 */

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AlertEvent {
  alert_id: string;                 // UUID
  case_id: string;
  shipment_id: string;
  severity: AlertSeverity;
  summary: string;                  // One-sentence plain-language description shown to Lena
  triggered_at: string;             // ISO 8601
  triggered_by_event_id: string;    // Links to the prediction_received event that caused this alert
  p_delay_over_3_days: number;      // Surfaced for quick operator scan
  confidence_score: number;         // Surfaced for quick operator scan
  expected_delay_days: number;
}
