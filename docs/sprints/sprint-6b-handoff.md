---
title: Sprint 6B Technical Handoff
sprint: 6B
status: complete
completed: 2026-06-12
author: orchestration
depends_on: sprint-6a-handoff.md
---

# Sprint 6B Technical Handoff

Sprint 6B adds the capture experience on top of the Sprint 6A Decision Memory backend. The core loop is unchanged. Sprint 6B owns one path only: **email notification → token confirmation form → `confirmOutcome()`**.

The verify-dk-604.mjs script still passes 39/39 after all Sprint 6B changes. The Sprint 6A loop is unbroken.

---

## 1. Files Added or Changed

### New files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/workflow/confirmation-token.ts` | Token lifecycle: generate, validate, mark-used |
| `apps/web/src/app/api/cases/[caseId]/send-outcome-notification/route.ts` | `POST /api/cases/:caseId/send-outcome-notification` |
| `apps/web/src/app/cases/[caseId]/confirm-outcome/page.tsx` | Server Component — reads draft server-side, guards token param |
| `apps/web/src/app/cases/[caseId]/confirm-outcome/ConfirmOutcomeForm.tsx` | Client Component — interactive form + success view |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/app/api/cases/[caseId]/confirm-outcome/route.ts` | Added token validation block for `confirmation_channel === "email"` |
| `apps/web/src/app/globals.css` | Appended confirm-page CSS (`.confirm-page`, `.confirm-card`, `.confirm-header`, `.confirm-section`, `.confirm-summary-*`, `.confirm-quality-*`, `.confirm-textarea`, `.confirm-submit-btn`, etc.) |

### Mock data written at runtime (CASE-001)

| File | Written by | Contents |
|------|-----------|---------|
| `mock/cases/CASE-001/confirmation-token.json` | `generateToken()` | UUID token, created_at, expires_at (7 days), used flag |
| `mock/cases/CASE-001/outbound-email.json` | send-outcome-notification route | Full email record — subject, body_text, body_html, confirmation_url |

---

## 2. Exact Email Confirmation Flow

```
Operator                     System
───────                     ──────
                             [outcome_pending — outcome-draft.json exists]

POST /send-outcome-notification
                             1. Reads outcome-draft.json
                             2. Reads decision-record.json (guards: outcome already confirmed → 409)
                             3. generateToken(caseId) → writes confirmation-token.json
                             4. Builds confirmationUrl = ${BASE_URL}/cases/${caseId}/confirm-outcome?token=${token}
                             5. Builds email (subject, body_text, body_html)
                             6. Writes outbound-email.json (mock send)
                             7. Returns { case_id, token, confirmation_url, expires_at, email_preview, mock_note }

Opens confirmationUrl in browser
                             [GET /cases/:caseId/confirm-outcome?token=<uuid>]
                             Server Component (page.tsx):
                             1. Reads outcome-draft.json → 500 if missing
                             2. Reads decision-record.json → AlreadyConfirmedPage if outcome.status === "confirmed"
                             3. Checks ?token param → ErrorPage if absent
                             4. Renders <ConfirmOutcomeForm caseId token draft />

Lena reviews summary,
fills form fields,
clicks "Confirm outcome"
                             [POST /api/cases/:caseId/confirm-outcome]
                             Body: { confirmed_by, confirmation_channel: "email", token, production_impact,
                                     decision_quality, notes }

                             route.ts:
                             1. Validates body fields (confirmed_by, production_impact, decision_quality)
                             2. Token validation (email channel only):
                                  validateToken(caseId, token) →
                                    NOT_FOUND / mismatch → 401 TOKEN_INVALID
                                    EXPIRED              → 410 TOKEN_EXPIRED
                                    ALREADY_USED         → 409 TOKEN_ALREADY_USED
                             3. confirmOutcome(caseId, input) → writes OutcomeRecord into decision-record.json
                             4. markTokenUsed(caseId, token) → sets used: true, used_at: now
                             5. dispatchWorkflowEvent(caseId, { event: "confirm_outcome", ... })
                                  → workflow: outcome_pending → outcome_confirmed
                             6. Returns { case_id, workflow_state, outcome }

Form shows success view
                             [SuccessView renders confirmed outcome summary]
```

---

## 3. Token Generation and Validation

### Storage

```
mock/cases/:caseId/confirmation-token.json
{
  "token":      "<uuid-v4>",
  "case_id":    "CASE-001",
  "created_at": "<ISO>",
  "expires_at": "<ISO + 7 days>",
  "used":       false,
  "used_at":    null
}
```

One token per case. Re-sending the notification **replaces** the existing token. The old confirmation link becomes invalid.

### `generateToken(caseId)`

Creates a `crypto.randomUUID()`, writes the record with `expires_at = now + 7 days`, returns the record. Uses NTFS null-byte guard (write → readback → JSON.parse).

### `validateToken(caseId, token)`

Returns `{ valid: true, token }` or `{ valid: false, reason }`.

| Condition | `reason` | HTTP status in route |
|-----------|---------|---------------------|
| File missing | `NOT_FOUND` | 401 `TOKEN_INVALID` |
| Token string mismatch | `NOT_FOUND` | 401 `TOKEN_INVALID` |
| `used === true` | `ALREADY_USED` | 409 `TOKEN_ALREADY_USED` |
| `expires_at` in the past | `EXPIRED` | 410 `TOKEN_EXPIRED` |
| All checks pass | — | proceeds to `confirmOutcome()` |

### `markTokenUsed(caseId, token)`

Sets `used: true`, `used_at: now`. Called **after** `confirmOutcome()` succeeds — if confirm throws, the token remains usable for retry. Uses NTFS guard.

---

## 4. What `outbound-email.json` Contains

Written by `POST /send-outcome-notification`. Full structure:

```json
{
  "case_id":          "CASE-001",
  "sent_at":          "<ISO timestamp>",
  "to":               "lena@manufacturer.example",
  "subject":          "[DenkKern] Outcome confirmation required — Case CASE-001",
  "body_text":        "<plain text — arrival summary, decision line, cost comparison, CTA URL>",
  "body_html":        "<full HTML email with inline styles — identical information>",
  "confirmation_url": "http://localhost:3000/cases/CASE-001/confirm-outcome?token=<uuid>",
  "token":            "<uuid>",
  "expires_at":       "<ISO + 7 days>",
  "mock_note":        "MOCK: In production this would be sent via transactional email provider (SendGrid / Postmark). Written to file for pilot."
}
```

The `confirmation_url` is the same value returned in the API response. In the pilot, Lena opens this URL manually. In production, it arrives in her inbox.

---

## 5. Manual Test Sequence — CASE-001

Prerequisites: Next.js dev server running on port 3000. `outcome-draft.json` must exist (run `node scripts/verify-dk-603.mjs` if not).

### Step 1 — Reset to outcome_pending

```bash
node scripts/verify-dk-604.mjs
# This resets decision-record.json to outcome=null, tracking_active=true
# and leaves it in the confirmed state after the script runs.
# To test Sprint 6B: manually reset outcome to null again, OR
# run the reset-only portion:
```

Or reset manually via Node REPL:

```bash
node -e "
const fs = require('fs');
const p = 'mock/cases/CASE-001/decision-record.json';
const r = JSON.parse(fs.readFileSync(p));
fs.writeFileSync(p, JSON.stringify({...r, tracking:{...r.tracking,tracking_active:true}, outcome:null}, null, 2));
console.log('Reset: outcome=null, tracking_active=true');
"
```

### Step 2 — Send outcome notification

```bash
curl -s -X POST http://localhost:3000/api/cases/CASE-001/send-outcome-notification \
  | python3 -m json.tool
```

Expected response shape:

```json
{
  "case_id":          "CASE-001",
  "token":            "<uuid>",
  "confirmation_url": "http://localhost:3000/cases/CASE-001/confirm-outcome?token=<uuid>",
  "expires_at":       "<ISO>",
  "email_preview": {
    "to":      "lena@manufacturer.example",
    "subject": "[DenkKern] Outcome confirmation required — Case CASE-001"
  },
  "mock_note": "MOCK: ..."
}
```

Check `outbound-email.json` was written:

```bash
cat mock/cases/CASE-001/outbound-email.json | python3 -m json.tool | head -20
```

### Step 3 — Open confirmation URL

Copy `confirmation_url` from the response and open in browser:

```
http://localhost:3000/cases/CASE-001/confirm-outcome?token=<uuid>
```

Expected: Page renders with outcome summary (arrival date, delay, costs) and form fields.

### Step 4 — Submit confirmation form

Fill in the form:
- Production stopped: ✓ (check)
- Stopped days: 2
- Customer commitment met: ✗ (uncheck)
- Decision quality: EXCELLENT
- Notes: (optional)

Click "Confirm outcome".

Expected: Success view showing confirmed outcome summary with all fields.

### Step 5 — Verify via API

```bash
curl -s http://localhost:3000/api/cases/CASE-001/outcome-draft \
  | python3 -m json.tool | grep status

# Or inspect the record directly:
cat mock/cases/CASE-001/decision-record.json | python3 -m json.tool | grep -A 5 '"outcome"'
```

Expected: `"status": "confirmed"`, `"confirmation_channel": "email"`.

### Step 6 — Verify token is single-use

Attempt to reuse the same token:

```bash
curl -s -X POST http://localhost:3000/api/cases/CASE-001/confirm-outcome \
  -H "Content-Type: application/json" \
  -d "{\"confirmed_by\":\"lena\",\"confirmation_channel\":\"email\",\"token\":\"<same-uuid>\",\"production_impact\":{\"stopped\":false,\"stopped_days\":null,\"customer_commitment_met\":true},\"decision_quality\":\"GOOD\"}" \
  | python3 -m json.tool
```

Expected: `409 TOKEN_ALREADY_USED` (if outcome was confirmed) or `409 ALREADY_CONFIRMED` from `confirmOutcome()` idempotency guard.

### Step 7 — Verify core loop still intact

```bash
node scripts/verify-dk-604.mjs
```

Expected: **39/39, exit 0**.

---

## 6. Known Shortcuts and Pilot-Stage Assumptions

These are deliberate demo-stage simplifications. They are not bugs.

**Email is written to a file, not sent.**
`outbound-email.json` is the email record. No SMTP, no SendGrid, no Postmark is wired. In the pilot, the operator opens the `confirmation_url` directly from the API response or from the file. Production email delivery is a Sprint 8+ concern.

**No real authentication on the confirmation page.**
The token IS the auth for the email channel. Whoever holds the token can confirm the outcome. There is no session cookie, no user login, no RBAC check. `confirmed_by` is a free-form string — not validated against a user directory. Pilot assumption: Lena is the only operator.

**Token storage is file/mock-based.**
`confirmation-token.json` lives under `mock/cases/:caseId/`. The `MockDataAdapter` does not manage it — it is read and written directly by `confirmation-token.ts`. This is consistent with the rest of the mock layer. A production implementation would store tokens in a database with TTL indexing.

**`confirmed_by` recipient is hardcoded in the email.**
`buildEmail()` always sets `to: "lena@manufacturer.example"`. In production, the recipient comes from the case's assigned operator field.

**`BASE_URL` falls back to `http://localhost:3000`.**
The notification route derives the confirmation URL from `process.env['NEXTAUTH_URL'] ?? process.env['NEXT_PUBLIC_BASE_URL'] ?? 'http://localhost:3000'`. No env var is set in the pilot environment — fallback is always used.

**The confirmation form is pilot-grade UI.**
No loading skeleton, no field-level validation messages, no accessibility audit. The form works. It is not production-hardened.

**Re-sending notification invalidates the previous link.**
Each `POST /send-outcome-notification` call calls `generateToken()`, which overwrites `confirmation-token.json`. The old UUID is now a mismatch — `validateToken` returns `NOT_FOUND`. This is intentional single-token semantics.

**Page is outside the decision-room layout.**
`/cases/:caseId/confirm-outcome` renders without the sidebar or topbar. This is intentional — the page is accessed via email link without an authenticated session. No layout dependency.

---

## 7. What Must Not Be Touched Next

**Core loop — frozen**

Do not modify:
- `apps/web/src/lib/workflow/outcome-confirmer.ts`
- `apps/web/src/lib/workflow/decision-record-writer.ts`
- `apps/web/src/lib/workflow/outcome-draft-generator.ts`
- `packages/types/src/decision-record.ts` (add optional fields if needed; never remove or rename)

**Token contract — do not change the file path or field names**

`mock/cases/:caseId/confirmation-token.json` field names (`token`, `case_id`, `created_at`, `expires_at`, `used`, `used_at`) are read by both the route and the form page. If these are renamed, both files must be updated together.

**Verification script — must keep passing**

Before any PR that touches `apps/web/src/lib/workflow/` or `apps/web/src/app/api/cases/[caseId]/confirm-outcome/`:

```bash
node scripts/verify-dk-604.mjs
# Expected: 39/39, exit 0
```

**NTFS write pattern — never bypass**

Every `writeFileSync` to any mock JSON file must be immediately followed by `readFileSync` + `JSON.parse()`. This applies to any future Sprint 6C/7 code that writes mock files.

---

## Sprint 6 Outcome

Sprint 6 is complete. The full Decision Memory loop is now operational with a usable capture experience:

```
Signal → Recommendation → Decision → DecisionRecord (Sprint 6A / DK-601)
       → Arrival recorded            (Sprint 6A / DK-602)
       → OutcomeDraft generated      (Sprint 6A / DK-603)
       → Notification sent           (Sprint 6B)
       → Token link opened           (Sprint 6B)
       → Confirmation form submitted (Sprint 6B)
       → OutcomeRecord confirmed     (Sprint 6A / DK-604, called by Sprint 6B)
       → Workflow: outcome_confirmed (Sprint 6A dispatcher)
```

**What CASE-001 now preserves:**

| What the system knew | `context_snapshot` — frozen at decision time |
|---|---|
| What it recommended | `recommendation_shown.top_recommendation = EXPEDITE` |
| What the human decided | `decision.scenario_chosen = EXPEDITE` (followed recommendation) |
| What actually happened | `outcome.actual_arrival_date`, `actual_delay_days`, `prediction_error_days` |
| How the human captured it | `confirmation_channel = "email"` |
| Whether the decision was good | `outcome.decision_quality = EXCELLENT` |
| How accurate the model was | `outcome.prediction_accuracy_assessment = OVERESTIMATED` |
| Financial record | `actual_cost_eur = €220k`, `estimated_cost_avoided_eur = €1.43M` |

**Not built in Sprint 6 (intentional):**

- Next-case modal — stretch goal, not needed for pilot walkthrough
- Dashboard indicator — stretch goal, not needed for pilot walkthrough

These remain available as Sprint 7 items if the pilot walkthrough reveals a need for them.
