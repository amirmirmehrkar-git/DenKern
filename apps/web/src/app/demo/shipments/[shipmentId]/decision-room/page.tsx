'use client';

/**
 * DecisionRoomPage — /demo/shipments/:shipmentId/decision-room
 *
 * Full-width focused view: review recommendation, inspect financial impact,
 * and proceed to approval. Read-only demo — no state mutation.
 * Sprint 9A — Demo UI Bridge. UX V1 Rev 3.
 *
 * Data source: GET /api/demo/shipments/:id/decision-engine
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types — derived from /api/demo/shipments/:id/decision-engine response shape
// ---------------------------------------------------------------------------

interface Scenario {
  scenario_id: string;
  label: string;
  description: string;
  cost_eur: number;
  estimated_arrival: string;
  delay_days: number;
  delivery_confidence: number;
  production_stop_averted: boolean;
  composite_score: number;
  rank: number;
  recommended: boolean;
  feasibility: string;
  trade_offs: { pro: string[]; con: string[] };
}

interface Action {
  action_id: string;
  label: string;
  description: string;
  cost_eur: number;
  cost_breakdown: Record<string, number>;
  booking_deadline: string;
  estimated_arrival: string;
  delivery_confidence: number;
  feasibility: string;
}

interface Recommendation {
  action_id: string;
  scenario_id: string;
  label: string;
  rationale: string;
  confidence_pct: number;
  financial_impact_summary: {
    cost_of_action_eur: number;
    cost_of_inaction_eur: number;
    net_saving_vs_wait_eur: number;
    roi_pct: number;
  };
}

interface DecisionConstraints {
  booking_deadline: string;
  capacity_confirmed: boolean;
  regulatory_clearance: string;
  customer_notification_required: boolean;
}

interface DecisionEngineData {
  schema_version: string;
  case_id: string;
  generated_at: string;
  engine_version: string;
  lena_configuration: {
    primary_objective: string;
    evaluation_weights: Record<string, number>;
    approval_threshold_eur: number;
    trigger_conditions: string[];
  };
  scenarios: Scenario[];
  actions: Action[];
  recommendation: Recommendation;
  explanation_trace: { step: string; output: string }[];
  decision_constraints: DecisionConstraints;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEur(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Financial impact bar chart (inline SVG)
// ---------------------------------------------------------------------------

function FinancialBar({ label, amount, max, color }: { label: string; amount: number; max: number; color: string }) {
  const pct = Math.max(4, (amount / max) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{formatEur(amount)}</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DecisionRoomPage() {
  const params = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data, setData] = useState<DecisionEngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    fetch(`/api/demo/shipments/${shipmentId}/decision-engine`)
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<DecisionEngineData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading decision room…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load decision room</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { recommendation, scenarios, actions, decision_constraints } = data;
  const recommendedScenario = scenarios.find((s) => s.recommended);
  const recommendedAction = actions.find((a) => a.action_id === recommendation.action_id);
  const fi = recommendation.financial_impact_summary;
  const maxAmount = Math.max(fi.cost_of_action_eur, fi.cost_of_inaction_eur);

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Decision Room</h1>
          <p className="page-subtitle">
            Case {data.case_id} · Review Lena's recommendation and proceed to approval
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/demo/shipments/${shipmentId}/scenario-analysis`} className="btn btn-secondary">
            ← Scenarios
          </Link>
          <Link href={`/demo/shipments/${shipmentId}/approval`} className="btn btn-primary">
            Proceed to approval →
          </Link>
        </div>
      </div>

      {/* Booking deadline warning */}
      {decision_constraints?.booking_deadline && (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 16 }}>⏰</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>Booking deadline:</strong> {formatDate(decision_constraints.booking_deadline)} — delay costs escalate after this point.
          </span>
        </div>
      )}

      {/* Main content: 2-column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 20 }}>

        {/* Left — recommendation details */}
        <div>
          {/* Recommended action */}
          <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--critical)' }}>
            <div className="card-header">
              <span className="card-title">Recommended action</span>
              <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--critical)', color: 'white', borderRadius: 3, fontWeight: 700 }}>
                LENA'S CHOICE
              </span>
            </div>
            <div className="card-body">
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                {recommendation.label}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
                {recommendation.rationale}
              </p>

              {/* Action details */}
              {recommendedAction && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Cost', value: formatEur(recommendedAction.cost_eur) },
                    { label: 'Est. arrival', value: formatDate(recommendedAction.estimated_arrival) },
                    { label: 'Confidence', value: `${Math.round(recommendedAction.delivery_confidence * 100)}%` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Feasibility */}
              {recommendedAction && (
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  <strong>Feasibility:</strong> {recommendedAction.feasibility}
                </p>
              )}
            </div>
          </div>

          {/* Recommended scenario trade-offs */}
          {recommendedScenario && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Trade-offs — {recommendedScenario.label}</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 8 }}>Advantages</div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {recommendedScenario.trade_offs.pro.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--critical)', textTransform: 'uppercase', marginBottom: 8 }}>Risks</div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {recommendedScenario.trade_offs.con.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Explanation trace — collapsible */}
          {data.explanation_trace.length > 0 && (
            <div className="card">
              <div
                className="card-header"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => setShowTrace(!showTrace)}
              >
                <span className="card-title">Engine trace</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {showTrace ? 'Hide ▲' : 'Show ▼'}
                </span>
              </div>
              {showTrace && (
                <div className="card-body">
                  {data.explanation_trace.map((step, i) => (
                    <div key={i} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>
                        {step.step}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {step.output}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right — financial impact panel */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header"><span className="card-title">Financial impact</span></div>
            <div className="card-body">
              <FinancialBar label="Cost of action" amount={fi.cost_of_action_eur} max={maxAmount} color="#6366f1" />
              <FinancialBar label="Cost of inaction" amount={fi.cost_of_inaction_eur} max={maxAmount} color="var(--critical)" />

              <div style={{
                borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net saving</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>
                  {formatEur(fi.net_saving_vs_wait_eur)}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ROI</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {fi.roi_pct}%
                </span>
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Confidence</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${recommendation.confidence_pct}%`, background: '#22c55e', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>
                    {recommendation.confidence_pct}%
                  </span>
                </div>
              </div>

              {/* Decision constraints */}
              {decision_constraints && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Constraints
                  </div>
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Capacity confirmed</span>
                      <span style={{ color: decision_constraints.capacity_confirmed ? '#22c55e' : 'var(--critical)', fontWeight: 600 }}>
                        {decision_constraints.capacity_confirmed ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Regulatory clearance</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                        {decision_constraints.regulatory_clearance}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Customer notification</span>
                      <span style={{ color: decision_constraints.customer_notification_required ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: 600 }}>
                        {decision_constraints.customer_notification_required ? 'Required' : 'Not required'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <Link
                href={`/demo/shipments/${shipmentId}/approval`}
                className="btn btn-primary"
                style={{ width: '100%', textAlign: 'center', marginTop: 20, display: 'block' }}
              >
                Approve this decision →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Alternate scenarios summary */}
      <div className="card">
        <div className="card-header"><span className="card-title">All scenarios at a glance</span></div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Rank', 'Scenario', 'Cost', 'Est. arrival', 'Stop averted', 'Score'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Cost' || h === 'Score' ? 'right' : 'left', padding: '6px 10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.sort((a, b) => a.rank - b.rank).map((s) => (
                <tr key={s.scenario_id} style={{
                  borderBottom: '1px solid var(--border)',
                  background: s.recommended ? 'rgba(239,68,68,0.04)' : undefined,
                }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: s.recommended ? 'var(--critical)' : 'var(--text-secondary)' }}>
                    {s.rank}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: s.recommended ? 600 : 400 }}>{s.label}</span>
                    {s.recommended && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--critical)', fontWeight: 700 }}>★</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatEur(s.cost_eur)}
                  </td>
                  <td style={{ padding: '8px 10px', color: s.delay_days > 0 ? 'var(--critical)' : 'var(--text-primary)' }}>
                    {formatDate(s.estimated_arrival)}{s.delay_days > 0 ? ` (+${s.delay_days}d)` : ''}
                  </td>
                  <td style={{ padding: '8px 10px', color: s.production_stop_averted ? '#22c55e' : 'var(--critical)', fontWeight: 600 }}>
                    {s.production_stop_averted ? '✓ Yes' : '✗ No'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {s.composite_score.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
