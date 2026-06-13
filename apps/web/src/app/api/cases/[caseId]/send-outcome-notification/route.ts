/**
 * POST /api/cases/:caseId/send-outcome-notification
 *
 * Sprint 6B — Email notification step.
 *
 * Generates a one-time confirmation token, builds the outcome notification
 * email, and "sends" it (mock: writes to outbound-email.json and logs the URL).
 * Returns the token, confirmation URL, and a full email preview.
 *
 * In the pilot, Nick or the system calls this endpoint after the vessel
 * arrives and the outcome draft is ready. Lena then clicks the link in the
 * email to open the confirmation form.
 *
 * ── Prerequisites ─────────────────────────────────────────────────────────
 *   - outcome-draft.json must exist (DK-603 completed)
 *   - decision-record.json must exist (DK-601 completed)
 *
 * ── What happens here ─────────────────────────────────────────────────────
 *   1. Read outcome-draft.json and decision-record.json
 *   2. Generate a one-time confirmation token (7-day TTL)
 *   3. Build email content (subject, plain-text body, HTML body)
 *   4. Write outbound-email.json (mock "send")
 *   5. Return { token, confirmation_url, email_preview }
 *
 * ── Idempotency ───────────────────────────────────────────────────────────
 *   Safe to call multiple times. Each call replaces the token and email record.
 *   Outstanding tokens from previous calls are automatically invalidated.
 *
 * ── Real email ────────────────────────────────────────────────────────────
 *   Sprint 7: swap the mock write for a SendGrid / SES call.
 *   The email content builder is already extracted — only the send() call changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateToken } from '../../../../../lib/workflow/confirmation-token.js';
import type { DecisionRecord, OutcomeDraft } from '@denkkern/types';

interface RouteParams {
  params: { caseId: string };
}

function mockRoot(): string {
  return process.env['MOCK_ROOT'] ?? process.cwd();
}

function caseFilePath(caseId: string, filename: string): string {
  return join(mockRoot(), 'mock', 'cases', caseId, filename);
}

function formatEur(amount: number): string {
  return '€' + amount.toLocaleString('de-DE');
}

// ---------------------------------------------------------------------------
// Email content builder
// ---------------------------------------------------------------------------

interface EmailContent {
  to: string;
  subject: string;
  body_text: string;
  body_html: string;
}

function buildEmail(
  draft: OutcomeDraft,
  _record: DecisionRecord,
  confirmationUrl: string
): EmailContent {
  const delayDescription =
    draft.actual_delay_days > 0
      ? `${draft.actual_delay_days} days late vs. original schedule`
      : draft.actual_delay_days < 0
        ? `${Math.abs(draft.actual_delay_days)} days early vs. original schedule`
        : 'on original schedule';

  const predictionNote =
    draft.prediction_error_days < 0
      ? `The system predicted arrival on ${draft.predicted_arrival_date} — the vessel arrived ${Math.abs(draft.prediction_error_days)} days earlier than forecast.`
      : draft.prediction_error_days > 0
        ? `The system predicted arrival on ${draft.predicted_arrival_date} — the vessel arrived ${draft.prediction_error_days} days later than forecast.`
        : `The vessel arrived exactly on the predicted date (${draft.predicted_arrival_date}).`;

  const decisionLine = draft.followed_recommendation
    ? `You chose ${draft.selected_scenario_id} (matched system recommendation).`
    : `You chose ${draft.selected_scenario_id} (system recommended ${draft.recommended_scenario_id}).`;

  const subject = `[DenkKern] Outcome confirmation required — Case ${draft.case_id}`;

  const body_text = [
    `Outcome Confirmation — ${draft.case_id}`,
    ``,
    `The vessel has arrived. The system has prepared an outcome summary for your review.`,
    ``,
    `── Arrival ──────────────────────────────────────`,
    `Actual arrival:     ${draft.actual_arrival_date}`,
    `Delay vs. schedule: ${delayDescription}`,
    `Prediction:         ${predictionNote}`,
    ``,
    `── Decision ─────────────────────────────────────`,
    decisionLine,
    `Scenario cost:      ${formatEur(draft.actual_cost_eur)} (${draft.selected_scenario_id})`,
    `WAIT scenario cost: ${formatEur(draft.wait_cost_eur)}`,
    `Estimated saving:   ${formatEur(draft.estimated_cost_avoided_eur)}`,
    ``,
    `── To confirm the outcome ───────────────────────`,
    `Please open the link below, review the summary, and confirm what actually happened.`,
    `The confirmation takes less than 2 minutes.`,
    ``,
    `  ${confirmationUrl}`,
    ``,
    `This link expires in 7 days and can only be used once.`,
    ``,
    `── Why this matters ─────────────────────────────`,
    `Your confirmation becomes part of DenkKern's decision memory. It improves future`,
    `predictions and helps the system learn which scenarios perform well in practice.`,
    ``,
    `── DenkKern ─────────────────────────────────────`,
    `Operational disruption intelligence — Lena 2.0`,
    `This is an automated notification. Reply to your DenkKern account manager with questions.`,
  ].join('\n');

  const body_html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Outcome Confirmation — ${draft.case_id}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; margin: 0; padding: 32px 16px; color: #0f172a; }
  .card { background: #ffffff; border-radius: 8px; max-width: 560px; margin: 0 auto; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .header { background: #0f172a; padding: 24px 32px; }
  .header-title { color: #ffffff; font-size: 18px; font-weight: 600; margin: 0; }
  .header-sub { color: #94a3b8; font-size: 13px; margin: 4px 0 0 0; }
  .body { padding: 28px 32px; }
  .section { margin-bottom: 24px; }
  .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
  .row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
  .row-label { color: #475569; }
  .row-value { color: #0f172a; font-weight: 500; text-align: right; }
  .saving { color: #16a34a; font-weight: 700; }
  .note { font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 8px; }
  .cta-block { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px 24px; margin: 24px 0; text-align: center; }
  .cta-text { font-size: 14px; color: #0f172a; margin-bottom: 14px; }
  .cta-button { display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 28px; border-radius: 6px; }
  .cta-url { font-size: 11px; color: #94a3b8; margin-top: 10px; word-break: break-all; }
  .footer { border-top: 1px solid #e2e8f0; padding: 16px 32px; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <p class="header-title">Outcome Confirmation Required</p>
    <p class="header-sub">Case ${draft.case_id} &nbsp;·&nbsp; DenkKern Decision Memory</p>
  </div>
  <div class="body">
    <p style="font-size:14px;color:#475569;margin-bottom:24px;">
      The vessel has arrived. Please review the outcome summary below and confirm what happened.
    </p>

    <div class="section">
      <div class="section-label">Arrival</div>
      <div class="row"><span class="row-label">Actual arrival</span><span class="row-value">${draft.actual_arrival_date}</span></div>
      <div class="row"><span class="row-label">Delay vs. original schedule</span><span class="row-value">${delayDescription}</span></div>
      <div class="row"><span class="row-label">Predicted arrival</span><span class="row-value">${draft.predicted_arrival_date}</span></div>
      <p class="note">${predictionNote}</p>
    </div>

    <div class="section">
      <div class="section-label">Decision &amp; Cost</div>
      <div class="row"><span class="row-label">Scenario executed</span><span class="row-value">${draft.selected_scenario_id}</span></div>
      <div class="row"><span class="row-label">Scenario cost</span><span class="row-value">${formatEur(draft.actual_cost_eur)}</span></div>
      <div class="row"><span class="row-label">WAIT scenario cost</span><span class="row-value">${formatEur(draft.wait_cost_eur)}</span></div>
      <div class="row"><span class="row-label">Estimated saving</span><span class="row-value saving">${formatEur(draft.estimated_cost_avoided_eur)}</span></div>
      <p class="note">${decisionLine}</p>
    </div>

    <div class="cta-block">
      <p class="cta-text">Confirm the actual production impact and rate the decision quality.</p>
      <a href="${confirmationUrl}" class="cta-button">Confirm Outcome</a>
      <p class="cta-url">${confirmationUrl}</p>
    </div>

    <p style="font-size:12px;color:#94a3b8;text-align:center;">
      This link expires in 7 days and can only be used once.<br>
      Your confirmation improves future predictions for your team.
    </p>
  </div>
  <div class="footer">
    DenkKern &mdash; Operational disruption intelligence, Lena 2.0<br>
    Automated notification. Contact your account manager for questions.
  </div>
</div>
</body>
</html>`;

  return {
    to:         'lena@example.com',
    subject,
    body_text,
    body_html,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

interface NotificationResponse {
  case_id: string;
  token: string;
  confirmation_url: string;
  expires_at: string;
  email_preview: EmailContent;
  mock_note: string;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<NotificationResponse | { error: string; code?: string }>> {
  const { caseId } = params;

  // 1. Check prerequisites
  const draftPath  = caseFilePath(caseId, 'outcome-draft.json');
  const recordPath = caseFilePath(caseId, 'decision-record.json');

  if (!existsSync(draftPath)) {
    return NextResponse.json(
      {
        error: `outcome-draft.json not found for case '${caseId}'. ` +
               `Call POST /api/cases/${caseId}/outcome-draft first.`,
        code: 'DRAFT_MISSING',
      },
      { status: 404 }
    );
  }

  if (!existsSync(recordPath)) {
    return NextResponse.json(
      { error: `decision-record.json not found for case '${caseId}'.`, code: 'RECORD_MISSING' },
      { status: 404 }
    );
  }

  const draft  = JSON.parse(readFileSync(draftPath,  'utf-8')) as OutcomeDraft;
  const record = JSON.parse(readFileSync(recordPath, 'utf-8')) as DecisionRecord;

  // Abort if outcome already confirmed — no need to send a notification
  if (record.outcome !== null) {
    return NextResponse.json(
      {
        error: `Outcome already confirmed for case '${caseId}'. No notification sent.`,
        code: 'ALREADY_CONFIRMED',
      },
      { status: 409 }
    );
  }

  // 2. Generate token
  const tokenRecord = generateToken(caseId);

  // 3. Build confirmation URL
  const baseUrl = process.env['NEXT_PUBLIC_BASE_URL'] ?? 'http://localhost:3000';
  const confirmationUrl =
    `${baseUrl}/cases/${caseId}/confirm-outcome?token=${tokenRecord.token}`;

  // 4. Build email
  const email = buildEmail(draft, record, confirmationUrl);

  // 5. Mock send: write to outbound-email.json
  const emailRecord = {
    sent_at:          new Date().toISOString(),
    mock:             true,
    to:               email.to,
    subject:          email.subject,
    confirmation_url: confirmationUrl,
    token:            tokenRecord.token,
    expires_at:       tokenRecord.expires_at,
    body_text:        email.body_text,
    body_html:        email.body_html,
  };

  const emailPath = caseFilePath(caseId, 'outbound-email.json');
  writeFileSync(emailPath, JSON.stringify(emailRecord, null, 2), 'utf-8');
  JSON.parse(readFileSync(emailPath, 'utf-8')); // NTFS guard

  console.log(
    `[DK-6B] Notification sent (mock)  case=${caseId}  to=${email.to}` +
    `\n         url=${confirmationUrl}`
  );

  return NextResponse.json(
    {
      case_id:          caseId,
      token:            tokenRecord.token,
      confirmation_url: confirmationUrl,
      expires_at:       tokenRecord.expires_at,
      email_preview:    email,
      mock_note:        'Email was not actually sent. See mock/cases/' + caseId + '/outbound-email.json for preview.',
    },
    { status: 200 }
  );
}
