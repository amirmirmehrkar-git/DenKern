/**
 * GeopoliticalRiskAgent — DenkKern
 *
 * Classifies raw geopolitical intelligence events (war risk, sanctions,
 * maritime security warnings, government restrictions) into ExternalRiskSignal objects.
 *
 * LLM boundary: For MVP this agent uses JSON fixtures.
 * Replace the fixture loader with a real intelligence feed adapter when ready.
 *
 * Agents NEVER recommend scenarios. Agents NEVER approve decisions.
 *
 * P0-3 fix — direct vs global-scope engine effect:
 *   WAR_RISK / CRITICAL events only trigger flag_second_approval when the
 *   event directly overlaps the shipment route or destination port.
 *   Global compliance signals (e.g. Red Sea war risk for a Hamburg-bound vessel)
 *   are still surfaced but assigned increase_urgency — they should not auto-trigger
 *   supervisor approval for a case with no route overlap.
 */

import type { ExternalRiskSignal, ExternalRiskSignalType, ExternalRiskSeverity } from '@denkkern/types';
import type { ExternalRiskAgent, AgentContext, RawGeopoliticalEvent } from '../types.js';
import { validateSignals } from '../validate.js';
import geoEventsFixture from '../fixtures/geopolitical-events.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function classifyEventType(eventType: string): ExternalRiskSignalType {
  const t = eventType.toLowerCase();
  if (t.includes('war') || t.includes('attack') || t.includes('conflict')) return 'WAR_RISK';
  if (t.includes('sanction'))                                               return 'SANCTIONS';
  if (t.includes('government') || t.includes('restriction') || t.includes('regulation')) return 'GOVERNMENT_RESTRICTION';
  if (t.includes('maritime') || t.includes('security') || t.includes('advisory'))        return 'MARITIME_SECURITY_WARNING';
  return 'GEOPOLITICAL_RISK';
}

function normaliseSeverity(hint?: string): ExternalRiskSeverity {
  switch (hint?.toLowerCase()) {
    case 'critical': return 'CRITICAL';
    case 'high':     return 'HIGH';
    case 'medium':   return 'MEDIUM';
    case 'low':      return 'LOW';
    default:         return 'MEDIUM';
  }
}

/**
 * True when the geopolitical event's region or route has a direct overlap with
 * the shipment's destination port or route.
 *
 * Used to distinguish operational risk (direct match → may trigger second approval)
 * from global compliance signals (no match → increase_urgency only).
 */
function isDirectOperationalMatch(event: RawGeopoliticalEvent, context: AgentContext): boolean {
  const dest     = context.destination_port.toLowerCase();
  const route    = (context.route ?? '').toLowerCase();
  const region   = event.region.toLowerCase();
  const evtRoute = (event.route ?? '').toLowerCase();

  // Destination overlap
  if (region.includes(dest) || evtRoute.includes(dest)) return true;

  // Route segment overlap — bidirectional substring, split on '/' and '—'
  if (route !== '') {
    const regionParts  = region.split(/[/—]/).map((s) => s.trim()).filter(Boolean);
    const evtRouteParts = evtRoute.split(/[/—]/).map((s) => s.trim()).filter(Boolean);
    if (regionParts.some((r)   => route.includes(r)))   return true;
    if (evtRouteParts.some((r) => route.includes(r)))   return true;
  }

  return false;
}

function decisionRelevance(
  event: RawGeopoliticalEvent,
  signalType: ExternalRiskSignalType,
  context: AgentContext,
  directMatch: boolean,
): string {
  if (signalType === 'WAR_RISK') {
    if (directMatch) {
      return (
        `Active conflict zone advisory covering ${event.route ?? event.region}. ` +
        `Vessels transiting this route face elevated insurance and diversion risk. ` +
        `The WAIT scenario is materially affected — supervisor review required.`
      );
    }
    // Global compliance signal — no direct route overlap
    return (
      `Global conflict zone advisory (${event.route ?? event.region}). ` +
      `Included for compliance awareness — no direct route overlap with this shipment. ` +
      `Verify cargo and vessel eligibility under current war-risk insurance and sanctions rules ` +
      `before committing to any scenario.`
    );
  }
  if (signalType === 'MARITIME_SECURITY_WARNING') {
    return (
      `Maritime security or severe weather advisory for ${event.route ?? event.region}. ` +
      `This may extend transit time beyond the model prediction. ` +
      `Supervisor review recommended for case ${context.case_id}.`
    );
  }
  if (signalType === 'SANCTIONS') {
    return (
      `Active sanctions regime may affect vessel or cargo eligibility at ${context.destination_port}. ` +
      `Verify compliance before committing to any scenario.`
    );
  }
  return (
    `Geopolitical event in ${event.region} may indirectly affect routing or port access. ` +
    `Monitor for escalation.`
  );
}

// ---------------------------------------------------------------------------
// Relevance filter
// ---------------------------------------------------------------------------

function isRelevant(event: RawGeopoliticalEvent, context: AgentContext): boolean {
  // A geopolitical event is relevant if its region or route overlaps with the
  // destination port or the shipment route.
  const dest  = context.destination_port.toLowerCase();
  const route = (context.route ?? '').toLowerCase();

  const region    = event.region.toLowerCase();
  const evtRoute  = (event.route ?? '').toLowerCase();

  // Direct destination match
  if (region.includes(dest) || evtRoute.includes(dest)) return true;
  // Route overlap
  if (route !== '' && (region.split('/').some((r) => route.includes(r.trim())) || evtRoute.includes(route))) return true;
  // Global-scope events (sanctions, war risk) are always relevant for compliance
  const signalType = classifyEventType(event.event_type);
  if (signalType === 'WAR_RISK' || signalType === 'SANCTIONS') return true;

  return false;
}

// ---------------------------------------------------------------------------
// GeopoliticalRiskAgent
// ---------------------------------------------------------------------------

export class GeopoliticalRiskAgent implements ExternalRiskAgent {
  readonly name = 'GeopoliticalRiskAgent';

  private readonly events: RawGeopoliticalEvent[];

  constructor(events: RawGeopoliticalEvent[] = geoEventsFixture as RawGeopoliticalEvent[]) {
    this.events = events;
  }

  async run(context: AgentContext): Promise<ExternalRiskSignal[]> {
    const relevant = this.events.filter((e) => isRelevant(e, context));

    const candidates = relevant.map((event): unknown => {
      const signalType  = classifyEventType(event.event_type);
      const severity    = normaliseSeverity(event.severity_hint);
      const directMatch = isDirectOperationalMatch(event, context);

      // Engine effect:
      //   flag_second_approval — CRITICAL or WAR_RISK that directly overlaps shipment route.
      //   increase_wait_risk   — HIGH direct-match events.
      //   increase_urgency     — Global compliance signals (no route overlap) and all lower-severity events.
      //
      // P0-3: WAR_RISK that does not overlap the shipment route (e.g. Red Sea for Hamburg-bound
      // vessel on Bay of Biscay — North Sea route) uses increase_urgency, not flag_second_approval.
      const recommended_engine_effect =
        (severity === 'CRITICAL' || signalType === 'WAR_RISK') && directMatch
          ? 'flag_second_approval'
          : severity === 'HIGH' && directMatch
            ? 'increase_wait_risk'
            : 'increase_urgency';

      return {
        signal_id:   `GEO-${event.event_id}`,
        signal_type: signalType,
        severity,
        confidence:  event.confidence ?? 0.5,
        source_type: 'simulated' as const,
        source_name: event.source ?? 'geopolitical-risk-agent/fixture',
        ...(event.route != null ? { route: event.route } : { location: event.region }),
        time_window: {
          valid_from:   event.valid_from,
          ...(event.valid_until != null ? { valid_until: event.valid_until } : {}),
        },
        description:        event.description,
        decision_relevance: decisionRelevance(event, signalType, context, directMatch),
        recommended_engine_effect,
      };
    });

    const { valid, rejected } = validateSignals(candidates);

    if (rejected.length > 0) {
      console.warn(
        `[GeopoliticalRiskAgent] ${rejected.length} signal(s) rejected:`,
        rejected.map((r) => r.reason)
      );
    }

    return valid;
  }
}
