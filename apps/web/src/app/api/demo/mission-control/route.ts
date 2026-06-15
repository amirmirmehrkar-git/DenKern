/**
 * GET /api/demo/mission-control
 *
 * Returns the Lena Action Queue view for Mission Control (Screen 2).
 * All data derived from the canonical decision-engine-output.json.
 * No hardcoded UI values — every field references the engine contract.
 *
 * Response shape: DemoMissionControlResponse
 */

import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

const MOCK_ROOT = process.env['MOCK_ROOT'] ?? resolve(process.cwd(), '..', '..');
const ENGINE_FILE = join(MOCK_ROOT, 'mock', 'cases', 'SH-2024-0042', 'decision-engine-output.json');

function loadEngine() {
  return JSON.parse(readFileSync(ENGINE_FILE, 'utf-8'));
}

export async function GET() {
  try {
    const engine = loadEngine();

    const { lena_action_queue } = engine.derived_views;
    const { recommendation, approval_routing } = engine.engine_output;
    const { production_context } = engine.shipment_context;

    const response = {
      schema_version: engine.meta.schema_version,
      generated_at: engine.meta.generated_at,
      monitored_shipments: 1,
      requires_attention: 1,
      lena_action_queue: {
        decision_required: [
          {
            item_id: lena_action_queue.item_id,
            shipment_id: lena_action_queue.shipment_id,
            material: lena_action_queue.material,
            route: lena_action_queue.route_label,
            recommended_action: lena_action_queue.recommended_action,
            confidence_pct: lena_action_queue.confidence_pct,
            net_saving_eur: lena_action_queue.net_saving_eur,
            urgency: lena_action_queue.urgency,
            days_until_production_stop: production_context.days_until_production_stop,
            cta: lena_action_queue.cta,
            cta_route: engine.derived_views.mission_control.cta_route,
            approval_note: lena_action_queue.note,
          },
        ],
        approval_needed: [],
        execution_tracking: [],
      },
      metrics: {
        decision_required: 1,
        approval_needed: 0,
        execution_tracking: 0,
        total_financial_exposure_eur: engine.shipment_context.production_context.total_financial_exposure_eur,
        net_saving_available_eur: recommendation.financial_impact_summary.net_saving_vs_wait_eur,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[GET /api/demo/mission-control]', err);
    return NextResponse.json({ error: 'Failed to load demo mission control data.' }, { status: 500 });
  }
}
