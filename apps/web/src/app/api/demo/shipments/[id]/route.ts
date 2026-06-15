/**
 * GET /api/demo/shipments/:id
 *
 * Returns the Shipment Workspace view (Screen 3) for the demo case.
 * Includes shipment context, alert summary, and disruption signals.
 * All data derived from the canonical decision-engine-output.json.
 *
 * Params:
 *   id — shipment ID, must match "SH-2024-0042" in demo mode
 *
 * Response shape: DemoShipmentResponse
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
        { error: `Shipment '${id}' not found in demo data. Expected: ${engine.meta.case_id}` },
        { status: 404 }
      );
    }

    const { shipment_context, disruption_context, prediction_signals, business_context } = engine;

    const response = {
      schema_version: engine.meta.schema_version,
      case_id: engine.meta.case_id,
      shipment_id: shipment_context.shipment_id,
      shipment_name: shipment_context.shipment_name,
      material: shipment_context.material,
      origin: shipment_context.origin,
      vessel: shipment_context.vessel,
      route: shipment_context.route,
      schedule: shipment_context.schedule,
      production_context: shipment_context.production_context,
      alert: {
        alert_id: disruption_context.alert_id,
        alert_type: disruption_context.alert_type,
        severity: disruption_context.severity,
        detected_at: disruption_context.detected_at,
        summary: disruption_context.summary,
        risk_signals: disruption_context.risk_signals,
      },
      prediction: {
        model_version: prediction_signals.model_version,
        generated_at: prediction_signals.generated_at,
        delay_probability: prediction_signals.delay_probability,
        confidence_score: prediction_signals.confidence_score,
        eta_scenarios: prediction_signals.eta_scenarios,
        risk_drivers: prediction_signals.risk_drivers,
      },
      business_context: {
        critical_material_flag: business_context.critical_material_flag,
        contract_type: business_context.contract_type,
        customer: business_context.customer,
        relationship_tier: business_context.relationship_tier,
        production_stop_risk: business_context.production_stop_risk,
        production_stop_date_if_no_action: business_context.production_stop_date_if_no_action,
        inventory_covers_days: business_context.inventory_covers_days,
      },
      lifecycle_state: engine.graph_structures.decision_lifecycle_graph.current_state,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[GET /api/demo/shipments/:id]', err);
    return NextResponse.json({ error: 'Failed to load demo shipment data.' }, { status: 500 });
  }
}
