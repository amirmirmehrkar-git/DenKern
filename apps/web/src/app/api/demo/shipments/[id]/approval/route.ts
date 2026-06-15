/**
 * GET /api/demo/shipments/:id/approval
 *
 * Returns the Approval screen data (Screen 7).
 * Includes approval routing, approver details, deadline, and context
 * needed to render the approval request to Mark Hoffmann (VP Operations).
 *
 * All data derived from the canonical decision-engine-output.json.
 * The approval_routing object is derived from ORG-R-003 + cost vs threshold.
 * This endpoint never hardcodes approver names or thresholds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const MOCK_ROOT = process.env['MOCK_ROOT'] ?? resolve(process.cwd(), '..', '..');
const ENGINE_FILE = join(MOCK_ROOT, 'mock', 'cases', 'SH-2024-0042', 'decision-engine-output.json');

function loadEngine() {
  return JSON.parse(readFileSync(ENGINE_FILE, 'utf-8'));
}

interface RouteParams {
  params: { id: string };
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = params;

  try {
    const engine = loadEngine();

    if (id !== engine.meta.case_id) {
      return NextResponse.json(
        { error: `Case '${id}' not found in demo data.` },
        { status: 404 }
      );
    }

    const { approval_routing, recommendation } = engine.engine_output;
    const action = engine.actions.find(
      (a: { action_id: string }) => a.action_id === recommendation.action_id
    );

    const response = {
      schema_version: engine.meta.schema_version,
      case_id: engine.meta.case_id,
      approval_routing,
      recommended_action: {
        action_id: action.action_id,
        label: action.label,
        description: action.description,
        cost_eur: action.cost_eur,
        cost_breakdown: action.cost_breakdown,
        estimated_arrival: action.estimated_arrival,
        delivery_confidence: action.delivery_confidence,
        booking_deadline: action.booking_deadline,
        feasibility: action.feasibility,
      },
      decision_context: {
        case_id: engine.meta.case_id,
        material: engine.shipment_context.material.name,
        days_until_production_stop: engine.shipment_context.production_context.days_until_production_stop,
        total_financial_exposure_eur: engine.shipment_context.production_context.total_financial_exposure_eur,
        net_saving_eur: recommendation.financial_impact_summary.net_saving_vs_wait_eur,
        confidence_pct: Math.round(recommendation.confidence * 100),
        rules_triggered: engine.engine_output.rules_triggered
          .filter((r: { triggered: boolean }) => r.triggered)
          .map((r: { rule_id: string; label: string; effect: string }) => ({
            rule_id: r.rule_id,
            label: r.label,
            effect: r.effect,
          })),
      },
      approval_status: approval_routing.approval_status,
      approved_at: approval_routing.approved_at,
      approved_by: approval_routing.approved_by,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[GET /api/demo/shipments/:id/approval]', err);
    return NextResponse.json({ error: 'Failed to load approval data.' }, { status: 500 });
  }
}
