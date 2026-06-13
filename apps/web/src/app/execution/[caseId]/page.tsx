'use client';

/**
 * ExecutionPage — /execution/:caseId
 *
 * Handles three states:
 *   second_approval_pending   → shows supervisor approval panel (mock buttons)
 *   second_approval_confirmed → shows "approved — triggering execution" message
 *   second_approval_rejected  → shows rejection notice + redirect to decision room
 *   execution_started / execution_monitoring → shows execution in progress stub
 *   decision_approved (no gate) → auto-emits execution_triggered, advances to execution_started
 *
 * Architecture rule C2 (enforced here AND in dispatcher):
 *   second_approval_confirmed and second_approval_rejected must be emitted_by
 *   a named supervisor — never 'lena' or 'system'.
 *
 * Source: docs/architecture/08-page-flow-map.md — Route: /execution/:caseId
 *         docs/architecture/sprint-2-plan.md §2
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useWorkflowState } from '../../../hooks/useWorkflowState.js';
import { StatusBadge } from '../../../components/ui/StatusBadge.js';

// ---------------------------------------------------------------------------
// SupervisorApprovalPanel
// ---------------------------------------------------------------------------

/**
 * Shown when state === 'second_approval_pending'.
 *
 * Two mock buttons dispatch second_approval_confirmed / second_approval_rejected.
 * emitted_by is hardcoded to 'supervisor' for MVP — real identity (SSO) is post-pilot.
 *
 * C2 rule: 'lena' and 'system' are blocked at the dispatcher; this UI always
 * sends 'supervisor', which satisfies the rule.
 */
function SupervisorApprovalPanel({
  caseId,
  onComplete,
}: {
  caseId: string;
  onComplete: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dispatch(event: 'second_approval_confirmed' | 'second_approval_rejected') {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const res = await fetch(`/api/cases/${caseId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        emitted_by: 'supervisor',   // C2: must be a named supervisor — never 'lena' or 'system'
        emitted_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? 'Request failed.');
      setIsSubmitting(false);
      return;
    }

    onComplete();
  }

  return (
    <div className="card" style={{ border: '2px solid var(--warning)', marginTop: 24 }}>
      <div className="card-header">
        <span className="card-title" style={{ color: 'var(--warning)' }}>
          ⏳ Supervisor approval required
        </span>
      </div>
      <div className="card-body" style={{ padding: 28 }}>
        <p style={{ fontSize: 14, marginBottom: 8 }}>
          This decision exceeds the operational threshold for autonomous approval.
          A supervisor must review and confirm or reject before execution can proceed.
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
          MVP: approval is simulated. Real identity and SSO are post-pilot scope.
        </p>

        {error != null && (
          <div
            className="alert alert-error"
            style={{ marginBottom: 16, padding: '10px 14px', fontSize: 13, color: 'var(--critical)' }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn btn-primary"
            disabled={isSubmitting}
            onClick={() => { void dispatch('second_approval_confirmed'); }}
            style={{ minWidth: 160 }}
          >
            {isSubmitting ? 'Submitting…' : '✅ Approve (Supervisor)'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={isSubmitting}
            onClick={() => { void dispatch('second_approval_rejected'); }}
            style={{ minWidth: 160 }}
          >
            ❌ Reject (Supervisor)
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ExecutionPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const router = useRouter();

  const { state, isLoading, refresh } = useWorkflowState(caseId);

  // If the gate did not fire (decision_approved, no second approval needed),
  // auto-trigger execution so the page advances immediately.
  useEffect(() => {
    if (state !== 'decision_approved') return;

    void (async () => {
      await fetch(`/api/cases/${caseId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'execution_triggered',
          emitted_by: 'system',
          emitted_at: new Date().toISOString(),
        }),
      });
      await refresh();
    })();
  }, [state, caseId, refresh]);

  // After supervisor rejection, redirect back to the decision room.
  useEffect(() => {
    if (state === 'second_approval_rejected') {
      router.replace(`/decision-room/${caseId}`);
    }
  }, [state, caseId, router]);

  if (isLoading || state == null) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading…
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isAwaitingSecondApproval = state === 'second_approval_pending';
  const isApproved               = state === 'second_approval_confirmed';
  const isExecuting              = state === 'execution_started' || state === 'execution_monitoring';

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Execution</h1>
          <p className="page-subtitle">
            Case {caseId} ·{' '}
            {isAwaitingSecondApproval
              ? 'Awaiting supervisor approval'
              : isApproved
              ? 'Supervisor approved — ready for execution'
              : 'Decision approved — execution in progress'}
          </p>
        </div>
        <StatusBadge status={state} />
      </div>

      {/* Second-approval pending */}
      {isAwaitingSecondApproval && (
        <SupervisorApprovalPanel
          caseId={caseId}
          onComplete={() => { void refresh(); }}
        />
      )}

      {/* Supervisor approved — execution about to start */}
      {isApproved && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
              Supervisor approved
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto', marginBottom: 20 }}>
              The decision has been approved by a supervisor.
              Execution can now be triggered.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                void (async () => {
                  await fetch(`/api/cases/${caseId}/events`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      event: 'execution_triggered',
                      emitted_by: 'system',
                      emitted_at: new Date().toISOString(),
                    }),
                  });
                  await refresh();
                })();
              }}
            >
              Trigger execution
            </button>
          </div>
        </div>
      )}

      {/* Execution in progress (stub) */}
      {isExecuting && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
              Execution in progress
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto' }}>
              The selected course of action has been approved and handed off for execution.
              Full execution monitoring will be available in a future release.
            </p>
            <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
              Case {caseId}
            </p>
          </div>
        </div>
      )}

      {/* Outcome tracking link — available once outcome_pending or outcome_confirmed */}
      {(state === 'outcome_pending' || state === 'outcome_confirmed') && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-body" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {state === 'outcome_confirmed' ? '✅ Outcome confirmed' : '📋 Outcome tracking active'}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                {state === 'outcome_confirmed'
                  ? 'The outcome has been recorded. Review the full timeline below.'
                  : 'Checkpoints are being tracked. Confirm or mark each dimension when data is available.'}
              </p>
            </div>
            <a
              href={'/cases/' + caseId + '/outcome'}
              className="btn btn-primary"
              style={{ flexShrink: 0, marginLeft: 16, fontSize: 13 }}
            >
              View outcome timeline →
            </a>
          </div>
        </div>
      )}

      {/* Fallback for decision_approved before auto-trigger fires */}
      {state === 'decision_approved' && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
            <span className="loading-spinner" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              Triggering execution…
            </p>
          </div>
        </div>
      )}
    </>
  );
}
