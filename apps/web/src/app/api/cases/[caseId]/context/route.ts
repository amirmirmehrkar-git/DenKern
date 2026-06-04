/**
 * GET /api/cases/:caseId/context
 *
 * Returns the assembled DisruptionContext for a case, enriched with
 * live fixture-backed external risk signals from @denkkern/intelligence.
 *
 * Signal enrichment flow (server-side, every request):
 *   1. Load base DisruptionContext from the mock adapter (includes any static
 *      external_risk_signals already embedded in disruption-context.json).
 *   2. Build AgentContext from the loaded context fields.
 *   3. Run AgentRunner.run(agentContext) — dispatches all registered agents in
 *      parallel via the Agent Platform (AgentRegistry + AgentAuditTrail).
 *      Fixture-backed only for MVP; no real web calls, no LLM calls.
 *   4. Merge agent output with existing static signals.
 *   5. Deduplicate by (signal_type, location??route) — static signals
 *      take precedence (case-specific overrides survive).
 *   6. Return enriched DisruptionContext to the client.
 *
 * LLM boundary (enforced):
 *   Agents produce ExternalRiskSignal[] only — no scenarios, no approvals.
 *   Scenario Engine is never touched here; it receives the merged list later
 *   when the operator triggers scenario generation.
 *
 * Error policy:
 *   Agent failures are isolated inside collectExternalRiskSignals() and never
 *   surface as a 500 here. If intelligence collection fails entirely, the base
 *   context (with static signals) is returned unchanged.
 *
 * Error responses:
 *   404 — caseId not found or context not yet assembled
 *   500 — unexpected error reading base context
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../../../lib/adapters/index.js';
import { getAgentRunner } from '../../../../../lib/intelligence/agent-platform-singleton.js';
import type { DisruptionContext, ExternalRiskSignal } from '@denkkern/types';
import type { AgentContext } from '@denkkern/intelligence';

interface RouteParams {
  params: { caseId: string };
}

// ---------------------------------------------------------------------------
// Deduplication key — matches on signal_type + geographic identity.
//
// P0-2 fix: source_name is NOT part of the key.
//   Old key: (signal_type, location, source_name) — different sources for the
//   same real-world event produced separate cards in the UI.
//   New key: (signal_type, location ?? route) — same event collapses to one card
//   regardless of whether it came from a static fixture or an agent.
//   Static signals still win on collision: they are written last in mergeSignals().
// ---------------------------------------------------------------------------

function deduplicationKey(s: ExternalRiskSignal): string {
  return [
    s.signal_type,
    (s.location ?? s.route ?? '').toLowerCase().trim(),
  ].join('::');
}

function mergeSignals(
  agentSignals: ExternalRiskSignal[],
  staticSignals: ExternalRiskSignal[],
): ExternalRiskSignal[] {
  const map = new Map<string, ExternalRiskSignal>();

  // Agent signals first — may be overwritten by static
  for (const s of agentSignals) {
    map.set(deduplicationKey(s), s);
  }
  // Static signals last — they win on key collision
  for (const s of staticSignals) {
    map.set(deduplicationKey(s), s);
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<DisruptionContext | { error: string }>> {
  const { caseId } = params;

  // ── 1. Load base context ──────────────────────────────────────────────────
  let baseContext: DisruptionContext;
  try {
    const adapter = getAdapter();
    baseContext = await adapter.getDisruptionContext(caseId);
  } catch (err) {
    if (err instanceof Error && err.message.includes('ENOENT')) {
      return NextResponse.json(
        { error: `Disruption context for case '${caseId}' not found.` },
        { status: 404 }
      );
    }
    console.error('[GET /api/cases/:caseId/context] base context error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }

  // ── 2. Build AgentContext from loaded fields ───────────────────────────────
  const agentContext: AgentContext = {
    case_id:          caseId,
    shipment_id:      baseContext.shipment_id,
    destination_port: baseContext.shipment_context.destination,
    required_by:      baseContext.shipment_context.production_context.required_by,
    ...(baseContext.shipment_context.vessel_name != null
      ? { vessel_name: baseContext.shipment_context.vessel_name }
      : {}),
    // Sprint 4 H-3: wire route field so route-level risk signals (e.g. North Sea
    // route weather events) are included in agent relevance matching.
    // exactOptionalPropertyTypes: omit key when absent rather than assign undefined.
    ...(baseContext.shipment_context.route != null
      ? { route: baseContext.shipment_context.route }
      : {}),
  };

  // ── 3. Run intelligence agents via Agent Platform (fixture-backed, isolated failures) ──
  let agentSignals: ExternalRiskSignal[] = [];
  try {
    const runResult = await getAgentRunner().run(agentContext);
    agentSignals = runResult.signals;
  } catch (err) {
    // AgentRunner isolates individual agent failures via Promise.allSettled, so
    // this catch handles only catastrophic runner-level errors.
    // Degrade gracefully: return base context with static signals only.
    console.warn('[GET /api/cases/:caseId/context] intelligence collection failed:', err);
  }

  // ── 4 + 5. Merge + deduplicate ─────────────────────────────────────────────
  const staticSignals: ExternalRiskSignal[] = baseContext.external_risk_signals ?? [];
  const mergedSignals = mergeSignals(agentSignals, staticSignals);

  // ── 6. Return enriched context ────────────────────────────────────────────
  // exactOptionalPropertyTypes: cannot assign `undefined` to an optional field.
  // Use a conditional spread so the property is absent (not undefined) when empty.
  const signalsEntry = mergedSignals.length > 0
    ? { external_risk_signals: mergedSignals }
    : {};
  const enrichedContext: DisruptionContext = { ...baseContext, ...signalsEntry };

  return NextResponse.json(enrichedContext, { status: 200 });
}
