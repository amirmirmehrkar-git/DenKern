/**
 * /cases/:caseId/confirm-outcome?token=<token>
 *
 * Sprint 6B — Outcome confirmation form.
 *
 * Lena opens this page by clicking the link in the outcome notification email.
 * The token is pre-filled from the URL query param.
 *
 * Page structure:
 *   ConfirmOutcomePage (Server Component)
 *     - Reads outcome-draft.json server-side (no loading spinner needed)
 *     - Validates token exists (not whether it's valid — route validates on submit)
 *     - Passes draft data to ConfirmOutcomeForm (Client Component)
 *
 *   ConfirmOutcomeForm (Client Component)
 *     - Shows outcome summary from the draft
 *     - Form fields: production_impact (stopped, stopped_days, commitment_met),
 *                    decision_quality, notes
 *     - Submit -> POST /api/cases/:caseId/confirm-outcome with token
 *     - Success -> success state with outcome summary
 *     - Error   -> inline error with retry
 *
 * This page is intentionally self-contained (no sidebar/topbar dependency).
 * It is reachable without being logged into the main app — the token IS the auth.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ConfirmOutcomeForm } from './ConfirmOutcomeForm.js';
import type { OutcomeDraft } from '@denkkern/types';

interface PageProps {
  params: { caseId: string };
  searchParams: { token?: string };
}

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

export default function ConfirmOutcomePage({ params, searchParams }: PageProps) {
  const { caseId } = params;
  const token = searchParams.token ?? '';

  // Server-side: read the outcome draft
  const draftPath   = join(mockRoot(), 'mock', 'cases', caseId, 'outcome-draft.json');
  const recordPath  = join(mockRoot(), 'mock', 'cases', caseId, 'decision-record.json');

  if (!existsSync(draftPath)) {
    return <ErrorPage message={`No outcome draft found for case ${caseId}. The system may not have generated one yet.`} />;
  }

  const draft  = JSON.parse(readFileSync(draftPath,  'utf-8')) as OutcomeDraft;
  const record = existsSync(recordPath)
    ? JSON.parse(readFileSync(recordPath, 'utf-8'))
    : null;

  // If already confirmed, show read-only summary
  if (record?.outcome?.status === 'confirmed') {
    return <AlreadyConfirmedPage caseId={caseId} outcome={record.outcome} />;
  }

  if (!token) {
    return <ErrorPage message="Missing confirmation token. Please open the link from the notification email." />;
  }

  return (
    <ConfirmOutcomeForm
      caseId={caseId}
      token={token}
      draft={draft}
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="confirm-page">
      <div className="confirm-card confirm-card--error">
        <div className="confirm-header">
          <span className="confirm-header__icon">⚠</span>
          <h1 className="confirm-header__title">Cannot open confirmation</h1>
        </div>
        <p className="confirm-error-text">{message}</p>
      </div>
    </div>
  );
}

function AlreadyConfirmedPage({ caseId, outcome }: { caseId: string; outcome: Record<string, unknown> }) {
  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-header confirm-header--success">
          <span className="confirm-header__icon">✓</span>
          <h1 className="confirm-header__title">Outcome already confirmed</h1>
          <p className="confirm-header__sub">Case {caseId}</p>
        </div>
        <div className="confirm-section">
          <p className="confirm-already-text">
            This outcome was confirmed on{' '}
            <strong>{String(outcome['confirmed_at']).slice(0, 10)}</strong>
            {' '}by <strong>{String(outcome['confirmed_by'])}</strong>.
          </p>
          <p className="confirm-already-text" style={{ marginTop: '8px' }}>
            The decision memory record is complete. No further action is needed.
          </p>
        </div>
      </div>
    </div>
  );
}
