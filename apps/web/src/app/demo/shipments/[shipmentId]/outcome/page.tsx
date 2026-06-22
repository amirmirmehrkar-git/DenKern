'use client';

/**
 * OutcomePage — /demo/shipments/:shipmentId/outcome
 *
 * Outcome review: projected vs actual, financial comparison, lessons learned.
 * Supports demo POST to validate outcome_pending → outcome_confirmed.
 * Sprint 9A — Demo UI Bridge. UX V1 Rev 3.
 *
 * Data source:
 *   GET  /api/demo/shipments/:id/outcome
 *   POST /api/demo/shipments/:id/outcome  { action: "confirm_outcome", userRole: string }
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle, Star, AlertTriangle, Layers, ThumbsUp, Zap, Flag } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionExecuted {
  action_id: string;
  label: string;
  cost_eur: number;
}

interface ProjectedOutcome {
  production_stop_averted: boolean;
  cost_action_eur: number;
  net_benefit_eur: number;
  production_resumes?: string;     // canonical field
  estimated_arrival?: string;      // legacy fallback
  confidence_pct?: number;
  days_saved?: number;
}

interface ActualOutcome {
  execution_status: string;
  actual_arrival?: string;         // legacy field name
  actual_delivery_date?: string;   // canonical JSON field name
  actual_cost_eur: number;
  cost_vs_projection_eur: number;
  cost_variance_reason: string;
  production_stopped: boolean;
  customer_commitment_met: boolean;
  outcome_label: string;
  lessons_learned: string[];
}

interface OutcomeComparison {
  projected_cost_eur: number;
  actual_cost_eur: number;
  cost_variance_eur: number;
  cost_variance_reason: string;
  projected_production_stop: boolean;
  actual_production_stop: boolean;
  net_saving_delivered_eur: number;
  customer_commitment_met: boolean;
}

interface OutcomeData {
  schema_version: string;
  case_id: string;
  action_executed: ActionExecuted;
  projected_outcome: ProjectedOutcome;
  actual_outcome: ActualOutcome;
  comparison: OutcomeComparison;
  outcome_label: string;
  lessons_learned: string[];
  lifecycle_completed: boolean;
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

function CompareRow({
  label, projected, actual,
}: {
  label: string;
  projected: string;
  actual: string;
}) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 12px 8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</td>
      <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>{projected}</td>
      <td style={{ padding: '8px 0 8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{actual}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Static demo data — model accuracy & timeline (no API dependency)
// ---------------------------------------------------------------------------

const MODEL_ACCURACY_STATS = [
  { label: 'Recommendation', value: 'Correct', sub: 'Alternative Supplier was optimal', positive: true },
  { label: 'Cost Prediction', value: '95.9%', sub: '€45K projected, €43.2K actual', positive: true },
  { label: 'Time Prediction', value: '89%', sub: 'Expected +18h, achieved +16h', positive: true },
] as const;

const DECISION_TIMELINE = [
  { icon: AlertTriangle, label: 'Alert detected', time: '15 May 2024 · 08:14', note: 'AIS speed anomaly — 14.2 kn vs 18.5 baseline' },
  { icon: Layers,        label: 'Scenarios generated', time: '15 May 2024 · 08:17', note: '4 scenarios ranked by risk/cost in 3 min' },
  { icon: ThumbsUp,      label: 'Decision made',       time: '15 May 2024 · 09:02', note: 'Alternative Supplier selected by Karen Müller' },
  { icon: CheckCircle,   label: 'Approval granted',    time: '15 May 2024 · 11:30', note: 'Approved within threshold — no CFO escalation' },
  { icon: Zap,           label: 'Execution completed', time: '24 May 2024 · 14:00', note: '2,400 MT delivered to Hamburg facility' },
  { icon: Flag,          label: 'Outcome confirmed',   time: '28 May 2024 · 06:00', note: 'Production resumed on schedule. SLA maintained.' },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModelAccuracySection() {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Star size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="card-title">DenkKern model accuracy</span>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 14 }}>
          {MODEL_ACCURACY_STATS.map(({ label, value, sub, positive }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: positive ? 'var(--status-success)' : 'var(--status-critical)', marginBottom: 2 }}>
                {value}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{sub}</div>
            </div>
          ))}
        </div>
        <div style={{
          padding: '10px 12px', borderRadius: 6, fontSize: 12, lineHeight: 1.5,
          background: 'var(--surface-2)', color: 'var(--text-muted)',
        }}>
          This outcome improves DenkKern&apos;s prediction model for future similar disruptions at Hamburg port.
          Confidence weight for alternative supplier scenarios increased from <strong>85% → 87%</strong>.
        </div>
      </div>
    </div>
  );
}

function DecisionTimeline() {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header"><span className="card-title">Decision timeline</span></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {DECISION_TIMELINE.map(({ icon: Icon, label, time, note }, idx) => {
            const isLast = idx === DECISION_TIMELINE.length - 1;
            return (
              <div key={label} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                {/* connector line */}
                {!isLast && (
                  <div style={{
                    position: 'absolute', left: 11, top: 24, bottom: 0, width: 1,
                    background: 'var(--border)',
                  }} />
                )}
                {/* icon */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isLast ? 'var(--status-success)' : 'var(--surface-2)',
                  border: `1px solid ${isLast ? 'var(--status-success)' : 'var(--border)'}`,
                  zIndex: 1,
                }}>
                  <Icon size={12} style={{ color: isLast ? '#fff' : 'var(--text-muted)' }} />
                </div>
                {/* content */}
                <div style={{ paddingBottom: isLast ? 0 : 18, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{time}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{note}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OutcomePage() {
  const params = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data, setData] = useState<OutcomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ allowed: boolean; message?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch(`/api/demo/shipments/${shipmentId}/outcome`)
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<OutcomeData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  async function handleConfirmOutcome() {
    if (confirming) return;
    setConfirming(true);
    setConfirmResult(null);

    try {
      const res = await fetch(`/api/demo/shipments/${shipmentId}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_outcome', userRole: 'supply_planner' }),
      });
      const json = (await res.json()) as { allowed: boolean; message?: string; errors?: { message: string }[] };
      if (json.allowed) {
        setConfirmResult({ allowed: true, message: json.message ?? 'Outcome confirmed.' });
      } else {
        const errMsg = json.errors?.[0]?.message ?? 'Transition not allowed in current state.';
        setConfirmResult({ allowed: false, error: errMsg });
      }
    } catch (e) {
      setConfirmResult({ allowed: false, error: String(e) });
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading outcome review…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load outcome</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  // Normalize lessons_learned: the canonical JSON stores it as a plain string.
  // Handle all runtime shapes defensively so .map() never throws.
  const rawLessons = data.lessons_learned as unknown;
  const lessons: string[] = Array.isArray(rawLessons)
    ? (rawLessons as string[])
    : typeof rawLessons === 'string' && rawLessons
    ? rawLessons
        .split(/\.\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.endsWith('.') ? s : `${s}.`))
    : rawLessons !== null && typeof rawLessons === 'object'
    ? Object.values(rawLessons as Record<string, string>)
    : [];

  const { comparison: cmp, projected_outcome: proj, actual_outcome: actual } = data;
  const outcomeIsPositive = !actual.production_stopped && actual.customer_commitment_met;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Outcome Review</h1>
          <p className="page-subtitle">
            Case {data.case_id} · Compare projected vs actual results and close the loop
          </p>
        </div>
        <Link href={`/demo/shipments/${shipmentId}/execution`} className="btn btn-secondary">
          ← Execution
        </Link>
      </div>

      {/* Outcome label banner */}
      <div style={{
        padding: '16px 20px', marginBottom: 24,
        background: outcomeIsPositive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${outcomeIsPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
        borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: outcomeIsPositive ? 'var(--status-success)' : 'var(--status-critical)',
        }}>
          {outcomeIsPositive
            ? <CheckCircle size={20} style={{ color: '#fff' }} />
            : <AlertTriangle size={20} style={{ color: '#fff' }} />
          }
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            {data.outcome_label}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Action executed: {data.action_executed.label}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>
            {formatEur(cmp.net_saving_delivered_eur)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>net saving delivered</div>
        </div>
      </div>

      {/* Projected vs Actual */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Projected */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Projected outcome</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>at time of decision</span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Cost of action', value: formatEur(proj.cost_action_eur) },
                { label: 'Net benefit', value: formatEur(proj.net_benefit_eur), green: true },
                { label: 'Production resumes', value: formatDate(proj.production_resumes ?? proj.estimated_arrival ?? '') },
                { label: 'Days saved', value: proj.days_saved != null ? `${proj.days_saved} days` : '—' },
                { label: 'Production stop averted', value: proj.production_stop_averted ? 'Yes' : 'No', green: proj.production_stop_averted, red: !proj.production_stop_averted },
              ].map(({ label, value, green, red }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: green ? '#22c55e' : red ? 'var(--critical)' : 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actual */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Actual outcome</span>
            <span style={{
              fontSize: 11, padding: '2px 6px', borderRadius: 3, fontWeight: 600,
              background: actual.execution_status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)',
              color: actual.execution_status === 'completed' ? '#22c55e' : '#f97316',
            }}>
              {actual.execution_status}
            </span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Actual cost', value: formatEur(actual.actual_cost_eur) },
                { label: 'Cost vs projection', value: `${actual.cost_vs_projection_eur >= 0 ? '+' : ''}${formatEur(actual.cost_vs_projection_eur)}`, red: actual.cost_vs_projection_eur > 0, green: actual.cost_vs_projection_eur < 0 },
                { label: 'Actual arrival', value: formatDate(actual.actual_delivery_date ?? actual.actual_arrival ?? '') },
                { label: 'Production stopped', value: actual.production_stopped ? 'Yes' : 'No', red: actual.production_stopped, green: !actual.production_stopped },
                { label: 'Customer commitment', value: actual.customer_commitment_met ? 'Met ✓' : 'Not met ✗', green: actual.customer_commitment_met, red: !actual.customer_commitment_met },
              ].map(({ label, value, green, red }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: green ? '#22c55e' : red ? 'var(--critical)' : 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Projected vs actual comparison</span></div>
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 12px 6px 0', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                  Dimension
                </th>
                <th style={{ textAlign: 'right', padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                  Projected
                </th>
                <th style={{ textAlign: 'right', padding: '6px 0 6px 12px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                  Actual
                </th>
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Cost" projected={formatEur(cmp.projected_cost_eur)} actual={formatEur(cmp.actual_cost_eur)} />
              <CompareRow label="Cost variance" projected="—" actual={`${cmp.cost_variance_eur >= 0 ? '+' : ''}${formatEur(cmp.cost_variance_eur)}`} />
              <CompareRow label="Net saving delivered" projected={`${formatEur(cmp.net_saving_delivered_eur)}`} actual={formatEur(cmp.net_saving_delivered_eur)} />
              <CompareRow label="Production stop" projected={cmp.projected_production_stop ? 'Expected' : 'Averted'} actual={cmp.actual_production_stop ? 'Occurred' : 'Averted'} />
              <CompareRow label="Customer commitment" projected="Expected to be met" actual={cmp.customer_commitment_met ? 'Met' : 'Not met'} />
            </tbody>
          </table>
          {cmp.cost_variance_reason && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Cost variance reason: {cmp.cost_variance_reason}
            </p>
          )}
        </div>
      </div>

      {/* Model accuracy */}
      <ModelAccuracySection />

      {/* Decision timeline */}
      <DecisionTimeline />

      {/* Lessons learned */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Lessons learned</span></div>
        <div className="card-body">
          {lessons.length > 0 ? (
            <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lessons.map((lesson, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{lesson}</li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>No lessons recorded yet.</p>
          )}
        </div>
      </div>

      {/* Confirm outcome */}
      <div className="card">
        <div className="card-header"><span className="card-title">Close the loop</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
            Confirm the outcome to finalise the decision record. This validates the{' '}
            <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>outcome_pending → outcome_confirmed</code> transition.
          </p>

          {confirmResult && (
            <div style={{
              padding: '10px 12px', borderRadius: 6, marginBottom: 12,
              background: confirmResult.allowed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${confirmResult.allowed ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              fontSize: 13,
              color: confirmResult.allowed ? '#22c55e' : 'var(--critical)',
              fontWeight: 600,
            }}>
              {confirmResult.allowed ? `✓ ${confirmResult.message}` : `✗ ${confirmResult.error}`}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={() => { void handleConfirmOutcome(); }}
              disabled={confirming || confirmResult?.allowed === true}
            >
              {confirming ? (
                <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> Validating…</>
              ) : confirmResult?.allowed ? (
                '✓ Outcome confirmed'
              ) : (
                'Confirm outcome →'
              )}
            </button>
            <Link href="/demo" className="btn btn-secondary">
              Back to Mission Control
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
