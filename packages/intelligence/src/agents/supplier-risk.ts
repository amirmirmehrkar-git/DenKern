/**
 * SupplierRiskAgent — DenkKern
 *
 * Classifies raw supplier disruption events (factory closures, capacity reductions,
 * dispatch delays) into ExternalRiskSignal objects.
 *
 * LLM boundary: For MVP this agent uses JSON fixtures.
 * Replace the fixture loader with a real ERP/supplier feed adapter when ready.
 *
 * Agents NEVER recommend scenarios. Agents NEVER approve decisions.
 */

import type { ExternalRiskSignal, ExternalRiskSeverity } from '@denkkern/types';
import type { ExternalRiskAgent, AgentContext, RawSupplierEvent } from '../types.js';
import { validateSignals } from '../validate.js';
import supplierEventsFixture from '../fixtures/supplier-events.json' assert { type: 'json' };

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function classifySeverity(event: RawSupplierEvent): ExternalRiskSeverity {
  const t = event.event_type.toLowerCase();
  const desc = event.description.toLowerCase();

  // Factory closure or total halt → HIGH
  if (t.includes('closure') || desc.includes('halted') || desc.includes('fully closed')) return 'HIGH';
  // Significant capacity reduction → MEDIUM
  if (desc.includes('30%') || desc.includes('50%') || desc.includes('reduction')) return 'MEDIUM';
  // Dispatch delay → LOW
  if (t.includes('delay') || desc.includes('delay')) return 'LOW';

  return 'LOW';
}

function decisionRelevance(event: RawSupplierEvent, context: AgentContext): string {
  return (
    `Supplier disruption at ${event.supplier_name} (${event.location}) may affect ` +
    `availability of replacement parts for case ${context.case_id}. ` +
    `If the REPLACE scenario depends on this supplier, validate availability before approval.`
  );
}

// ---------------------------------------------------------------------------
// Relevance filter — only supplier events that affect the destination region
// ---------------------------------------------------------------------------

function isRelevant(event: RawSupplierEvent, context: AgentContext): boolean {
  if (event.affected_routes == null || event.affected_routes.length === 0) {
    // Broad disruption — always include
    return true;
  }
  const dest = context.destination_port.toLowerCase();
  return event.affected_routes.some((r) => r.toLowerCase().includes(dest));
}

// ---------------------------------------------------------------------------
// SupplierRiskAgent
// ---------------------------------------------------------------------------

export class SupplierRiskAgent implements ExternalRiskAgent {
  readonly name = 'SupplierRiskAgent';

  private readonly events: RawSupplierEvent[];

  constructor(events: RawSupplierEvent[] = supplierEventsFixture as RawSupplierEvent[]) {
    this.events = events;
  }

  async run(context: AgentContext): Promise<ExternalRiskSignal[]> {
    const relevant = this.events.filter((e) => isRelevant(e, context));

    const candidates = relevant.map((event): unknown => {
      const severity = classifySeverity(event);

      return {
        signal_id:   `SUP-${event.event_id}`,
        signal_type: 'SUPPLIER_DISRUPTION' as const,
        severity,
        confidence:  event.confidence ?? 0.5,
        source_type: 'simulated' as const,
        source_name: event.source ?? 'supplier-risk-agent/fixture',
        location:    event.location,
        time_window: {
          valid_from:   event.valid_from,
          ...(event.valid_until != null ? { valid_until: event.valid_until } : {}),
        },
        description:        event.description,
        decision_relevance: decisionRelevance(event, context),
        recommended_engine_effect:
          severity === 'HIGH' || severity === 'CRITICAL'
            ? 'flag_second_approval'
            : 'increase_urgency',
      };
    });

    const { valid, rejected } = validateSignals(candidates);

    if (rejected.length > 0) {
      console.warn(
        `[SupplierRiskAgent] ${rejected.length} signal(s) rejected:`,
        rejected.map((r) => r.reason)
      );
    }

    return valid;
  }
}
