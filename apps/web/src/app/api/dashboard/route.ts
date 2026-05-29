/**
 * GET /api/dashboard
 *
 * Returns an aggregated dashboard summary:
 *   - Active cases list with current workflow state + alert (if any)
 *   - Derived operational metrics
 *
 * This endpoint is intentionally simple for the MVP — it covers the one demo
 * case (CASE-001 / SHIP-001). Production would query all active cases.
 *
 * Response: DashboardSummary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '../../../lib/adapters/index.js';
import type { AlertEvent, WorkflowState } from '@denkkern/types';

export interface CaseSummary {
  case_id: string;
  shipment_id: string;
  shipment_name: string;
  destination: string;
  state: WorkflowState;
  alert: AlertEvent | null;
}

export interface DashboardMetrics {
  active_cases: number;
  open_alerts: number;
  high_risk_shipments: number;
  avg_delay_days: number;
}

export interface DashboardSummary {
  cases: CaseSummary[];
  metrics: DashboardMetrics;
}

// ---------------------------------------------------------------------------
// MVP: known case list (replace with DB query in production)
// ---------------------------------------------------------------------------

const ACTIVE_CASES = [
  { case_id: 'CASE-001', shipment_id: 'SHIP-001' },
];

// States that count as "active" (not setup-only, not closed)
const ACTIVE_STATES = new Set<WorkflowState>([
  'monitoring_active', 'disruption_detected', 'alert_generated',
  'disruption_context_opened', 'scenarios_generated', 'recommendation_ranked',
  'decision_pending', 'decision_approved', 'execution_started', 'execution_monitoring',
  'audit_logged',
]);

const ALERT_STATES = new Set<WorkflowState>([
  'alert_generated', 'disruption_context_opened', 'scenarios_generated',
  'recommendation_ranked', 'decision_pending',
]);

export async function GET(
  _req: NextRequest
): Promise<NextResponse<DashboardSummary | { error: string }>> {
  try {
    const adapter = getAdapter();

    const cases: CaseSummary[] = await Promise.all(
      ACTIVE_CASES.map(async ({ case_id, shipment_id }) => {
        const [stateResp, shipmentCtx, alert] = await Promise.all([
          adapter.getWorkflowState(case_id),
          adapter.getShipmentContext(shipment_id),
          adapter.getAlert(case_id).catch(() => null),
        ]);

        return {
          case_id,
          shipment_id,
          shipment_name: shipmentCtx.shipment_name,
          destination: shipmentCtx.destination,
          state: stateResp.state,
          alert: ALERT_STATES.has(stateResp.state) ? alert : null,
        };
      })
    );

    const activeCases = cases.filter(c => ACTIVE_STATES.has(c.state));
    const openAlerts = cases.filter(c => c.alert !== null);
    const highRisk = cases.filter(c => c.alert?.severity === 'HIGH');
    const totalDelayDays = cases.reduce((sum, c) => sum + (c.alert?.expected_delay_days ?? 0), 0);

    const metrics: DashboardMetrics = {
      active_cases: activeCases.length,
      open_alerts: openAlerts.length,
      high_risk_shipments: highRisk.length,
      avg_delay_days: cases.length > 0 ? Math.round(totalDelayDays / cases.length) : 0,
    };

    return NextResponse.json({ cases, metrics }, { status: 200 });
  } catch (err) {
    console.error('[GET /api/dashboard]', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
