'use client';

/**
 * ExecutionValidationPage — /demo/shipments/:shipmentId/execution-validation
 *
 * Pre-execution checklist: blocking and non-blocking items.
 * Supports demo POST to validate execution_validation_pending → execution_started.
 * Sprint 9A — Demo UI Bridge. UX V1 Rev 3.
 *
 * Data source:
 *   GET  /api/demo/shipments/:id/execution-validation
 *   POST /api/demo/shipments/:id/execution-validation  { action: "confirm_execution", userRole: string }
 * No /api/cases/* dependency. No hardcoded decision values.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChecklistItem {
  item_id: string;
  label: string;
  description: string;
  status: string;
  checked_by?: string;
  checked_at?: string;
}

interface ChecklistGroup {
  total: number;
  completed: number;
  blocking: ChecklistItem[];
  non_blocking: ChecklistItem[];
}

interface ExecutionValidationData {
  schema_version: string;
  case_id: string;
  action_id: string;
  action_label: string;
  execution_can_proceed: boolean;
  execution_cannot_proceed_reason: string | null;
  approval_status: string;
  approval_required: boolean;
  checklist: ChecklistGroup;
  booking_deadline: string;
  estimated_arrival: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ItemStatusIcon({ status }: { status: string }) {
  if (status === 'confirmed') return <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span>;
  if (status === 'pending')   return <span style={{ color: 'var(--warning)', fontWeight: 700 }}>○</span>;
  if (status === 'blocked')   return <span style={{ color: 'var(--critical)', fontWeight: 700 }}>✗</span>;
  return <span style={{ color: 'var(--text-muted)' }}>—</span>;
}

function ChecklistRow({ item, isBlocking }: { item: ChecklistItem; isBlocking: boolean }) {
  const confirmed = item.status === 'confirmed';
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
      borderBottom: '1px solid var(--border)',
      opacity: confirmed ? 0.75 : 1,
    }}>
      <div style={{ marginTop: 2, flexShrink: 0 }}>
        <ItemStatusIcon status={item.status} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: confirmed ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: confirmed ? 'line-through' : 'none' }}>
            {item.label}
          </span>
          {isBlocking && (
            <span style={{ fontSize: 10, padding: '1px 5px', background: 'rgba(239,68,68,0.1)', color: 'var(--critical)', borderRadius: 3, fontWeight: 700 }}>
              BLOCKING
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.description}</div>
        {confirmed && item.checked_by && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Confirmed by {item.checked_by}
            {item.checked_at && ` · ${new Date(item.checked_at).toLocaleString('de-DE')}`}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <span style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 3, fontWeight: 600,
          background: confirmed ? 'rgba(34,197,94,0.1)' : item.status === 'blocked' ? 'rgba(239,68,68,0.1)' : 'rgba(249,115,22,0.1)',
          color: confirmed ? '#22c55e' : item.status === 'blocked' ? 'var(--critical)' : '#f97316',
        }}>
          {item.status}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExecutionValidationPage() {
  const params = useParams<{ shipmentId: string }>();
  const shipmentId = params.shipmentId;

  const [data, setData] = useState<ExecutionValidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ allowed: boolean; message?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch(`/api/demo/shipments/${shipmentId}/execution-validation`)
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<ExecutionValidationData>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    setConfirmResult(null);

    try {
      const res = await fetch(`/api/demo/shipments/${shipmentId}/execution-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_execution', userRole: 'logistics_manager' }),
      });
      const json = (await res.json()) as { allowed: boolean; message?: string; errors?: { message: string }[] };
      if (json.allowed) {
        setConfirmResult({ allowed: true, message: json.message ?? 'Execution start validated.' });
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
        Loading execution validation…
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Could not load execution validation</div>
        <p style={{ fontSize: 13 }}>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { checklist } = data;
  const completionPct = checklist.total > 0 ? Math.round((checklist.completed / checklist.total) * 100) : 0;
  const blockingPending = checklist.blocking.filter((i) => i.status !== 'confirmed').length;

  return (
    <>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Execution Validation</h1>
          <p className="page-subtitle">
            Case {data.case_id} · Confirm pre-execution checklist before starting {data.action_label}
          </p>
        </div>
        <Link href={`/demo/shipments/${shipmentId}/approval`} className="btn btn-secondary">
          ← Approval
        </Link>
      </div>

      {/* Can proceed / cannot proceed banner */}
      {!data.execution_can_proceed && data.execution_cannot_proceed_reason && (
        <div style={{
          padding: '12px 20px', marginBottom: 20,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, fontSize: 13, color: 'var(--critical)', fontWeight: 500,
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span>✗</span>
          <span>{data.execution_cannot_proceed_reason}</span>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

        {/* Left — checklist */}
        <div>
          {/* Progress */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Checklist progress</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: completionPct === 100 ? '#22c55e' : 'var(--warning)' }}>
                {checklist.completed} / {checklist.total} complete
              </span>
            </div>
            <div className="card-body">
              <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${completionPct}%`, background: completionPct === 100 ? '#22c55e' : 'var(--warning)', borderRadius: 4, transition: 'width 0.3s' }} />
              </div>
              {blockingPending > 0 && (
                <p style={{ fontSize: 12, color: 'var(--critical)', margin: 0 }}>
                  ⚠ {blockingPending} blocking item{blockingPending !== 1 ? 's' : ''} not yet confirmed
                </p>
              )}
            </div>
          </div>

          {/* Blocking items */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Blocking items</span>
              <span style={{ fontSize: 11, color: 'var(--critical)', fontWeight: 600 }}>
                Must all be confirmed
              </span>
            </div>
            <div className="card-body" style={{ padding: '0 24px' }}>
              {checklist.blocking.length === 0 ? (
                <p style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>No blocking items.</p>
              ) : (
                checklist.blocking.map((item) => (
                  <ChecklistRow key={item.item_id} item={item} isBlocking />
                ))
              )}
            </div>
          </div>

          {/* Non-blocking items */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Non-blocking items</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Recommended but not required
              </span>
            </div>
            <div className="card-body" style={{ padding: '0 24px' }}>
              {checklist.non_blocking.length === 0 ? (
                <p style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>No non-blocking items.</p>
              ) : (
                checklist.non_blocking.map((item) => (
                  <ChecklistRow key={item.item_id} item={item} isBlocking={false} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right — action summary and confirm CTA */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header"><span className="card-title">Execution summary</span></div>
            <div className="card-body">
              <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {data.action_label}
              </h3>

              <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Booking deadline</span>
                  <span style={{ fontWeight: 600, color: 'var(--critical)' }}>{formatDate(data.booking_deadline)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Est. arrival</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(data.estimated_arrival)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Approval status</span>
                  <span style={{
                    fontWeight: 600,
                    color: data.approval_status === 'approved' ? '#22c55e' : 'var(--warning)',
                  }}>
                    {data.approval_status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Can proceed</span>
                  <span style={{ fontWeight: 700, color: data.execution_can_proceed ? '#22c55e' : 'var(--critical)' }}>
                    {data.execution_can_proceed ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
              </div>

              {/* Confirm result */}
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

              {/* Confirm button */}
              {!confirmResult?.allowed && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginBottom: 8 }}
                  onClick={() => { void handleConfirm(); }}
                  disabled={confirming}
                  title={!data.execution_can_proceed ? 'Cannot start execution — blocking items pending' : undefined}
                >
                  {confirming ? (
                    <><span className="loading-spinner" style={{ width: 14, height: 14 }} /> Validating…</>
                  ) : (
                    'Confirm execution start →'
                  )}
                </button>
              )}

              {confirmResult?.allowed && (
                <Link
                  href={`/demo/shipments/${shipmentId}/outcome`}
                  className="btn btn-primary"
                  style={{ width: '100%', textAlign: 'center', display: 'block' }}
                >
                  View outcome →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
