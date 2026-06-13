---
title: Sprint 7 Technical Handoff
sprint: 7
status: complete
completed: 2026-06-13
author: orchestration
depends_on: sprint-6b-handoff.md
---

# Sprint 7 Technical Handoff

Sprint 7 delivers **Outcome Timeline** — a parallel, checkpoint-based fact-collection layer that runs alongside the existing Sprint 6 Decision Memory loop. The core Sprint 6 contract (DecisionRecord, OutcomeRecord, `verify-dk-604.mjs` 39/39) is entirely untouched. Sprint 7 adds a new dimension: instead of a single outcome confirmation, each decision now generates a set of trackable checkpoints across Operational, Financial, and Business dimensions.

Sprint 7 verification: `verify-dk-70x.mjs` **91/91 passed**. Sprint 6 regression: **39/39 passed**.

---

## 1. What Sprint 7 Delivered

| Ticket | Deliverable |
|--------|-------------|
| DK-701 | Type contracts: `OutcomeTimeline`, `OutcomeCheckpoint`, `CheckpointStatus`, `OutcomeDimension`, `CheckpointTemplate` exported from `@denkkern/types` |
| DK-702 | `DataAdapter` interface extended with `getOutcomeTimeline`, `saveOutcomeTimeline` |
| DK-703 | `MockDataAdapter` lifecycle methods: `sendCheckpointTask`, `advanceReminderForCheckpoint`, `confirmCheckpoint`, `markCheckpointUnresolved`, `resetOutcomeTimeline` |
| DK-704 | `config/checkpoint-defaults.json` — scenario-to-template map (EXPEDITE, WAIT, PARTIAL_EXPEDITE, REROUTE, `_fallback`) |
| DK-705 | Dispatcher consequence: `outcome_capture_initiated` auto-initializes an `OutcomeTimeline` from config; non-blocking, no impact on Decision Memory path |
| DK-706 | Five API endpoints under `/api/cases/:caseId/outcome-timeline/` |
| DK-707 | Minimal UI: `/cases/:caseId/outcome` — checkpoint list with dimension badges, confirm modal, mark-unresolved action, overdue indicators |
| DK-708 | Verification scripts: `verify-dk-706.mjs` (52/52), `verify-dk-70x.mjs` (91/91) |

---

## 2. Files Added or Changed

### New files

| File | Purpose |
|------|---------|
| `packages/types/src/outcome-timeline.ts` | All Sprint 7 type definitions |
| `config/checkpoint-defaults.json` | Scenario → checkpoint template map, read at runtime |
| `mock/cases/CASE-001/outcome-timeline.json` | CASE-001 seed timeline (EXPEDITE, 3 checkpoints, all pending) |
| `apps/web/src/lib/workflow/outcome-timeline-writer.ts` | `initializeOutcomeTimeline()` — reads config, builds checkpoints, persists via adapter |
| `apps/web/src/app/api/cases/[caseId]/outcome-timeline/route.ts` | `GET /api/cases/:caseId/outcome-timeline` |
| `apps/web/src/app/api/cases/[caseId]/outcome-timeline/checkpoints/[checkpointId]/send/route.ts` | `POST .../send` |
| `apps/web/src/app/api/cases/[caseId]/outcome-timeline/checkpoints/[checkpointId]/advance-reminder/route.ts` | `POST .../advance-reminder` |
| `apps/web/src/app/api/cases/[caseId]/outcome-timeline/checkpoints/[checkpointId]/confirm/route.ts` | `POST .../confirm` |
| `apps/web/src/app/api/cases/[caseId]/outcome-timeline/checkpoints/[checkpointId]/mark-unresolved/route.ts` | `POST .../mark-unresolved` |
| `apps/web/src/app/cases/[caseId]/outcome/page.tsx` | Server component — reads timeline + decision record from disk |
| `apps/web/src/app/cases/[caseId]/outcome/OutcomeTimelineView.tsx` | Client component — checkpoint list, confirm modal, mark-unresolved |
| `scripts/verify-dk-706.mjs` | DK-706-scoped verification (52 checks) |
| `scripts/verify-dk-70x.mjs` | Full Sprint 7 verification across DK-701–707 (91 checks) |
| `docs/sprints/sprint-7-plan.md` | Sprint plan and design decisions |

### Modified files

| File | Change |
|------|--------|
| `packages/types/src/index.ts` | Added re-export block for all Sprint 7 types |
| `mock/adapters/data-adapter.ts` | Added `getOutcomeTimeline`, `saveOutcomeTimeline` to `DataAdapter` interface |
| `mock/adapters/mock-adapter.ts` | Implemented all `DataAdapter` additions plus 5 lifecycle helpers |
| `apps/web/src/lib/workflow/dispatcher.ts` | Added `initializeOutcomeTimeline` import; added non-blocking DK-705 consequence after `advanceToOutcomePending` |
| `apps/web/src/app/execution/[caseId]/page.tsx` | Added "View outcome timeline →" link card when state is `outcome_pending` or `outcome_confirmed` |
| `apps/web/src/app/globals.css` | Appended Sprint 7 CSS: `.ot-page`, `.ot-card`, `.ot-dim-badge`, `.ot-modal`, `.ot-summary-pill`, `.ot-callout`, and related tokens |

---

## 3. API Endpoints Added

All endpoints are under `apps/web/src/app/api/cases/[caseId]/outcome-timeline/`.

### `GET /api/cases/:caseId/outcome-timeline`

Returns the `OutcomeTimeline` for a case.

| Response | Meaning |
|----------|---------|
| `200 OutcomeTimeline` | Timeline exists and is returned |
| `204 No Content` | Case exists but timeline not yet initialized (pre-decision) |
| `404` | Case not found |

### `POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/send`

Transitions a checkpoint from `pending` → `sent`. Appends a mock outbound email entry.

| Response | Meaning |
|----------|---------|
| `200 { case_id, checkpoint }` | Sent successfully |
| `404` | Timeline or checkpoint not found |
| `409 LIFECYCLE_CONFLICT` | Checkpoint is not in `pending` status |

### `POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/advance-reminder`

Advances the reminder lifecycle: `sent` → `reminder_1` → `reminder_2` → `reminder_3` → `unresolved`.

| Response | Meaning |
|----------|---------|
| `200 { case_id, checkpoint }` | Advanced successfully |
| `404` | Timeline or checkpoint not found |
| `409 LIFECYCLE_CONFLICT` | Status is not advanceable (pending, confirmed, or unresolved) |

### `POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/confirm`

Confirms a checkpoint with outcome data. Transitions to `confirmed` (terminal) from any non-terminal status.

Request body:
```json
{
  "confirmed_by": "lena",
  "outcome_data": { "notes": "Shipment arrived 4h early, no production impact." }
}
```

| Response | Meaning |
|----------|---------|
| `200 { case_id, checkpoint }` | Confirmed successfully |
| `400` | Missing `confirmed_by` or `outcome_data` |
| `404` | Timeline or checkpoint not found |
| `409 TERMINAL_STATE` | Already `confirmed` or `unresolved` |

### `POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/mark-unresolved`

Forces a checkpoint to `unresolved` (terminal). Idempotent if already `unresolved`.

| Response | Meaning |
|----------|---------|
| `200 { case_id, checkpoint }` | Marked (or already unresolved — idempotent) |
| `404` | Timeline or checkpoint not found |
| `409 TERMINAL_STATE` | Already `confirmed` — cannot downgrade a confirmation |

---

## 4. OutcomeTimeline Data Model

```typescript
interface OutcomeTimeline {
  case_id:        string;
  decision_id:    string;
  schema_version: '1.0';
  initialized_at: string;       // ISO UTC
  checkpoints:    OutcomeCheckpoint[];
  summary:        OutcomeTimelineSummary;
}

interface OutcomeCheckpoint {
  id:               string;     // chk-{id_prefix}-{caseId}-{seq}
  case_id:          string;
  decision_id:      string;
  dimension:        OutcomeDimension;   // 'operational' | 'financial' | 'business' | (string & {})
  task_description: string;
  recipient_id:     string;
  due_at:           string;     // ISO UTC
  status:           CheckpointStatus;
  outcome_data:     Record<string, unknown> | null;
  reminder_count:   number;
  created_at:       string;
  sent_at:          string | null;
  confirmed_at:     string | null;
  confirmed_by:     string | null;
  last_reminder_at: string | null;
}

interface OutcomeTimelineSummary {
  total:      number;
  confirmed:  number;
  unresolved: number;
  pending:    number;   // all non-terminal statuses
}

type CheckpointStatus =
  | 'pending'
  | 'sent'
  | 'reminder_1'
  | 'reminder_2'
  | 'reminder_3'
  | 'confirmed'    // terminal
  | 'unresolved';  // terminal

type OutcomeDimension = 'operational' | 'financial' | 'business' | (string & {});
```

**Separation invariant:** `OutcomeTimeline` never references `OutcomeRecord` or `DecisionQuality`. Those concepts belong to `DecisionRecord.outcome`. The timeline stores factual observations only.

**Checkpoint IDs are deterministic:** `chk-{id_prefix}-{caseId}-{1-based-sequence}`. Example: `chk-op-CASE-001-1`. This makes IDs predictable for test assertions and idempotent re-initialization.

**Summary is recomputed on every save.** The adapter's `#recomputeSummary()` always derives `summary` from the `checkpoints` array. The stored JSON value is never the source of truth — only the array is.

---

## 5. Checkpoint Lifecycle

```
pending  ──[send]──►  sent  ──[advance]──►  reminder_1
                                                │
                                          [advance]
                                                ▼
                                          reminder_2
                                                │
                                          [advance]
                                                ▼
                                          reminder_3
                                                │
                                          [advance]
                                                ▼
                                          unresolved  ◄──[mark-unresolved]── any non-terminal
                                          (terminal)

any non-terminal  ──[confirm]──►  confirmed  (terminal)
```

**Terminal states:** `confirmed` and `unresolved`. No further transitions are possible from either.

**Idempotency:** `markCheckpointUnresolved` is idempotent — calling it on an already-`unresolved` checkpoint returns the checkpoint unchanged with HTTP 200. Calling `confirmCheckpoint` on a `confirmed` checkpoint returns 409.

**`confirmed` is irreversible:** `markCheckpointUnresolved` rejects with 409 if the checkpoint is already `confirmed`. A confirmation cannot be downgraded.

**Email behavior (Sprint 7 mock):** `sendCheckpointTask` and `advanceReminderForCheckpoint` (for `reminder_1/2/3`) append entries to `mock/cases/:caseId/outbound-email.json`. No real email is sent. The `→ unresolved` advance does not emit an email (no one to receive it).

---

## 6. CASE-001 Walkthrough

CASE-001 has been pre-seeded with an EXPEDITE timeline initialized at `2026-06-11T12:01:00Z`, one minute after the decision was approved.

**Seed state:** three checkpoints, all `pending`:

| ID | Dimension | Task | Due |
|----|-----------|------|-----|
| `chk-op-CASE-001-1` | Operational | Confirm expedited shipment arrived and production continued | 2026-06-14 |
| `chk-fin-CASE-001-2` | Financial | Confirm actual expedite cost vs. estimate | 2026-06-18 |
| `chk-biz-CASE-001-3` | Business | Confirm customer commitment impact | 2026-06-25 |

**Walk through the full lifecycle from the command line:**

```bash
# Start dev server
cd apps/web && npm run dev

# 1. GET the timeline (204 if seed not loaded yet, 200 if loaded)
curl http://localhost:3000/api/cases/CASE-001/outcome-timeline

# 2. Send the operational checkpoint task
curl -X POST http://localhost:3000/api/cases/CASE-001/outcome-timeline/checkpoints/chk-op-CASE-001-1/send

# 3. Advance to reminder_1 (simulate no response)
curl -X POST http://localhost:3000/api/cases/CASE-001/outcome-timeline/checkpoints/chk-op-CASE-001-1/advance-reminder

# 4. Confirm the financial checkpoint directly (bypass reminder flow)
curl -X POST http://localhost:3000/api/cases/CASE-001/outcome-timeline/checkpoints/chk-fin-CASE-001-2/confirm \
  -H 'Content-Type: application/json' \
  -d '{"confirmed_by":"lena","outcome_data":{"notes":"Actual cost €4,200 — within estimate."}}'

# 5. Mark business checkpoint unresolved manually
curl -X POST http://localhost:3000/api/cases/CASE-001/outcome-timeline/checkpoints/chk-biz-CASE-001-3/mark-unresolved

# 6. GET final timeline — summary should show total:3 confirmed:1 unresolved:2 pending:0
curl http://localhost:3000/api/cases/CASE-001/outcome-timeline | python3 -m json.tool
```

**UI path:**
1. Navigate to `/execution/CASE-001` — the "View outcome timeline →" card appears when state is `outcome_pending`.
2. Click the link → `/cases/CASE-001/outcome`.
3. The checkpoint list renders with dimension badges (blue=Operational, amber=Financial, brand=Business).
4. Click "✓ Confirm" on any non-terminal checkpoint → confirm modal opens.
5. Fill in `confirmed_by` and outcome notes → submit.
6. The summary pill (N/M confirmed) updates in place.

**How the timeline is seeded in a fresh dispatch:**
When a real `outcome_capture_initiated` event fires through the dispatcher for any case with a `EXPEDITE` scenario, `initializeOutcomeTimeline()` reads `config/checkpoint-defaults.json`, resolves the `EXPEDITE` template set, generates three checkpoints with deterministic IDs and UTC-calculated due dates, and persists the timeline via the adapter. The CASE-001 seed JSON reproduces this output exactly for development without requiring a full dispatch.

---

## 7. Verification Commands and Results

```bash
# Run from repo root

# Sprint 7 full verification (DK-701 through DK-707)
node scripts/verify-dk-70x.mjs
# Expected: 91 passed / 0 failed

# DK-706 scoped verification (API endpoints + lifecycle simulation)
node scripts/verify-dk-706.mjs
# Expected: 52 passed / 0 failed

# Sprint 6 regression (Decision Memory loop must stay clean)
node scripts/verify-dk-604.mjs
# Expected: 39 passed / 0 failed

# TypeScript compilation
cd apps/web && npx tsc --noEmit --skipLibCheck
# Expected: exit 0

# Types package
cd packages/types && npx tsc --noEmit
# Expected: exit 0
```

**Results on Sprint 7 close (2026-06-13):**

| Script | Result |
|--------|--------|
| `verify-dk-70x.mjs` | **91 / 91 passed** |
| `verify-dk-706.mjs` | **52 / 52 passed** |
| `verify-dk-604.mjs` | **39 / 39 passed** |
| `tsc --noEmit --skipLibCheck` (apps/web) | **exit 0** |

---

## 8. What Must Not Be Changed Casually

These constraints were load-bearing throughout Sprint 7 and must be preserved in all future work:

**OutcomeTimeline is architecturally separate from DecisionRecord.**
`OutcomeTimeline` does not import from `decision-record.ts`. `DecisionRecord.outcome` (`OutcomeRecord | null`) is the Sprint 6 fact layer; `OutcomeTimeline.checkpoints` is the Sprint 7 task layer. They serve different purposes. Never merge them.

**`DecisionRecord`, `OutcomeRecord`, and the Sprint 6 loop must not be touched.**
Files `apps/web/src/lib/workflow/outcome-confirmer.ts`, `confirm-outcome/route.ts`, and `decision-record.json` format are frozen after Sprint 6. Any change that makes `verify-dk-604.mjs` fail 39/39 is a regression.

**`decision_quality` does not belong in OutcomeTimeline.**
Decision quality is a retrospective judgment on the decision process and lives in `OutcomeRecord`. Checkpoint `outcome_data` stores factual observations only — what happened, not how well the decision was made.

**Checkpoint templates are JSON, not TypeScript.**
`config/checkpoint-defaults.json` is the single source of truth for scenario → checkpoint mappings. Do not hard-code templates in `outcome-timeline-writer.ts`. Adding a new scenario means adding a key to the JSON only; no TypeScript changes are required.

**Summary is always recomputed on save, never manually written.**
`#recomputeSummary()` is called inside `saveOutcomeTimeline()`. Never patch `summary.confirmed` directly; always update `checkpoints` and save through the adapter.

**Checkpoint IDs are deterministic by construction.**
`chk-{id_prefix}-{caseId}-{1-based-sequence}` — do not change this format. Test assertions, seed data, and the verification scripts all depend on predictable IDs.

**NTFS write guard must be preserved.**
After every `writeFileSync`, the adapter immediately reads the file back and calls `JSON.parse()`. This guards against Windows NTFS silent truncation. Remove this at your own risk on any Windows development machine.

---

## 9. Known Limitations / Mock Assumptions

| Limitation | Detail |
|------------|--------|
| **No real email** | `sendCheckpointTask` and `advanceReminderForCheckpoint` append to `mock/cases/:caseId/outbound-email.json`. No SMTP or notification service is called. |
| **Recipient resolution is static** | `recipient_role: "case_owner"` maps to `DecisionRecord.decision.approved_by` in Sprint 7. In production this would resolve to a real user profile from a user directory. |
| **Timeline auth is absent** | The API endpoints have no authentication. Any caller can confirm or mark-unresolved any checkpoint. Auth is post-pilot scope. |
| **`confirmed_by` is self-reported** | The confirm endpoint trusts the `confirmed_by` field from the request body. In production this should be the authenticated user identity. |
| **No real send scheduler** | The reminder lifecycle (`sent → reminder_1 → reminder_2 → reminder_3`) is driven manually through API calls. In production a background job or cron would advance reminders based on `due_at` and `sent_at`. |
| **outcome_data has no schema enforcement** | The adapter stores `outcome_data` as `Record<string, unknown>`. Sprint 7 uses `{ notes: string }`. Future work should add dimension-specific validation. |
| **Single case adapters / no pagination** | `getOutcomeTimeline` returns the full timeline in one call. For cases with many checkpoints, pagination may be needed in production. |
| **UI has no auth guard** | `/cases/:caseId/outcome` is accessible to any unauthenticated user in dev. |

---

## 10. Recommended Next Sprint Options

In priority order based on the pilot milestone:

### Option A — Pilot Hardening (recommended next)
**Goal:** Make the Lena scenario fully demonstrable end-to-end.

- **A-1 Trigger full dispatch for CASE-001** — run a live `outcome_capture_initiated` event so the seed timeline is regenerated by the real `initializeOutcomeTimeline()` path rather than the static JSON, proving the DK-705 consequence fires correctly in dev.
- **A-2 Domain Expert validation checkpoints** — schedule the two deferred domain expert interviews (Lena / operations lead) to validate the OutcomeTimeline task descriptions and due offsets against real operational cadences.
- **A-3 Date refresh for CASE-001** — the seed `due_at` values (`2026-06-14`, `2026-06-18`, `2026-06-25`) will move into the past. Add a refresh script that resets them relative to today.

### Option B — Outcome Learning Layer (Sprint 8)
**Goal:** Close the feedback loop from outcome facts back to future decisions.

- **B-1** Define `OutcomeLearningRecord` — aggregate confirmed `outcome_data` across all checkpoints into a structured retrospective per decision.
- **B-2** Add a Learning Layer read path — when the engine scores a new scenario, retrieve any `OutcomeLearningRecord` for the same scenario type and surface it as a signal.
- **B-3** Dashboard tile on `/dashboard` — "Outcomes awaiting confirmation" count badge, linking to the relevant `/cases/:caseId/outcome` pages.

### Option C — Reminder Automation (Sprint 8 or 9)
**Goal:** Remove the manual reminder advance step; turn the timeline into a live tracker.

- **C-1** Scheduled job: every 24h, scan all non-terminal checkpoints where `due_at` has passed and `reminder_count < 3`; call `advanceReminderForCheckpoint` automatically.
- **C-2** Cron configuration in `config/checkpoint-defaults.json` per scenario type (e.g., EXPEDITE reminder cadence: 1 day, 3 days, 7 days after `due_at`).
- **C-3** Notify recipient via real email (SMTP or SendGrid) instead of mock append.

### Option D — Multi-Case / Pilot Customer View (Sprint 9)
**Goal:** Nick / customer onboarding has something to show a second pilot customer.

- **D-1** `/dashboard` Outcome Timeline widget — across-case summary (N cases with confirmed outcomes, M awaiting).
- **D-2** CASE-002 seed with a WAIT scenario timeline.
- **D-3** Export button on `/cases/:caseId/outcome` — download a PDF summary of the confirmed outcomes for a case.

---

## Architectural Invariant Summary

```
Sprint 6 (Decision Memory):
  event_confirmed
    → buildAndWriteDecisionRecord()   → decision-record.json
    → outcome_capture_initiated
    → [email] → confirmOutcome()       → decision-record.json.outcome (OutcomeRecord)

Sprint 7 (Outcome Timeline):  [PARALLEL — does not modify Sprint 6 path]
  outcome_capture_initiated
    → initializeOutcomeTimeline()     → outcome-timeline.json
    → (API) checkpoint lifecycle      → outcome-timeline.json  [checkpoints only]

These two paths share decision_id but never write to each other's files.
```

Sprint 7 is closed.
