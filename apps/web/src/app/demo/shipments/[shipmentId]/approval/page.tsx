'use client';

/**
 * ApprovalPage — /demo/shipments/:shipmentId/approval
 *
 * Approval routing screen. Shows approver, recommended action, and decision context.
 * Supports demo POST to validate the decision_pending → decision_approved transition.
 * Sprint 9A — Demo UI Bridge. UX V1 Rev 3.
 *
 * Data source:
 *   GET  /api/demo/shipments/:id/approval
 *   POST /api/demo/shipments/:id/approval   { action: "approve", userRole: string }
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types — derived from /api/demo/shipments/:id/approval GET response
// ---------------------------------------------------------------------------

interface ApprovalRouting {
  approval_required: boolean;
  approval_status: string;
  threshold_eur: number;
  approver: {
    name: string;
    role: string;
    contact: string;
    response_deadline: string;
  };
  escalation_path: string[];
  approval_note: string;
}

interface RecommendedAction {
  action_id: string;
  label: string;
  description: string;
  cost_eur: number;
  cost_breakdown: Record<string, number>;
  estimated_arrival: string;
  delivery_confidence: number;
  booking_deadline: string;
  feasibility: string;
}

interface DecisionContext {
  case_id: string;
  material: string;
  days_until_production_stop: number;
  total_financial_exposure_eur: number;
  net_saving_eur: number;
  confidence_pct: number;
  rules_triggered: string[];
}

interface ApprovalData {
  schema_version: string;
  case_id: string;
  approval_routing: ApprovalRouting;
  recommended_action: RecommendedAction;
  decision_context: DecisionContext;
  approval_status: string;
  approved_at: string | null;
  approved_by: string | null;
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

function StatusChip({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    pending:  { bg: 'rgba(249,115,22,0.1)',  color: '#f97316' },
    approved: { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e' },
    rejected: { bg: 'rgba(239,68,68,0.1)',   color: 'var(--critical)' },
  };
  const style = colors[status] ?? { bg: 'var(--border)', color: 'var(--text-secondary)' };
  return (
    <span style={{
      fontSize: 12, padding: '3px 10px', borderRadius: 4,
      fontWeight: 700, background: style.bg, color: style.color,
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApprovalPage() {
  const params = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Approval interaction
  const [approving, setApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{ allowed: boolean; message?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch(`/api/demo/shipments/${shipmentId}/approval`)
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ApprovalData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  async function handleApprove() {
    if (approving) return;
    setApproving(true);
    setApprovalResult(null);

    try {
      const res = await fetch(`/api/demo/shipments/${shipmentId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', userRole: 'supply_chain_director' }),
      });
      const json = (await res.json()) as { allowed: boolean; message?: string; errors?: { message: string }[] };
      if (json.allowed) {
        setApprovalResult({ allowed: true, message: json.message ?? 'Decision approved.' });
      } else {
        const errMsg = json.errors?.[0]?.message ?? 'Transition not allowed in current state.';
        setApprovalResult({ allowed: false, error: errMsg });
      }
    } catch (e) {
      setApprovalResult({ allowed: false, error: String(e) });
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading approval screen…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load approval screen</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { approval_routing: ar, recommended_action: ra, decision_context: dc } = data;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Approval</h1>
          <p className="page-subtitle">
            Case {data.case_id} · Approve the recommended action to unlock execution
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusChip status={data.approval_status} />
          <Link href={`/demo/shipments/${shipmentId}/decision-room`} className="btn btn-secondary">
            ← Decision Room
          </Link>
        </div>
      </div>

      {/* Approval required banner */}
      {ar.approval_required && (
        <div style={{
          padding: '12px 20px', marginBottom: 20,
          background: 'rgba(249,115,22,0.08)',
          border: '1px solid rgba(249,115,22,0.25)',
          borderRadius: 8, fontSize: 13, color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span>
            This decision exceeds the auto-approval threshold of <strong>{formatEur(ar.threshold_eur)}</strong>.
            Director-level approval is required.
          </span>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

        {/* Left — action details */}
        <div>
          {/* Recommended action */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Action to approve</span></div>
            <div className="card-body">
              <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {ra.label}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.6 }}>
                {ra.description}
              </p>

              {/* Action metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total cost', value: formatEur(ra.cost_eur), bold: true },
                  { label: 'Est. arrival', value: formatDate(ra.estimated_arrival) },
                  { label: 'Confidence', value: `${Math.round(ra.delivery_confidence * 100)}%` },
                ].map(({ label, value, bold }) => (
                  <div key={label} style={{ padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: bold ? 700 : 600, color: 'var(--text-primary)' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Cost breakdown */}
              {Object.keys(ra.cost_breakdown ?? {}).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Cost breakdown</div>
                  {Object.entries(ra.cost_breakdown).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{key.replace(/_/g, ' ')}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatEur(value as number)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                <strong>Booking deadline:</strong> {formatDate(ra.booking_deadline)} ·{' '}
                <strong>Feasibility:</strong> {ra.feasibility}
              </div>
            </div>
          </div>

          {/* Decision context */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Decision context</span></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 12 }}>
                {[
                  { label: 'Material', value: dc.material },
                  { label: 'Days to production stop', value: `${dc.days_until_production_stop} days`, red: dc.days_until_production_stop <= 7 },
                  { label: 'Financial exposure', value: formatEur(dc.total_financial_exposure_eur), red: true },
                  { label: 'Net saving', value: formatEur(dc.net_saving_eur), green: true },
                  { label: 'Confidence', value: `${dc.confidence_pct}%` },
                ].map(({ label, value, red, green }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: red ? 'var(--critical)' : green ? '#22c55e' : 'var(--text-primary)' }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rules triggered */}
          {dc.rules_triggered?.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Rules triggered</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {dc.rules_triggered.map((rule, i) => (
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
        </div>

        {/* Right — approver panel */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header"><span className="card-title">Approver</span></div>
            <div className="card-body">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {ar.approver.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  {ar.approver.role}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ar.approver.contact}</div>
              </div>

              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Response deadline</span>
                  <span style={{ fontWeight: 600, color: 'var(--critical)' }}>
                    {formatDate(ar.approver.response_deadline)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status</span>
                  <StatusChip status={data.approval_status} />
                </div>
              </div>

              {ar.approval_note && (
                <div style={{ padding: '10px 12px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, fontStyle: 'italic' }}>
                  {ar.approval_note}
                </div>
              )}

              {/* Escalation path */}
              {ar.escalation_path?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Escalation path
                  </div>
                  <ol style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {ar.escalation_path.map((e, i) => <li key={i}>{e}</li>)}
                  </ol>
                </div>
              )}

              {/* Approval result */}
              {approvalResult && (
                <div style={{
                  padding: '10px 12px', borderRadius: 6, marginBottom: 12,
                  background: approvalResult.allowed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${approvalResult.allowed ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  fontSize: 13,
                  color: approvalResult.allowed ? '#22c55e' : 'var(--critical)',
                  fontWeight: 600,
                }}>
                  {approvalResult.allowed ? `✓ ${approvalResult.message}` : `✗ ${approvalResult.error}`}
                </div>
              )}

              {/* Approve button */}
              {data.approval_status === 'pending' && !approvalResult?.allowed && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginBottom: 8 }}
                  onClick={() => { void handleApprove(); }}
                  disabled={approving}
                >
                  {approving ? (
                    <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> Validating…</>
                  ) : (
                    'Approve decision →'
                  )}
                </button>
              )}

              {/* Next step after approval */}
              {approvalResult?.allowed && (
                <Link
                  href={`/demo/shipments/${shipmentId}/execution-validation`}
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'center', display: 'block' }}
                >
                  Proceed to execution →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
