/**
 * Disruption context contracts — DenkKern
 *
 * Source of truth: docs/architecture/06-data-contracts.md §4
 * Owner: Orchestration layer
 *
 * IMMUTABILITY RULE: Snapshotted at `context_confirmed`. Snapshot flows into
 * the scenario engine and audit. Immutable from that point.
 */

import type { PredictionOutput } from './prediction.js';
import type { ShipmentContext } from './shipment.js';
import type { ExternalRiskSignal } from './external-risk.js';

export type SignalSeverity = 'low' | 'medium' | 'high';
export type SignalSource = 'real' | 'simulated';

export interface WeatherSignal {
  route_id: string;
  severity: SignalSeverity;
  description: string;
  estimated_delay_impact_days: number;
  source: SignalSource;
}

export interface NewsSignal {
  region_id: string;
  event_type: string;               // e.g. "strike_risk"
  severity: SignalSeverity;
  description: string;
  estimated_delay_impact_days: number;
  source: SignalSource;
}

export interface DisruptionContext {
  case_id: string;
  shipment_id: string;
  assembled_at: string;             // ISO 8601

  prediction: PredictionOutput;     // Immutable — as received from James
  shipment_context: ShipmentContext;

  // Environmental signals — optional (absent if adapters unavailable)
  weather_signal?: WeatherSignal;
  news_signals?: NewsSignal[];

  // External risk intelligence signals — optional (mock/fixture for MVP)
  // LLM extracted / operator entered / fixture. Never directly modifies scores;
  // passed into ScenarioEngineInput.external_risk_signals by the orchestrator.
  external_risk_signals?: ExternalRiskSignal[];
}
