/**
 * External Intelligence Agent contracts — DenkKern
 *
 * LLM boundary rules (enforced throughout this package):
 *   - Agents find / classify / summarise / generate ExternalRiskSignal objects.
 *   - Agents NEVER recommend scenarios.
 *   - Agents NEVER approve decisions.
 *   - Agents NEVER perform financial calculations.
 *   - The Scenario Engine remains the sole decision layer.
 *
 * For MVP: agents are fixture-backed (no real API calls, no web crawling).
 * Real feeds replace fixture loaders in a later sprint — the agent interface is unchanged.
 */

import type { ExternalRiskSignal } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Agent context — what the orchestrator passes to each agent
// ---------------------------------------------------------------------------

export interface AgentContext {
  /** Case being evaluated */
  case_id: string;
  /** Shipment identifier */
  shipment_id: string;
  /** Destination port name — used for relevance filtering */
  destination_port: string;
  /** Primary route description — used for route-level signal matching */
  route?: string;
  /** ISO date — used to filter signals outside the relevant time window */
  required_by: string;
  /** Optional vessel name for vessel-specific signal matching */
  vessel_name?: string;
}

// ---------------------------------------------------------------------------
// ExternalRiskAgent — the interface every agent must implement
// ---------------------------------------------------------------------------

/**
 * An ExternalRiskAgent loads structured intelligence from its source
 * (fixture file, mock feed, or future real feed) and returns only
 * validated ExternalRiskSignal objects relevant to the given context.
 *
 * Agents MUST NOT:
 *   - recommend scenarios
 *   - approve decisions
 *   - calculate financial impact
 *   - emit free-text recommendations
 */
export interface ExternalRiskAgent {
  /** Human-readable agent name for logging and audit */
  readonly name: string;
  /** Run the agent and return validated signals relevant to this context */
  run(context: AgentContext): Promise<ExternalRiskSignal[]>;
}

// ---------------------------------------------------------------------------
// Raw event shapes — what agents receive from fixtures / future feeds
// Each agent maps its own raw format to ExternalRiskSignal[].
// ---------------------------------------------------------------------------

/** Raw port event — from port authority feeds, news monitors, union bulletins */
export interface RawPortEvent {
  event_id: string;
  port_name: string;
  event_type: string;        // freeform — agent classifies to ExternalRiskSignalType
  description: string;
  reported_at: string;       // ISO datetime
  valid_from: string;        // ISO date
  valid_until?: string;      // ISO date — open-ended if absent
  confidence?: number;       // 0.0–1.0
  source?: string;
  estimated_impact_hours?: number;
}

/** Raw geopolitical event — from intelligence briefs, government advisories */
export interface RawGeopoliticalEvent {
  event_id: string;
  region: string;
  route?: string;
  event_type: string;
  description: string;
  reported_at: string;
  valid_from: string;
  valid_until?: string;
  confidence?: number;
  source?: string;
  severity_hint?: string;    // 'low' | 'medium' | 'high' | 'critical' — agent normalises
}

/**
 * RawWeatherEvent is defined in agents/weather-context.ts alongside its
 * classification logic. Re-exported from index.ts for downstream consumers.
 */

/** Raw supplier event — from ERP alerts, supplier bulletins, logistics reports */
export interface RawSupplierEvent {
  event_id: string;
  supplier_name: string;
  location: string;
  event_type: string;
  description: string;
  reported_at: string;
  valid_from: string;
  valid_until?: string;
  confidence?: number;
  source?: string;
  affected_routes?: string[];
}
