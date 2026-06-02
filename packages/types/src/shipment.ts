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

    // Sprint 2.5 additions — optional; used by annotateFinancialImpact()
    inventory_buffer_days?: number;              // Days production can absorb without the part
    part_criticality?: 'LOW' | 'MEDIUM' | 'HIGH'; // HIGH = blocks production immediately
    contract_penalty_eur_per_day?: number;       // Customer SLA penalty per overdue day
    contract_penalty_trigger_day?: number;       // Day delay must exceed before penalty applies (0 = immediate)
    affected_production_lines?: number;          // How many lines depend on this part (default 1)
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
