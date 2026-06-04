/**
 * PortIntelligenceAgent — DenkKern
 *
 * Classifies raw port events (strikes, closures, congestion, restrictions)
 * into ExternalRiskSignal objects.
 *
 * LLM boundary: this agent simulates what an LLM extraction layer would do
 * from port authority feeds and news sources. For MVP it uses JSON fixtures.
 * Replace the fixture loader with a real feed adapter when ready.
 *
 * Agents NEVER recommend scenarios. Agents NEVER approve decisions.
 */

import type { ExternalRiskSignal, ExternalRiskSignalType, ExternalRiskSeverity } from '@denkkern/types';
import type { ExternalRiskAgent, AgentContext, RawPortEvent } from '../types.js';
import { validateSignals } from '../validate.js';
import portEventsFixture from '../fixtures/port-events.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function classifyEventType(eventType: string): ExternalRiskSignalType {
  const t = eventType.toLowerCase();
  if (t.includes('strike'))      return 'PORT_STRIKE';
  if (t.includes('closure') || t.includes('closed')) return 'PORT_CLOSURE';
  if (t.includes('restriction') || t.includes('dredg') || t.includes('maintenance')) return 'PORT_RESTRICTION';
  if (t.includes('congestion') || t.includes('delay') || t.includes('wait')) return 'PORT_RESTRICTION';
  return 'PORT_RESTRICTION';
}

function classifySeverity(event: RawPortEvent): ExternalRiskSeverity {
  const hours = event.estimated_impact_hours ?? 0;
  const conf  = event.confidence ?? 0.5;

  if (event.event_type.toLowerCase().includes('strike') && conf >= 0.8) return 'HIGH';
  if (event.event_type.toLowerCase().includes('closure')) return 'HIGH';
  if (hours >= 24) return 'HIGH';
  if (hours >= 8)  return 'MEDIUM';
  if (hours > 0)   return 'LOW';
  return 'LOW';
}

function decisionRelevance(event: RawPortEvent, context: AgentContext): string {
  const signalType = classifyEventType(event.event_type);
  if (signalType === 'PORT_STRIKE') {
    return (
      `A strike at ${event.port_name} may prevent the shipment from berthing on schedule. ` +
      `If the original vessel arrives during the strike window, waiting increases production exposure.`
    );
  }
  if (signalType === 'PORT_CLOSURE') {
    return (
      `Partial closure at ${event.port_name} reduces berth availability. ` +
      `Consider rerouting through an unaffected port before committing to the WAIT scenario.`
    );
  }
  return (
    `Operational disruption at ${event.port_name} may extend arrival time. ` +
    `Factor into scenario selection for case ${context.case_id}.`
  );
}

// ---------------------------------------------------------------------------
// Relevance filter — only return signals relevant to this context
// ---------------------------------------------------------------------------

function isRelevant(event: RawPortEvent, context: AgentContext): boolean {
  const dest = context.destination_port.toLowerCase();
  const port = event.port_name.toLowerCase();
  // Direct match on destination port, or match on any port along the route
  return port === dest || (context.route?.toLowerCase().includes(port) ?? false);
}

// ---------------------------------------------------------------------------
// PortIntelligenceAgent
// ---------------------------------------------------------------------------

export class PortIntelligenceAgent implements ExternalRiskAgent {
  readonly name = 'PortIntelligenceAgent';

  private readonly events: RawPortEvent[];

  constructor(events: RawPortEvent[] = portEventsFixture as RawPortEvent[]) {
    this.events = events;
  }

  async run(context: AgentContext): Promise<ExternalRiskSignal[]> {
    const relevant = this.events.filter((e) => isRelevant(e, context));

    const candidates = relevant.map((event): unknown => {
      const signalType  = classifyEventType(event.event_type);
      const severity    = classifySeverity(event);
      const delayDays   = event.estimated_impact_hours != null
        ? Math.ceil(event.estimated_impact_hours / 24)
        : undefined;

      return {
        signal_id:   `PORT-${event.event_id}`,
        signal_type: signalType,
        severity,
        confidence:  event.confidence ?? 0.5,
        source_type: 'simulated' as const,
        source_name: event.source ?? 'port-intelligence-agent/fixture',
        location:    event.port_name,
        time_window: {
          valid_from:   event.valid_from,
          ...(event.valid_until != null ? { valid_until: event.valid_until } : {}),
        },
        description:         event.description,
        decision_relevance:  decisionRelevance(event, context),
        recommended_engine_effect:
          severity === 'HIGH' || severity === 'CRITICAL'
            ? (signalType === 'PORT_STRIKE' ? 'increase_wait_risk' : 'flag_second_approval')
            : 'increase_urgency',
        ...(delayDays != null ? { estimated_additional_delay_days: delayDays } : {}),
      };
    });

    const { valid, rejected } = validateSignals(candidates);

    if (rejected.length > 0) {
      console.warn(
        `[PortIntelligenceAgent] ${rejected.length} signal(s) rejected by validator:`,
        rejected.map((r) => r.reason)
      );
    }

    return valid;
  }
}
