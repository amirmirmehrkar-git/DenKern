'use client';

/**
 * ScenarioAnalysisPage — /demo/shipments/:shipmentId/scenario-analysis
 *
 * Read-only view of Lena's ranked scenarios and recommendation.
 * Sprint 9A — Demo UI Bridge. UX V1 Rev 3.
 *
 * Data source: GET /api/demo/shipments/:id/decision-engine
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Scenario {
  scenario_id: string;
  label: string;
  description: string;
  action_id: string;
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
  booking_deadline: string;
  estimated_arrival: string;
  delivery_confidence: number;
  feasibility: string;
}

interface ScoreBreakdown {
  dimension: string;
  weight: number;
  scenario_scores: Record<string, number>;
}

interface Recommendation {
  action_id: string;
  scenario_id: string;
  label: string;
  rationale: string;
  confidence_pct: number;
  net_saving_vs_wait_eur: number;
  financial_impact_summary: {
    cost_of_action_eur: number;
    cost_of_inaction_eur: number;
    net_saving_vs_wait_eur: number;
    roi_pct: number;
  };
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
  score_breakdown: ScoreBreakdown[];
  rules_triggered: string[];
  explanation_trace: { step: string; output: string }[];
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

function RankBadge({ rank, recommended }: { rank: number; recommended: boolean }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: recommended ? 'var(--critical)' : 'var(--border)',
      color: recommended ? 'white' : 'var(--text-secondary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 14, flexShrink: 0,
    }}>
      {rank}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario card
// ---------------------------------------------------------------------------

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [expanded, setExpanded] = useState(scenario.recommended);

  return (
    <div className="card" style={{
      marginBottom: 12,
      borderLeft: scenario.recommended ? '4px solid var(--critical)' : '1px solid var(--border)',
    }}>
      {/* Card header */}
      <div
        className="card-header"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        onClick={() => setExpanded(!expanded)}
      >
        <RankBadge rank={scenario.rank} recommended={scenario.recommended} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="card-title">{scenario.label}</span>
            {scenario.recommended && (
              <span style={{
                fontSize: 10, padding: '2px 6px', background: 'var(--critical)',
                color: 'white', borderRadius: 3, fontWeight: 700,
              }}>
                LENA RECOMMENDS
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {scenario.description}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatEur(scenario.cost_eur)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Score: {scenario.composite_score.toFixed(2)}
          </div>
        </div>
        <span style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="card-body" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Est. arrival', value: formatDate(scenario.estimated_arrival) },
              { label: 'Delay', value: scenario.delay_days > 0 ? `+${scenario.delay_days} days` : 'On time', red: scenario.delay_days > 0 },
              { label: 'Delivery confidence', value: `${Math.round(scenario.delivery_confidence * 100)}%` },
              { label: 'Production stop averted', value: scenario.production_stop_averted ? 'Yes' : 'No', red: !scenario.production_stop_averted },
            ].map(({ label, value, red }) => (
              <div key={label} style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: red ? 'var(--critical)' : 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Trade-offs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', marginBottom: 6 }}>
                Pros
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {scenario.trade_offs.pro.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--critical)', textTransform: 'uppercase', marginBottom: 6 }}>
                Cons
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {scenario.trade_offs.con.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ScenarioAnalysisPage() {
  const params = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data, setData] = useState<DecisionEngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        Loading scenario analysis…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load scenario analysis</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { recommendation, scenarios } = data;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Scenario Analysis</h1>
          <p className="page-subtitle">
            Case {data.case_id} · {scenarios.length} scenarios ranked · Engine v{data.engine_version}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Link href={`/demo/shipments/${shipmentId}`} className="btn btn-secondary">
            ← Workspace
          </Link>
          <Link href={`/demo/shipments/${shipmentId}/decision-room`} className="btn btn-primary">
            Decision Room →
          </Link>
        </div>
      </div>

      {/* Recommendation summary */}
      <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--critical)' }}>
        <div className="card-header">
          <span className="card-title">Lena's recommendation</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Confidence: <strong>{recommendation.confidence_pct}%</strong>
          </span>
        </div>
        <div className="card-body">
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            {recommendation.label}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
            {recommendation.rationale}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '0 32px' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cost of action</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatEur(recommendation.financial_impact_summary.cost_of_action_eur)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cost of inaction</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--critical)' }}>
                {formatEur(recommendation.financial_impact_summary.cost_of_inaction_eur)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net saving</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e' }}>
                {formatEur(recommendation.financial_impact_summary.net_saving_vs_wait_eur)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario cards */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
          Ranked scenarios
        </div>
        {scenarios
          .sort((a, b) => a.rank - b.rank)
          .map((s) => <ScenarioCard key={s.scenario_id} scenario={s} />)
        }
      </div>

      {/* Score breakdown */}
      {data.score_breakdown.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">Score breakdown</span></div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 12px 6px 0', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Dimension
                  </th>
                  <th style={{ textAlign: 'right', padding: '6px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Weight
                  </th>
                  {scenarios.sort((a, b) => a.rank - b.rank).map((s) => (
                    <th key={s.scenario_id} style={{ textAlign: 'right', padding: '6px 8px', color: s.recommended ? 'var(--critical)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {s.label.substring(0, 12)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.score_breakdown.map((row) => (
                  <tr key={row.dimension} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 12px 6px 0', color: 'var(--text-primary)' }}>{row.dimension}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {Math.round(row.weight * 100)}%
                    </td>
                    {scenarios.sort((a, b) => a.rank - b.rank).map((s) => {
                      const score = row.scenario_scores[s.scenario_id];
                      return (
                        <td key={s.scenario_id} style={{
                          padding: '6px 8px', textAlign: 'right',
                          color: s.recommended ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: s.recommended ? 600 : 400,
                        }}>
                          {score != null ? score.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rules triggered */}
      {data.rules_triggered.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Rules triggered</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {data.rules_triggered.map((rule, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '3px 8px',
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: 4, color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {rule}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
