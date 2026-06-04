/**
 * WeatherContextAgent — DenkKern
 *
 * Classifies raw weather events (storm, fog, high wind, high swell,
 * visibility disruption) into ExternalRiskSignal objects.
 *
 * Output contract:
 *   signal_type is always 'WEATHER_CONTEXT'.
 *   Agents never predict ETA. Agents never recommend scenarios.
 *   Severity and engine effect are derived from raw event attributes only.
 *
 * LLM boundary: simulates what a marine weather LLM extraction layer would
 * produce from WMO/DWD/ECMWF feeds and port authority advisories.
 * For MVP: fixture-backed. Replace loadWeatherEvents() when real feed is ready.
 *
 * Classification rules (deterministic):
 *   storm / gale               → severity based on wind_speed_kt or severity_hint
 *   fog / visibility_disruption→ severity based on visibility_nm
 *   high_wind                  → severity based on wind_speed_kt
 *   high_swell                 → severity based on wave_height_m
 *   Fallback severity          → severity_hint → impact hours → LOW
 */

import type {
  ExternalRiskSignal,
  ExternalRiskSeverity,
  ExternalRiskEngineEffect,
} from '@denkkern/types';
import type { ExternalRiskAgent, AgentContext } from '../types.js';
import { validateSignals } from '../validate.js';
import weatherEventsFixture from '../fixtures/weather-events.json' assert { type: 'json' };

// ---------------------------------------------------------------------------
// RawWeatherEvent — internal type for fixture / future feed
// ---------------------------------------------------------------------------

export interface RawWeatherEvent {
  event_id: string;
  region: string;
  /** Ports directly affected by this event (empty = route-level only) */
  affected_ports: string[];
  /** Route names this event applies to (optional) */
  routes?: string[];
  event_type: string;      // storm | fog | high_wind | high_swell | visibility_disruption
  description: string;
  reported_at: string;     // ISO datetime
  valid_from: string;      // ISO date
  valid_until?: string;    // ISO date — open-ended if absent
  confidence?: number;     // 0.0–1.0
  source?: string;
  estimated_impact_hours?: number;
  // Measured values — each optional; presence drives classification precision
  wind_speed_kt?: number | null;
  wave_height_m?: number | null;
  visibility_nm?: number | null;
  severity_hint?: string;  // 'low' | 'medium' | 'high' | 'critical' — agent normalises
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function classifySeverity(event: RawWeatherEvent): ExternalRiskSeverity {
  const { event_type, wind_speed_kt, wave_height_m, visibility_nm, severity_hint, estimated_impact_hours } = event;
  const t = event_type.toLowerCase();

  // Storm / gale — wind speed drives severity
  if (t === 'storm' || t === 'gale') {
    const ws = wind_speed_kt ?? 0;
    if (ws >= 64) return 'CRITICAL';  // Hurricane force
    if (ws >= 48) return 'HIGH';      // Violent storm / Beaufort 11
    if (ws >= 34) return 'HIGH';      // Gale / Beaufort 8+
    if (ws > 0)   return 'MEDIUM';
    // No wind speed — fall through to severity_hint
  }

  // High wind
  if (t === 'high_wind') {
    const ws = wind_speed_kt ?? 0;
    if (ws >= 48) return 'HIGH';
    if (ws >= 34) return 'MEDIUM';
    if (ws > 0)   return 'LOW';
  }

  // High swell — wave height drives severity
  if (t === 'high_swell') {
    const wh = wave_height_m ?? 0;
    if (wh >= 4.0) return 'HIGH';
    if (wh >= 2.5) return 'MEDIUM';
    if (wh > 0)    return 'LOW';
  }

  // Fog / visibility disruption — lower visibility = higher severity
  if (t === 'fog' || t === 'visibility_disruption') {
    const vis = visibility_nm ?? 99;
    if (vis <= 0.1) return 'HIGH';
    if (vis <= 0.3) return 'MEDIUM';
    return 'LOW';
  }

  // Fallback 1: severity_hint from fixture
  if (severity_hint != null) {
    const h = severity_hint.toLowerCase();
    if (h === 'critical') return 'CRITICAL';
    if (h === 'high')     return 'HIGH';
    if (h === 'medium')   return 'MEDIUM';
  }

  // Fallback 2: estimated impact hours
  const hours = estimated_impact_hours ?? 0;
  if (hours >= 24) return 'HIGH';
  if (hours >= 8)  return 'MEDIUM';
  return 'LOW';
}

function classifyEngineEffect(
  severity: ExternalRiskSeverity,
  event_type: string
): ExternalRiskEngineEffect {
  if (severity === 'CRITICAL') return 'flag_second_approval';
  if (severity === 'HIGH')     return 'increase_wait_risk';
  // Storm at MEDIUM still boosts wait risk
  if (event_type.toLowerCase() === 'storm' && severity === 'MEDIUM') {
    return 'increase_wait_risk';
  }
  return 'increase_urgency';
}

function buildDecisionRelevance(
  event: RawWeatherEvent,
  _severity: ExternalRiskSeverity,
  context: AgentContext
): string {
  const t = event.event_type.toLowerCase();
  const loc = event.affected_ports.length > 0
    ? event.affected_ports.join(', ')
    : event.region;

  if (t === 'storm' || t === 'gale') {
    return (
      `Storm conditions at ${loc} may delay berth access or pilot boarding for the inbound vessel. ` +
      `If the vessel arrives during this window, port operations may be suspended — ` +
      `the WAIT scenario carries higher weather-delay exposure for case ${context.case_id}.`
    );
  }
  if (t === 'fog' || t === 'visibility_disruption') {
    return (
      `Reduced visibility at ${loc} will suspend convoy movements and slow inbound pilotage. ` +
      `Even an on-time vessel may queue at anchor before the Elbe/port entry is cleared.`
    );
  }
  if (t === 'high_wind') {
    return (
      `High wind conditions at ${loc} are reducing crane and berth capacity. ` +
      `Discharge operations will be slower even after berthing — factor into scenario timing.`
    );
  }
  if (t === 'high_swell') {
    return (
      `Heavy swell at ${loc} is suspending pilot boarding and may slow inbound transit. ` +
      `Vessel arrival could be delayed beyond the forecast ETA.`
    );
  }
  // visibility_disruption / generic
  return (
    `Weather disruption at ${loc} may extend vessel arrival or port handling time. ` +
    `Relevant for scenario ${context.case_id} given required_by date ${context.required_by}.`
  );
}

// ---------------------------------------------------------------------------
// Relevance filter
// ---------------------------------------------------------------------------

function isRelevantToContext(event: RawWeatherEvent, context: AgentContext): boolean {
  const dest = context.destination_port.toLowerCase();
  const route = context.route?.toLowerCase() ?? '';

  // Match on destination port
  const portMatch = event.affected_ports.some(
    (p) => p.toLowerCase() === dest
  );
  if (portMatch) return true;

  // Match on route
  const routeMatch = (event.routes ?? []).some(
    (r) => route.includes(r.toLowerCase()) || r.toLowerCase().includes(route)
  );
  if (routeMatch) return true;

  // Match region substring against destination port or route
  const regionLower = event.region.toLowerCase();
  if (regionLower.includes(dest)) return true;
  if (route.length > 0 && regionLower.includes(route)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// WeatherContextAgent
// ---------------------------------------------------------------------------

export class WeatherContextAgent implements ExternalRiskAgent {
  readonly name = 'WeatherContextAgent';

  private readonly events: RawWeatherEvent[];

  constructor(events: RawWeatherEvent[] = weatherEventsFixture as RawWeatherEvent[]) {
    this.events = events;
  }

  async run(context: AgentContext): Promise<ExternalRiskSignal[]> {
    const relevant = this.events.filter((e) => isRelevantToContext(e, context));

    const candidates = relevant.map((event): unknown => {
      const severity      = classifySeverity(event);
      const engineEffect  = classifyEngineEffect(severity, event.event_type);
      const delayDays     = event.estimated_impact_hours != null
        ? Math.ceil(event.estimated_impact_hours / 24)
        : undefined;

      return {
        signal_id:   `WX-${event.event_id}`,
        signal_type: 'WEATHER_CONTEXT' as const,
        severity,
        confidence:  event.confidence ?? 0.6,
        source_type: 'simulated' as const,
        source_name: event.source ?? 'weather-context-agent/fixture',
        location:    event.affected_ports.length > 0
          ? event.affected_ports.join(', ')
          : event.region,
        time_window: {
          valid_from:  event.valid_from,
          ...(event.valid_until != null ? { valid_until: event.valid_until } : {}),
        },
        description:               event.description,
        decision_relevance:        buildDecisionRelevance(event, severity, context),
        recommended_engine_effect: engineEffect,
        ...(delayDays != null ? { estimated_additional_delay_days: delayDays } : {}),
      };
    });

    const { valid, rejected } = validateSignals(candidates);

    if (rejected.length > 0) {
      console.warn(
        `[WeatherContextAgent] ${rejected.length} signal(s) rejected by validator:`,
        rejected.map((r) => r.reason)
      );
    }

    return valid;
  }
}
