/**
 * GET /api/demo/shipments/:id/decision-engine
 *
 * Returns the full decision engine output for Scenario Analysis (Screen 5)
 * and Decision Room (Screen 6).
 *
 * This endpoint exposes the core decision engine contract:
 *   - scenarios[] (what may happen)
 *   - actions[] (what we can do)
 *   - engine_output.recommendation (what DenkKern suggests)
 *   - engine_output.score_breakdown (why)
 *   - engine_output.rules_triggered (which rules fired)
 *   - engine_output.explanation_trace (reasoning steps)
 *
 * Scenarios, actions, and recommendation are explicitly separated.
 * The recommendation is NOT a scenario and NOT an action — it is the
 * engine's ranked output from scoring all actions across all scenarios.
 *
 * All data derived from the canonical decision-engine-output.json.
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

    const response = {
      schema_version: engine.meta.schema_version,
      case_id: engine.meta.case_id,
      generated_at: engine.meta.generated_at,
      engine_version: engine.meta.engine_version,
      lena_configuration: {
        primary_objective: engine.lena_configuration.primary_objective,
        evaluation_weights: engine.lena_configuration.evaluation_weights,
        approval_threshold_eur: engine.lena_configuration.approval_threshold_eur,
        trigger_conditions: engine.lena_configuration.trigger_conditions,
      },
      // SCENARIOS — what may happen to the shipment
      scenarios: engine.scenarios,
      // ACTIONS — what we can do to mitigate
      actions: engine.actions,
      // RECOMMENDATION — what DenkKern suggests (separate from scenarios and actions)
      recommendation: engine.engine_output.recommendation,
      score_breakdown: engine.engine_output.score_breakdown,
      rules_triggered: engine.engine_output.rules_triggered,
      explanation_trace: engine.engine_output.explanation_trace,
      decision_constraints: engine.decision_constraints,
      organization_rules: engine.organization_rules,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('[GET /api/demo/shipments/:id/decision-engine]', err);
    return NextResponse.json({ error: 'Failed to load decision engine data.' }, { status: 500 });
  }
}
