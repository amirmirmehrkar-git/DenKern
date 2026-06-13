'use client';

/**
 * ConfirmOutcomeForm — Client Component
 *
 * Sprint 6B — Interactive outcome confirmation form.
 *
 * Pre-populated with system-computed values from the outcome draft.
 * Lena corrects what the system got wrong and confirms what it got right.
 *
 * Form fields:
 *   - production_impact.stopped           (toggle)
 *   - production_impact.stopped_days      (number, shown when stopped=true)
 *   - production_impact.customer_commitment_met  (toggle)
 *   - decision_quality                    (radio: EXCELLENT / GOOD / ACCEPTABLE / POOR)
 *   - notes                               (textarea, optional)
 *
 * Submit flow:
 *   POST /api/cases/:caseId/confirm-outcome
 *     { confirmed_by: "lena", confirmation_channel: "email", token, ...form fields }
 *
 * Success: shows confirmed outcome summary.
 * Error:   inline error message with retry.
 */

import { useState, FormEvent } from 'react';
import type { OutcomeDraft } from '@denkkern/types';

interface Props {
  caseId: string;
  token: string;
  draft: OutcomeDraft;
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

interface ConfirmedOutcome {
  status: string;
  confirmed_at: string;
  confirmed_by: string;
  actual_cost_eur: number;
  estimated_cost_avoided_eur: number;
  prediction_accuracy_assessment: string | null;
  decision_quality: string;
  production_impact: {
    stopped: boolean;
    stopped_days: number | null;
    customer_commitment_met: boolean;
  };
  notes: string | null;
}

function formatEur(n: number): string {
  return '€' + n.toLocaleString('de-DE');
}

export function ConfirmOutcomeForm({ caseId, token, draft }: Props) {
  // Form state — pre-populated from draft where possible
  const [stopped, setStopped] = useState<boolean>(false);
  const [stoppedDays, setStoppedDays] = useState<string>('');
  const [commitmentMet, setCommitmentMet] = useState<boolean>(true);
  const [quality, setQuality] = useState<string>('GOOD');
  const [notes, setNotes] = useState<string>('');

  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [confirmedOutcome, setConfirmedOutcome] = useState<ConfirmedOutcome | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormState('submitting');
    setErrorMessage('');

    const body = {
      confirmed_by:         'lena',
      confirmation_channel: 'email',
      token,
      production_impact: {
        stopped,
        stopped_days:             stopped ? (parseInt(stoppedDays, 10) || 0) : null,
        customer_commitment_met:  commitmentMet,
      },
      decision_quality: quality,
      notes: notes.trim() || null,
    };

    try {
      const res = await fetch(`/api/cases/${caseId}/confirm-outcome`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const data = await res.json() as { outcome?: ConfirmedOutcome; error?: string };

      if (!res.ok) {
        setErrorMessage(data.error ?? `Server error (${res.status})`);
        setFormState('error');
        return;
      }

      setConfirmedOutcome(data.outcome ?? null);
      setFormState('success');
    } catch (err) {
      setErrorMessage('Network error. Please check your connection and try again.');
      setFormState('error');
    }
  }

  if (formState === 'success' && confirmedOutcome !== null) {
    return <SuccessView caseId={caseId} outcome={confirmedOutcome} />;
  }

  const predictionNote =
    draft.prediction_error_days < 0
      ? `${Math.abs(draft.prediction_error_days)} day${Math.abs(draft.prediction_error_days) !== 1 ? 's' : ''} earlier than predicted`
      : draft.prediction_error_days > 0
        ? `${draft.prediction_error_days} day${draft.prediction_error_days !== 1 ? 's' : ''} later than predicted`
        : 'exactly on predicted date';

  const delayNote =
    draft.actual_delay_days > 0
      ? `${draft.actual_delay_days} day${draft.actual_delay_days !== 1 ? 's' : ''} late vs. original schedule`
      : draft.actual_delay_days < 0
        ? `${Math.abs(draft.actual_delay_days)} day${Math.abs(draft.actual_delay_days) !== 1 ? 's' : ''} early`
        : 'on original schedule';

  return (
    <div className="confirm-page">
      <div className="confirm-card">

        {/* Header */}
        <div className="confirm-header">
          <div className="confirm-header__eyebrow">DenkKern — Decision Memory</div>
          <h1 className="confirm-header__title">Confirm Outcome</h1>
          <p className="confirm-header__sub">Case {caseId}</p>
        </div>

        {/* Summary: what the system computed */}
        <div className="confirm-section">
          <div className="confirm-section__label">What happened — system summary</div>
          <div className="confirm-summary-grid">
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Actual arrival</span>
              <span className="confirm-summary-value">{draft.actual_arrival_date}</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">vs. schedule</span>
              <span className="confirm-summary-value">{delayNote}</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">vs. prediction</span>
              <span className="confirm-summary-value">{predictionNote}</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Scenario executed</span>
              <span className="confirm-summary-value">{draft.selected_scenario_id}</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Cost (estimated)</span>
              <span className="confirm-summary-value">{formatEur(draft.actual_cost_eur)}</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Est. saving vs. WAIT</span>
              <span className="confirm-summary-value confirm-summary-value--positive">{formatEur(draft.estimated_cost_avoided_eur)}</span>
            </div>
          </div>
          <p className="confirm-draft-note">
            These values were computed automatically. You can correct them below.
          </p>
        </div>

        {/* Confirmation form */}
        <form onSubmit={handleSubmit} noValidate>

          {/* Production impact */}
          <div className="confirm-section">
            <div className="confirm-section__label">Production impact</div>

            <label className="confirm-toggle-row">
              <input
                type="checkbox"
                className="confirm-toggle"
                checked={stopped}
                onChange={e => setStopped(e.target.checked)}
              />
              <span className="confirm-toggle-label">
                Production was stopped
              </span>
            </label>

            {stopped && (
              <div className="confirm-field confirm-field--indent">
                <label className="confirm-field__label" htmlFor="stoppedDays">
                  How many days was production stopped?
                </label>
                <input
                  id="stoppedDays"
                  type="number"
                  min="0"
                  max="365"
                  className="confirm-input confirm-input--sm"
                  value={stoppedDays}
                  onChange={e => setStoppedDays(e.target.value)}
                  placeholder="e.g. 2"
                />
              </div>
            )}

            <label className="confirm-toggle-row" style={{ marginTop: '12px' }}>
              <input
                type="checkbox"
                className="confirm-toggle"
                checked={commitmentMet}
                onChange={e => setCommitmentMet(e.target.checked)}
              />
              <span className="confirm-toggle-label">
                Customer commitment was met
              </span>
            </label>
          </div>

          {/* Decision quality */}
          <div className="confirm-section">
            <div className="confirm-section__label">Decision quality</div>
            <p className="confirm-field-hint">
              In hindsight, how good was the decision to execute the {draft.selected_scenario_id} scenario?
            </p>
            <div className="confirm-quality-grid">
              {(['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'POOR'] as const).map(q => (
                <label
                  key={q}
                  className={`confirm-quality-option${quality === q ? ' confirm-quality-option--selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="decision_quality"
                    value={q}
                    checked={quality === q}
                    onChange={() => setQuality(q)}
                    className="confirm-quality-radio"
                  />
                  <span className="confirm-quality-label">{q}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="confirm-section">
            <div className="confirm-section__label">Notes <span className="confirm-optional">(optional)</span></div>
            <textarea
              className="confirm-textarea"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything the system missed — supplier issues, internal decisions, context for future cases."
            />
          </div>

          {/* Error */}
          {formState === 'error' && (
            <div className="confirm-error-banner">
              {errorMessage}
            </div>
          )}

          {/* Submit */}
          <div className="confirm-actions">
            <button
              type="submit"
              className="confirm-submit-btn"
              disabled={formState === 'submitting'}
            >
              {formState === 'submitting' ? 'Confirming…' : 'Confirm outcome'}
            </button>
            <p className="confirm-submit-note">
              This records your confirmation as permanent decision memory. It cannot be undone.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success view
// ---------------------------------------------------------------------------

function SuccessView({ caseId, outcome }: { caseId: string; outcome: ConfirmedOutcome }) {
  const accuracyLabel: Record<string, string> = {
    ACCURATE:       'Accurate (±2 days)',
    OVERESTIMATED:  'Overestimated delay',
    UNDERESTIMATED: 'Underestimated delay',
  };

  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-header confirm-header--success">
          <span className="confirm-header__icon">✓</span>
          <h1 className="confirm-header__title">Outcome confirmed</h1>
          <p className="confirm-header__sub">Case {caseId} — Decision memory updated</p>
        </div>

        <div className="confirm-section">
          <div className="confirm-section__label">Confirmed outcome</div>
          <div className="confirm-summary-grid">
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Confirmed by</span>
              <span className="confirm-summary-value">{outcome.confirmed_by}</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Confirmed at</span>
              <span className="confirm-summary-value">{outcome.confirmed_at.slice(0, 16).replace('T', ' ')} UTC</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Decision quality</span>
              <span className={`confirm-summary-value confirm-quality-badge confirm-quality-badge--${outcome.decision_quality.toLowerCase()}`}>
                {outcome.decision_quality}
              </span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Prediction accuracy</span>
              <span className="confirm-summary-value">
                {outcome.prediction_accuracy_assessment
                  ? (accuracyLabel[outcome.prediction_accuracy_assessment] ?? outcome.prediction_accuracy_assessment)
                  : '—'}
              </span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Actual cost</span>
              <span className="confirm-summary-value">{formatEur(outcome.actual_cost_eur)}</span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Est. saving</span>
              <span className="confirm-summary-value confirm-summary-value--positive">
                {formatEur(outcome.estimated_cost_avoided_eur)}
              </span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Production stopped</span>
              <span className="confirm-summary-value">
                {outcome.production_impact.stopped
                  ? `Yes — ${outcome.production_impact.stopped_days ?? '?'} day${outcome.production_impact.stopped_days !== 1 ? 's' : ''}`
                  : 'No'}
              </span>
            </div>
            <div className="confirm-summary-row">
              <span className="confirm-summary-label">Customer commitment</span>
              <span className="confirm-summary-value">
                {outcome.production_impact.customer_commitment_met ? 'Met' : 'Not met'}
              </span>
            </div>
          </div>
          {outcome.notes && (
            <blockquote className="confirm-notes-quote">{outcome.notes}</blockquote>
          )}
        </div>

        <div className="confirm-section confirm-thanks">
          <p>Thank you. This confirmation is now part of DenkKern’s decision memory.</p>
          <p style={{ marginTop: '8px', color: 'var(--text-muted)' }}>
            It will be used to improve future disruption predictions for your team.
          </p>
        </div>
      </div>
    </div>
  );
}
