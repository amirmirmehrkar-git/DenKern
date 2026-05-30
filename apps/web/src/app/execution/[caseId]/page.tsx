'use client';

/**
 * ExecutionPage — /execution/:caseId
 *
 * Minimal stub. Sprint 1 scope ends at decision approval.
 * This page confirms the decision was approved and shows the workflow state.
 *
 * Full execution monitoring (step tracking, audit log, etc.) is out of Sprint 1 scope.
 *
 * Source: docs/architecture/08-page-flow-map.md — Route: /execution/:caseId
 */

import { useParams } from 'next/navigation';
import { useWorkflowState } from '../../../hooks/useWorkflowState.js';
import { StatusBadge } from '../../../components/ui/StatusBadge.js';

export default function ExecutionPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;

  const { state, isLoading } = useWorkflowState(caseId);

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        Loading…
      </div>
    );
  }

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Execution in progress</h1>
          <p className="page-subtitle">Case {caseId} · Decision approved</p>
        </div>
        {state && <StatusBadge status={state} />}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
            Decision approved
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
            The selected course of action has been approved and handed off for execution.
            Full execution monitoring will be available in a future release.
          </p>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            Case {caseId}
          </p>
        </div>
      </div>
    </>
  );
}
