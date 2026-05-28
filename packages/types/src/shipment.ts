/**
 * Shipment context contracts — DenkKern
 *
 * Source of truth: docs/architecture/06-data-contracts.md §2
 * Owner: Backend (context/enrichment layer)
 *
 * IMMUTABILITY RULE: Snapshotted at `context_confirmed`. Snapshot is immutable.
 * The live record may be updated between alerts, but the snapshot flowing into the
 * scenario engine and audit is frozen at confirmation time.
 */

export interface ShipmentContext {
  // Shipment identity
  shipment_id: string;
  shipment_name: string;            // Human-readable label, e.g. "Marine Bolts — MSC Barcelona"
  vessel_name?: string;
  current_location?: string;
  destination: string;              // e.g. "Hamburg"

  // Customer / ERP
  customer_id: string;
  production_context: {
    daily_downtime_cost_eur: number; // Core financial input for scenario scoring
    critical_part: string;           // e.g. "Marine-quality bolts"
    required_by: string;             // ISO date — when part must arrive
  };

  // Inventory / replacement
  inventory: {
    replacement_available: boolean;  // Gates the REPLACE scenario
    replacement_location?: string;   // Required if replacement_available = true
    replacement_cost_eur?: number;   // Required if replacement_available = true
    replacement_arrival_date?: string; // ISO date — required if replacement_available = true
  };

  // Freight reroute options (empty array disables REROUTE scenario)
  freight_options: Array<{
    option_id: string;
    from: string;
    to: string;
    cost_eur: number;
    estimated_arrival_date: string;  // ISO date
    confidence_score: number;        // 0.0–1.0
  }>;
}
