/**
 * GET /api/demo/shipments/:id/outcome
 *
 * Returns the Outcome Review screen data (Screen 9).
 * Includes projected outcome, mock actual outcome, and comparison.
 *
 * All data derived from the canonical decision-engine-output.json.
 * The mock_actual_outcome is pre-seeded for demo purposes only —
 * in production this would be written by the execution tracking system.
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

    const { projected_outcome, mock_actual_outcome, recommendation } = engine.engine_output;
    const action = engine.actions.find(
      (a: { action_id: string }) => a.action_id === recommendation.action_id
    );

    const response = {
      schema_version: engine.meta.schema_version,
      case_id: engine.meta.case_id,
      action_executed: {
        action_id: action.action_id,
        label: action.label,
        cost_eur: action.cost_eur,
      },
      projected_outcome,
      actual_outcome: mock_actual_outcome,
      comparison: {
        projected_cost_eur: projected_outcome.cost_action_eur,
        actual_cost_eur: mock_actual_outcome.actual_cost_eur,
        cost_variance_eur: mock_actual_outcome.cost_vs_projection_eur,
        cost_variance_reason: mock_actual_outcome.cost_variance_reason,
        projected_production_stop: !projected_outcome.production_stop_averted,
        actual_production_stop: mock_actual_outcome.production_stopped,
        net_saving_delivered_eur: projected_outcome.net_benefit_eur,
        customer_commitment_met: mock_actual_outcome.customer_commitment_met,
      },
      outcome_label: mock_actual_outcome.outcome_label,
      lessons_learned: mock_actual_outcome.lessons_learned,
      lifecycle_completed: mock_actual_outcome.execution_status === 'completed',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[GET /api/demo/shipments/:id/outcome]', err);
    return NextResponse.json({ error: 'Failed to load outcome data.' }, { status: 500 });
  }
}
