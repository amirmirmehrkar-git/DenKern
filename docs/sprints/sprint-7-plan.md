---
title: Sprint 7 Plan — Outcome Timeline
status: active
sprint: 7
author: orchestration
last_updated: 2026-06-12
canonical_model: docs/strategy/outcome-reality-model-v1.md
---

# Sprint 7 Plan — Outcome Timeline

## Strategic Context

Sprint 6 closed the Decision Memory loop: Signal → Recommendation → Decision → DecisionRecord → Arrival → OutcomeDraft → Notification → Token Form → OutcomeRecord confirmed.

The current `OutcomeRecord` is a **single-event snapshot**. The Outcome Reality Model v1.0 redefines outcome as a **timeline of checkpoints** across three dimensions (Operational / Financial / Business). Sprint 7 implements that model as a parallel data layer that feeds the final record — without replacing or modifying the existing `OutcomeRecord`, `DecisionRecord`, or the workflow state machine.

**Active strategic constraint**: if it does not help validate the first pilot, it is not MVP.

---

## Scope — Minimum Viable Sprint 7

Six required features, all designed to be configurable and revisable after Domain Expert interviews.

| Feature | Sprint 7 Delivery |
|---|---|
| Outcome Timeline | New type + mock storage + seed data |
| Checkpoints | `OutcomeCheckpoint` type; auto-generated from config on `outcome_capture_initiated` |
| Checkpoint Tasks | Each checkpoint is a confirmable task, not a reminder |
| Reminder Lifecycle | `pending → sent → reminder_1 → reminder_2 → reminder_3 → confirmed\|unresolved` |
| Pending / Unresolved State | No auto-close; unresolved stays until explicit action |
| Multi-dimensional Outcomes | Operational / Financial / Business dimensions, all optional |

**Explicitly out of scope:**
- Actual email sending (mock outbound pattern only, matching Sprint 6B)
- Dashboard or analytics views
- RAG / Learning Layer
- Multi-industry or multi-tenant work
- Locking or archiving `OutcomeRecord`
- Any change to `DecisionRecord`, `OutcomeRecord`, workflow states, or transition map

---

## Architecture Decisions

### A1 — OutcomeTimeline is parallel to OutcomeRecord, not a replacement

```
DecisionRecord.outcome (OutcomeRecord | null)   ← Sprint 6, UNCHANGED
OutcomeTimeline                                  ← Sprint 7 NEW, separate storage
```

The timeline is stored separately (mock: `mock/cases/:caseId/outcome-timeline.json`). When all checkpoints on the timeline reach `confirmed` status, the orchestration layer may (Sprint 8+) auto-promote to `OutcomeRecord`. In Sprint 7 both can coexist and neither is auto-merged.

### A2 — Checkpoint templates are externalized

`config/checkpoint-defaults.json` maps `decision_type → checkpoint_template[]`. Templates define:
- `dimension` (operational / financial / business)
- `task_description` (plain text, shown to Lena)
- `due_offset_days` (relative to decision date, configurable per template)

Nothing is hardcoded in TypeScript. Changing default checkpoints requires only editing the JSON file — no type changes, no redeployment in dev.

### A3 — Dimension vocabulary is open-ended

`dimension` is typed as `'operational' | 'financial' | 'business' | string` (string union with known values). The UI presents the three controlled choices + "other (free text)". This allows Domain Expert interviews to surface additional dimensions without schema migration.

### A4 — Workflow state machine is unchanged

`outcome_pending → outcome_confirmed` remains the path. The `confirm_outcome` event (DK-604) still transitions the workflow. The timeline is a separate layer; the existing confirm-outcome API continues to work as before.

### A5 — No auto-close on non-response

Reminder lifecycle terminates at `reminder_3`. After that, status becomes `unresolved` on the next advance call. There is no timer-based auto-close. The dispatcher can call `advance_reminder` on a schedule; Sprint 7 only provides the endpoint, not the scheduler.

### A6 — Mock outbound email follows Sprint 6B pattern

No real email in Sprint 7. When a checkpoint task is sent or a reminder advances, the mock adapter appends an entry to `mock/cases/:caseId/outbound-email.json` (same pattern as Sprint 6B notification). This is sufficient for pilot validation.

---

## Data Model

### New file: `packages/types/src/outcome-timeline.ts`

```typescript
// CheckpointStatus is a lifecycle, not a boolean.
// Terminal states: 'confirmed' and 'unresolved'.
// Intermediate states reflect reminder cadence.
export type CheckpointStatus =
  | 'pending'      // created, task not yet sent
  | 'sent'         // task notification sent to recipient
  | 'reminder_1'   // first reminder sent (no response to 'sent')
  | 'reminder_2'   // second reminder sent
  | 'reminder_3'   // third and final reminder sent
  | 'confirmed'    // recipient confirmed (terminal)
  | 'unresolved';  // no response after reminder_3 (terminal)

// OutcomeDimension: controlled vocabulary + open-ended escape hatch.
// Typed as union so known values get IDE autocomplete but arbitrary
// strings (from Domain Expert interviews) are never a type error.
export type OutcomeDimension = 'operational' | 'financial' | 'business' | string;

export interface OutcomeCheckpoint {
  id: string;                         // UUIDv4 — generated at timeline init
  case_id: string;
  decision_id: string;                // DecisionRecord.id
  dimension: OutcomeDimension;
  task_description: string;           // Human-readable prompt shown to recipient
  recipient_id: string;               // user_id who receives the checkpoint task
  due_at: string;                     // ISO 8601 — absolute deadline (computed from template offset)
  status: CheckpointStatus;
  outcome_data: Record<string, unknown> | null;  // Flexible; validated by UI layer only
  reminder_count: number;             // 0–3; incremented by advance_reminder
  created_at: string;                 // ISO 8601
  sent_at: string | null;             // ISO 8601; null until status reaches 'sent'
  confirmed_at: string | null;        // ISO 8601; null until 'confirmed'
  confirmed_by: string | null;        // user_id; null until 'confirmed'
  last_reminder_at: string | null;    // ISO 8601 of most recent reminder
}

export interface OutcomeTimeline {
  case_id: string;
  decision_id: string;
  schema_version: '1.0';
  initialized_at: string;             // ISO 8601; set when outcome_capture_initiated fires
  checkpoints: OutcomeCheckpoint[];
  // Derived summary — recalculated on every save (not authoritative; recomputed on read)
  summary: {
    total: number;
    confirmed: number;
    unresolved: number;
    pending: number;                  // includes sent + reminders
  };
}
```

### `packages/types/src/index.ts` additions

```typescript
export type {
  OutcomeTimeline,
  OutcomeCheckpoint,
  CheckpointStatus,
  OutcomeDimension,
} from './outcome-timeline.js';
```

### No changes to existing types

`DecisionRecord`, `OutcomeRecord`, `OutcomeDraft`, `WorkflowState`, `WorkflowEvent`, `WORKFLOW_TRANSITIONS` — all unchanged.

---

## Configuration

### New file: `config/checkpoint-defaults.json`

Structure: `{ "decision_type": { "checkpoints": [ {...} ] } }`

```json
{
  "_comment": "Default checkpoint templates by decision type. Edit to change defaults without code changes. due_offset_days is relative to decision date.",
  "EXPEDITE": {
    "checkpoints": [
      {
        "id_prefix": "op",
        "dimension": "operational",
        "task_description": "Confirm whether the expedited shipment arrived on schedule and production was able to continue without interruption.",
        "recipient_role": "case_owner",
        "due_offset_days": 3
      },
      {
        "id_prefix": "fin",
        "dimension": "financial",
        "task_description": "Confirm actual expedite cost and whether it differed from the estimate shown at decision time.",
        "recipient_role": "case_owner",
        "due_offset_days": 7
      },
      {
        "id_prefix": "biz",
        "dimension": "business",
        "task_description": "Confirm whether any customer commitments were affected by the delay or the expedite decision.",
        "recipient_role": "case_owner",
        "due_offset_days": 14
      }
    ]
  },
  "WAIT": {
    "checkpoints": [
      {
        "id_prefix": "op",
        "dimension": "operational",
        "task_description": "Confirm actual arrival date and whether production was interrupted during the wait.",
        "recipient_role": "case_owner",
        "due_offset_days": 2
      },
      {
        "id_prefix": "biz",
        "dimension": "business",
        "task_description": "Confirm whether any customer commitments were at risk or missed due to the delay.",
        "recipient_role": "case_owner",
        "due_offset_days": 7
      }
    ]
  },
  "PARTIAL_EXPEDITE": {
    "checkpoints": [
      {
        "id_prefix": "op",
        "dimension": "operational",
        "task_description": "Confirm which components arrived early and whether partial delivery prevented production stoppage.",
        "recipient_role": "case_owner",
        "due_offset_days": 3
      },
      {
        "id_prefix": "fin",
        "dimension": "financial",
        "task_description": "Confirm actual cost split between expedited and standard delivery legs.",
        "recipient_role": "case_owner",
        "due_offset_days": 7
      }
    ]
  },
  "_fallback": {
    "_comment": "Used when decision_type has no explicit template.",
    "checkpoints": [
      {
        "id_prefix": "op",
        "dimension": "operational",
        "task_description": "Confirm what happened operationally after this decision was implemented.",
        "recipient_role": "case_owner",
        "due_offset_days": 7
      }
    ]
  }
}
```

---

## DataAdapter Interface Changes

### `mock/adapters/data-adapter.ts` additions

Two new methods appended to the `DataAdapter` interface:

```typescript
  /**
   * Return the outcome timeline for a given case.
   * Mock: reads from mock/cases/:caseId/outcome-timeline.json
   *       Returns null if the file does not exist (timeline not yet initialized).
   * Real: reads from case database
   */
  getOutcomeTimeline(caseId: string): Promise<OutcomeTimeline | null>;

  /**
   * Persist the outcome timeline for a given case.
   * Mock: writes to mock/cases/:caseId/outcome-timeline.json (disk + in-memory)
   * Real: writes to case database
   */
  saveOutcomeTimeline(caseId: string, timeline: OutcomeTimeline): Promise<void>;
```

Import additions: `OutcomeTimeline` from `@denkkern/types`.

---

## Mock Adapter Changes

### `mock/adapters/mock-adapter.ts` additions

**In-memory cache:**
```typescript
const outcomeTimelineCache = new Map<string, OutcomeTimeline>();
```

**`getOutcomeTimeline(caseId)`:**
1. Check `outcomeTimelineCache` first.
2. If miss, attempt `readFileSync(this.#seedPath(caseId, 'outcome-timeline.json'))`.
3. If file does not exist (ENOENT), return `null` — timeline not yet initialized.
4. Parse, populate cache, return.

**`saveOutcomeTimeline(caseId, timeline)`:**
1. Recompute `timeline.summary` from `checkpoints` (total / confirmed / unresolved / pending).
2. Update `outcomeTimelineCache`.
3. Write to `mock/cases/:caseId/outcome-timeline.json` via `writeFileSync`.
4. Apply NTFS null-byte guard (read back + JSON.parse).

**`appendOutboundEmail(caseId, entry)`** (internal helper, Sprint 6B pattern):
- Appends to `mock/cases/:caseId/outbound-email.json` array.
- Called by `sendCheckpointTask` and `advanceReminderForCheckpoint`.

**`sendCheckpointTask(caseId, checkpointId)`:**
1. Load timeline. Find checkpoint by id.
2. Validate: status must be `'pending'`.
3. Set `status = 'sent'`, `sent_at = now`.
4. Append outbound email mock entry.
5. Save timeline.

**`advanceReminderForCheckpoint(caseId, checkpointId)`:**
1. Load timeline. Find checkpoint by id.
2. Validate: status must be `'sent'` | `'reminder_1'` | `'reminder_2'` | `'reminder_3'`.
3. Progress: `sent → reminder_1 → reminder_2 → reminder_3 → unresolved`.
4. For `reminder_1/2/3`: set `last_reminder_at = now`, increment `reminder_count`, append outbound email.
5. For `unresolved`: set status only, no email.
6. Save timeline.

**`confirmCheckpoint(caseId, checkpointId, confirmedBy, outcomeData)`:**
1. Load timeline. Find checkpoint by id.
2. Validate: status must not be `'confirmed'` or `'unresolved'`.
3. Set `status = 'confirmed'`, `confirmed_at = now`, `confirmed_by`, `outcome_data`.
4. Save timeline.

**`markCheckpointUnresolved(caseId, checkpointId)`:**
1. Load timeline. Find checkpoint by id.
2. Set `status = 'unresolved'`.
3. Save timeline.

---

## Dispatcher Consequence

### `outcome_capture_initiated` → auto-initialize timeline

The dispatcher's consequence handler for `outcome_capture_initiated` (already fires after DK-601 writes the `DecisionRecord`) gains a second consequence:

```typescript
// After writing the DecisionRecord (existing Sprint 6 code):
await adapter.saveDecisionRecord(caseId, record);

// NEW — Sprint 7: initialize the outcome timeline from checkpoint defaults
const scenarioChosen = record.decision.scenario_chosen; // e.g. "EXPEDITE"
const templates = loadCheckpointDefaults(scenarioChosen); // reads config/checkpoint-defaults.json
const checkpoints = templates.map(template => buildCheckpoint(caseId, record.id, template, record.decision.decided_at));
const timeline: OutcomeTimeline = {
  case_id: caseId,
  decision_id: record.id,
  schema_version: '1.0',
  initialized_at: new Date().toISOString(),
  checkpoints,
  summary: { total: checkpoints.length, confirmed: 0, unresolved: 0, pending: checkpoints.length },
};
await adapter.saveOutcomeTimeline(caseId, timeline);
```

`loadCheckpointDefaults` reads `config/checkpoint-defaults.json` at runtime. Falls back to `_fallback` if the scenario type has no template.

`buildCheckpoint` computes `due_at` from `decided_at + template.due_offset_days`, assigns a UUIDv4 id with the `id_prefix`, and sets all status fields to their initial values.

---

## API Endpoints

All under `app/api/cases/[caseId]/outcome-timeline/`.

### `GET /api/cases/:caseId/outcome-timeline`

Returns the current `OutcomeTimeline | null`. 200 with timeline, 200 with `{ timeline: null }` if not yet initialized, 404 if case not found.

### `POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/confirm`

Body: `{ confirmed_by: string; outcome_data: Record<string, unknown> }`

Calls `adapter.confirmCheckpoint(...)`. Returns updated `OutcomeCheckpoint`. 409 if already terminal.

### `POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/advance-reminder`

No body. Calls `adapter.advanceReminderForCheckpoint(...)`. Returns updated `OutcomeCheckpoint`. 409 if already terminal.

### `POST /api/cases/:caseId/outcome-timeline/checkpoints/:checkpointId/mark-unresolved`

No body. Forces status to `unresolved`. Returns updated `OutcomeCheckpoint`. 409 if already `confirmed`.

---

## Seed Data

### `mock/cases/CASE-001/outcome-timeline.json`

Seeded to reflect CASE-001's state: scenario `EXPEDITE`, decision date `2026-06-11`. Three checkpoints, all `pending`.

```json
{
  "_comment": "Sprint 7 seed — outcome timeline for CASE-001. Initialized on outcome_capture_initiated.",
  "case_id": "CASE-001",
  "decision_id": "07f600e6-3aac-4649-97f4-115979c21b99",
  "schema_version": "1.0",
  "initialized_at": "2026-06-11T12:01:00Z",
  "checkpoints": [
    {
      "id": "chk-op-001",
      "case_id": "CASE-001",
      "decision_id": "07f600e6-3aac-4649-97f4-115979c21b99",
      "dimension": "operational",
      "task_description": "Confirm whether the expedited shipment arrived on schedule and production was able to continue without interruption.",
      "recipient_id": "lena",
      "due_at": "2026-06-14T12:00:00Z",
      "status": "pending",
      "outcome_data": null,
      "reminder_count": 0,
      "created_at": "2026-06-11T12:01:00Z",
      "sent_at": null,
      "confirmed_at": null,
      "confirmed_by": null,
      "last_reminder_at": null
    },
    {
      "id": "chk-fin-001",
      "case_id": "CASE-001",
      "decision_id": "07f600e6-3aac-4649-97f4-115979c21b99",
      "dimension": "financial",
      "task_description": "Confirm actual expedite cost and whether it differed from the estimate shown at decision time.",
      "recipient_id": "lena",
      "due_at": "2026-06-18T12:00:00Z",
      "status": "pending",
      "outcome_data": null,
      "reminder_count": 0,
      "created_at": "2026-06-11T12:01:00Z",
      "sent_at": null,
      "confirmed_at": null,
      "confirmed_by": null,
      "last_reminder_at": null
    },
    {
      "id": "chk-biz-001",
      "case_id": "CASE-001",
      "decision_id": "07f600e6-3aac-4649-97f4-115979c21b99",
      "dimension": "business",
      "task_description": "Confirm whether any customer commitments were affected by the delay or the expedite decision.",
      "recipient_id": "lena",
      "due_at": "2026-06-25T12:00:00Z",
      "status": "pending",
      "outcome_data": null,
      "reminder_count": 0,
      "created_at": "2026-06-11T12:01:00Z",
      "sent_at": null,
      "confirmed_at": null,
      "confirmed_by": null,
      "last_reminder_at": null
    }
  ],
  "summary": {
    "total": 3,
    "confirmed": 0,
    "unresolved": 0,
    "pending": 3
  }
}
```

---

## Minimal UI

### Page: `/cases/[caseId]/outcome`

Single page, minimal. No new reusable components required in Sprint 7.

**Sections:**

1. **Timeline header** — case ID, decision date, scenario chosen, timeline status (N/M confirmed).

2. **Checkpoint list** — one card per checkpoint, sorted by `due_at` ascending. Each card shows:
   - Dimension badge (Operational / Financial / Business — different colour per dimension)
   - `task_description`
   - `due_at` (formatted, with overdue indicator if past due and not terminal)
   - `status` pill
   - Action buttons: **Confirm**, **Mark Unresolved** (only shown for non-terminal checkpoints)

3. **Confirm modal** — triggered by "Confirm" button. Fields: free-text `outcome_data.notes`. On submit: calls `POST .../confirm`.

4. **No-navigation panel** — if no terminal checkpoints exist yet, a callout: "Checkpoints will be marked as Unresolved automatically after three reminders. You can also mark them manually."

**Route is accessible from the existing case detail page** via a link in the outcome section. No new navigation items.

---

## Ticket List

| Ticket | Title | Owner | Depends on |
|---|---|---|---|
| DK-701 | Type contracts: OutcomeTimeline, OutcomeCheckpoint, CheckpointStatus | Amir | — |
| DK-702 | DataAdapter interface: getOutcomeTimeline, saveOutcomeTimeline | Amir | DK-701 |
| DK-703 | Mock adapter: getOutcomeTimeline, saveOutcomeTimeline, lifecycle helpers | Amir | DK-702 |
| DK-704 | Checkpoint defaults config (config/checkpoint-defaults.json) | Amir | — |
| DK-705 | Dispatcher consequence: auto-initialize timeline on outcome_capture_initiated | Amir | DK-703, DK-704 |
| DK-706 | API endpoints: GET timeline, POST confirm / advance-reminder / mark-unresolved | Amir | DK-703 |
| DK-707 | Minimal UI: /cases/[caseId]/outcome — checkpoint list + confirm form | Amir | DK-706 |
| DK-708 | Verification script: verify-dk-70x.mjs (≥20 checks) | Amir | DK-707 |

---

## Definition of Done

- [ ] `OutcomeTimeline`, `OutcomeCheckpoint`, `CheckpointStatus`, `OutcomeDimension` exported from `@denkkern/types`
- [ ] `DataAdapter` interface extended with `getOutcomeTimeline`, `saveOutcomeTimeline`
- [ ] `MockDataAdapter` implements all four lifecycle helpers (sendCheckpointTask, advanceReminderForCheckpoint, confirmCheckpoint, markCheckpointUnresolved)
- [ ] `mock/cases/CASE-001/outcome-timeline.json` exists and is valid
- [ ] `config/checkpoint-defaults.json` covers EXPEDITE, WAIT, PARTIAL_EXPEDITE, and `_fallback`
- [ ] `outcome_capture_initiated` consequence auto-initializes timeline from config
- [ ] All four API endpoints respond correctly (GET, confirm, advance-reminder, mark-unresolved)
- [ ] `/cases/CASE-001/outcome` renders checkpoint list, confirm flow works end-to-end in dev
- [ ] Sprint 6 verification still passes: `verify-dk-604.mjs` 39/39
- [ ] `verify-dk-70x.mjs` ≥20/20 checks pass
- [ ] `tsc --noEmit` exit 0

---

## Configurability and Revision Notes

These points ensure Domain Expert interview findings can be incorporated without rework:

- **Checkpoint templates** are in JSON (`config/checkpoint-defaults.json`), not TypeScript. Adding a new scenario type or adjusting timing requires zero TypeScript changes.
- **Dimension vocabulary** is a string union, not an enum. New dimensions discovered in interviews can be added without a type migration.
- **Recipient logic** is currently `recipient_role: "case_owner"` resolved at runtime. When interviews reveal that financial checkpoints should go to a Finance owner, change the template JSON — the types already support arbitrary `recipient_id`.
- **Reminder count** (3 by default) is hardcoded in the lifecycle helper but isolated to one function. It can become a config value in Sprint 8 without API changes.
- **`outcome_data` schema** is `Record<string, unknown>` — the UI validates it, not the type layer. Interview findings may produce structured schemas that can be layered on later.
- **Timeline → OutcomeRecord promotion** is explicitly deferred. The two structures coexist in Sprint 7. The merge logic is a Sprint 8+ decision, informed by interviews.

---

## Related Documents

- `docs/strategy/outcome-reality-model-v1.md` — canonical model this sprint implements
- `docs/sprints/sprint-7-gate.md` — validation gate (interviews now refine, not block)
- `docs/strategy/validation-operating-model.md` — v1.2
- `docs/strategy/domain-expert-candidate-list.md` — interview candidates
- `scripts/verify-dk-604.mjs` — Sprint 6 regression baseline (must stay 39/39)
- `mock/adapters/mock-adapter.ts` — base for Sprint 7 mock adapter additions
- `packages/types/src/decision-record.ts` — `OutcomeRecord` and `OutcomeDraft` (DO NOT MODIFY)
