'use client';

/**
 * OutcomeTimelineView — client component for /cases/:caseId/outcome
 *
 * Sprint 7 — DK-707.
 *
 * Renders:
 *   1. Timeline header: case ID, decision date, scenario, N/M confirmed summary
 *   2. Checkpoint list: one card per checkpoint sorted by due_at ascending
 *      - Dimension badge (Operational / Financial / Business)
 *      - task_description
 *      - due_at (formatted, overdue indicator if past due and non-terminal)
 *      - status pill
 *      - Action buttons: Confirm, Mark Unresolved (non-terminal only)
 *   3. Confirm modal: confirmed_by + outcome_data.notes → POST .../confirm
 *   4. "No terminal checkpoints" callout (shown when all are still pending/sent)
 *
 * This component does NOT read or write DecisionRecord.
 * All mutations go through the DK-706 API endpoints.
 */

import { useState, useCallback } from 'react';
import type { OutcomeTimeline, OutcomeCheckpoint, CheckpointStatus, OutcomeDimension } from '@denkkern/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  caseId:          string;
  initialTimeline: OutcomeTimeline;
  decisionDate:    string;
  scenarioId:      string;
  supplier:        string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES: CheckpointStatus[] = ['confirmed', 'unresolved'];

const DIMENSION_BADGE: Record<string, { label: string; className: string }> = {
  operational: { label: 'Operational', className: 'ot-dim-badge ot-dim-badge--operational' },
  financial:   { label: 'Financial',   className: 'ot-dim-badge ot-dim-badge--financial'   },
  business:    { label: 'Business',    className: 'ot-dim-badge ot-dim-badge--business'     },
};

const STATUS_BADGE: Record<CheckpointStatus, { label: string; className: string }> = {
  pending:    { label: 'Pending',    className: 'badge badge-neutral' },
  sent:       { label: 'Sent',       className: 'badge badge-info'    },
  reminder_1: { label: 'Reminder 1', className: 'badge badge-warning' },
  reminder_2: { label: 'Reminder 2', className: 'badge badge-warning' },
  reminder_3: { label: 'Reminder 3', className: 'badge badge-warning' },
  confirmed:  { label: 'Confirmed',  className: 'badge badge-success' },
  unresolved: { label: 'Unresolved', className: 'badge badge-critical' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function isOverdue(dueAt: string, status: CheckpointStatus): boolean {
  if (TERMINAL_STATUSES.includes(status)) return false;
  return new Date(dueAt) < new Date();
}

function dimensionBadge(dim: OutcomeDimension) {
  return DIMENSION_BADGE[dim] ?? { label: dim, className: 'ot-dim-badge ot-dim-badge--other' };
}

// ---------------------------------------------------------------------------
// ConfirmModal
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  checkpoint:   OutcomeCheckpoint;
  caseId:       string;
  onSuccess:    (updated: OutcomeTimeline) => void;
  onCancel:     () => void;
}

function ConfirmModal({ checkpoint, caseId, onSuccess, onCancel }: ConfirmModalProps) {
  const [confirmedBy, setConfirmedBy] = useState('lena');
  const [notes, setNotes]             = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmedBy.trim()) {
      setError('confirmed_by is required.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const res = await fetch(
      `/api/cases/${caseId}/outcome-timeline/checkpoints/${checkpoint.id}/confirm`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmed_by: confirmedBy.trim(),
          outcome_data: { notes: notes.trim() },
        }),
      }
    );

    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setError(json.error ?? 'Confirmation failed.');
      setIsSubmitting(false);
      return;
    }

    // Refresh timeline
    const timelineRes = await fetch(`/api/cases/${caseId}/outcome-timeline`);
    if (timelineRes.ok) {
      const refreshed = (await timelineRes.json()) as OutcomeTimeline;
      onSuccess(refreshed);
    } else {
      // Fallback: close modal even if refresh fails
      onCancel();
    }
  }

  return (
    <div className="ot-modal-backdrop" onClick={onCancel}>
      <div className="ot-modal" onClick={e => e.stopPropagation()}>
        <div className="ot-modal-header">
          <h2 className="ot-modal-title">Confirm checkpoint</h2>
          <button className="ot-modal-close" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        <div className="ot-modal-checkpoint-info">
          <span className={dimensionBadge(checkpoint.dimension).className}>
            {dimensionBadge(checkpoint.dimension).label}
          </span>
          <p className="ot-modal-task">{checkpoint.task_description}</p>
        </div>

        <form onSubmit={e => { void handleSubmit(e); }}>
          <div className="ot-modal-field">
            <label className="ot-modal-label" htmlFor="confirmed_by">
              Confirmed by
            </label>
            <input
              id="confirmed_by"
              className="ot-modal-input"
              value={confirmedBy}
              onChange={e => setConfirmedBy(e.target.value)}
              placeholder="user_id"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="ot-modal-field">
            <label className="ot-modal-label" htmlFor="outcome_notes">
              Outcome notes
            </label>
            <textarea
              id="outcome_notes"
              className="ot-modal-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Describe the actual outcome for this dimension…"
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {error !== null && (
            <div className="ot-modal-error">{error}</div>
          )}

          <div className="ot-modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Confirming…' : 'Confirm checkpoint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CheckpointCard
// ---------------------------------------------------------------------------

interface CheckpointCardProps {
  checkpoint:   OutcomeCheckpoint;
  caseId:       string;
  onConfirm:    (id: string) => void;
  onUnresolved: (id: string) => void;
  actionError:  string | null;
  isActing:     boolean;
}

function CheckpointCard({
  checkpoint, caseId, onConfirm, onUnresolved, actionError, isActing
}: CheckpointCardProps) {
  const isTerminal = TERMINAL_STATUSES.includes(checkpoint.status);
  const overdue    = isOverdue(checkpoint.due_at, checkpoint.status);
  const statusDef  = STATUS_BADGE[checkpoint.status];
  const dimDef     = dimensionBadge(checkpoint.dimension);

  return (
    <div className={`ot-card ${isTerminal ? 'ot-card--terminal' : ''}`}>
      <div className="ot-card-header">
        <span className={dimDef.className}>{dimDef.label}</span>
        <span className={statusDef.className}>
          <span className="badge-dot" />
          {statusDef.label}
        </span>
      </div>

      <p className="ot-card-task">{checkpoint.task_description}</p>

      <div className="ot-card-meta">
        <span className={overdue ? 'ot-due--overdue' : 'ot-due'}>
          {overdue ? '⚠ Overdue · ' : ''}Due {formatDate(checkpoint.due_at)}
        </span>
        {checkpoint.confirmed_at !== null && (
          <span className="ot-meta-detail">
            Confirmed {formatDate(checkpoint.confirmed_at)} by {checkpoint.confirmed_by}
          </span>
        )}
        {checkpoint.status !== 'pending' && checkpoint.reminder_count > 0 && (
          <span className="ot-meta-detail">
            {checkpoint.reminder_count} reminder{checkpoint.reminder_count > 1 ? 's' : ''} sent
          </span>
        )}
      </div>

      {checkpoint.outcome_data !== null && checkpoint.status === 'confirmed' && (
        <div className="ot-card-outcome">
          {typeof checkpoint.outcome_data['notes'] === 'string' &&
           checkpoint.outcome_data['notes'] !== '' && (
            <p className="ot-card-outcome-notes">
              &ldquo;{checkpoint.outcome_data['notes']}&rdquo;
            </p>
          )}
        </div>
      )}

      {actionError !== null && (
        <div className="ot-card-error">{actionError}</div>
      )}

      {!isTerminal && (
        <div className="ot-card-actions">
          <button
            className="btn btn-primary"
            style={{ fontSize: 13 }}
            disabled={isActing}
            onClick={() => onConfirm(checkpoint.id)}
          >
            ✓ Confirm
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
            disabled={isActing}
            onClick={() => onUnresolved(checkpoint.id)}
          >
            Mark unresolved
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OutcomeTimelineView (main export)
// ---------------------------------------------------------------------------

export function OutcomeTimelineView({
  caseId, initialTimeline, decisionDate, scenarioId, supplier
}: Props) {
  const [timeline, setTimeline]                 = useState(initialTimeline);
  const [confirmingId, setConfirmingId]         = useState<string | null>(null);
  const [actionErrors, setActionErrors]         = useState<Record<string, string>>({});
  const [actingId, setActingId]                 = useState<string | null>(null);

  const confirmingCheckpoint = confirmingId !== null
    ? (timeline.checkpoints.find(c => c.id === confirmingId) ?? null)
    : null;

  const sorted = [...timeline.checkpoints].sort(
    (a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  );

  const hasAnyTerminal = timeline.checkpoints.some(c => TERMINAL_STATUSES.includes(c.status));

  const handleMarkUnresolved = useCallback(async (checkpointId: string) => {
    setActingId(checkpointId);
    setActionErrors(prev => ({ ...prev, [checkpointId]: '' }));

    const res = await fetch(
      `/api/cases/${caseId}/outcome-timeline/checkpoints/${checkpointId}/mark-unresolved`,
      { method: 'POST' }
    );

    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      setActionErrors(prev => ({ ...prev, [checkpointId]: json.error ?? 'Action failed.' }));
      setActingId(null);
      return;
    }

    // Refresh timeline
    const timelineRes = await fetch(`/api/cases/${caseId}/outcome-timeline`);
    if (timelineRes.ok) {
      setTimeline((await timelineRes.json()) as OutcomeTimeline);
    }
    setActingId(null);
  }, [caseId]);

  return (
    <div className="ot-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Outcome Timeline</h1>
          <p className="page-subtitle">
            Case {caseId}
            {supplier !== null ? ` · ${supplier}` : ''}
            {' '}· Decision {decisionDate}
            {' '}· Scenario {scenarioId}
          </p>
        </div>
        <div className="ot-summary-pill">
          <span className="ot-summary-confirmed">{timeline.summary.confirmed}</span>
          <span className="ot-summary-sep">/</span>
          <span className="ot-summary-total">{timeline.summary.total}</span>
          <span className="ot-summary-label">confirmed</span>
          {timeline.summary.unresolved > 0 && (
            <span className="ot-summary-unresolved">
              · {timeline.summary.unresolved} unresolved
            </span>
          )}
        </div>
      </div>

      {/* No-terminal callout */}
      {!hasAnyTerminal && (
        <div className="ot-callout">
          <span className="ot-callout-icon">ℹ</span>
          <span>
            Checkpoints will be marked as Unresolved automatically after three reminders.
            You can also mark them manually using the action buttons below.
          </span>
        </div>
      )}

      {/* Checkpoint list */}
      <div className="ot-list">
        {sorted.map(checkpoint => (
          <CheckpointCard
            key={checkpoint.id}
            checkpoint={checkpoint}
            caseId={caseId}
            onConfirm={id => setConfirmingId(id)}
            onUnresolved={id => { void handleMarkUnresolved(id); }}
            actionError={actionErrors[checkpoint.id] ?? null}
            isActing={actingId === checkpoint.id}
          />
        ))}
      </div>

      {/* Confirm modal */}
      {confirmingCheckpoint !== null && (
        <ConfirmModal
          checkpoint={confirmingCheckpoint}
          caseId={caseId}
          onSuccess={updated => {
            setTimeline(updated);
            setConfirmingId(null);
          }}
          onCancel={() => setConfirmingId(null)}
        />
      )}
    </div>
  );
}
