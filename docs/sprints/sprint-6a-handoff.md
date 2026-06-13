---
title: Sprint 6A Technical Handoff
sprint: 6A
status: complete
completed: 2026-06-12
author: orchestration
---

# Sprint 6A Technical Handoff

Sprint 6A is complete. This document is the authoritative handoff record for anyone beginning Sprint 6B (capture experience) or reviewing the Decision Memory loop implementation.

---

## What Was Built

Sprint 6A implements the complete Decision Memory loop backend. The loop captures every stage from decision to outcome into a durable, immutable record. No UI was added — this sprint is pure backend and data model.

```
Signal → Recommendation → Decision → DecisionRecord
       → Arrival recorded → OutcomeDraft (auto) → OutcomeRecord (confirmed)
```

---

## 1. Files Added or Changed

### New files

| File | Ticket | Purpose |
|------|--------|---------|
| `apps/web/src/lib/workflow/decision-record-writer.ts` | DK-601 | Builds and writes the immutable DecisionRecord on `decision_confirmed` |
| `apps/web/src/lib/workflow/outcome-draft-generator.ts` | DK-603 | Auto-generates `outcome-draft.json` from 4 source files |
| `apps/web/src/lib/workflow/outcome-confirmer.ts` | DK-604 | Reads draft + confirmation input, writes final OutcomeRecord into decision-record.json |
| `apps/web/src/app/api/cases/[caseId]/arrival/route.ts` | DK-602 | `POST /api/cases/:caseId/arrival` |
| `apps/web/src/app/api/cases/[caseId]/outcome-draft/route.ts` | DK-603 | `POST /api/cases/:caseId/outcome-draft` |
| `apps/web/src/app/api/cases/[caseId]/confirm-outcome/route.ts` | DK-604 | `POST /api/cases/:caseId/confirm-outcome` |
| `scripts/verify-dk-604.mjs` | DK-604 | Standalone 39-assertion verification script |

### Modified files

| File | Change |
|------|--------|
| `packages/types/src/decision-record.ts` | Added `OutcomeDraft`, `OutcomeRecord`, `ProductionImpact`, `DecisionQuality`, `PredictionAccuracyAssessment` interfaces |
| `packages/types/src/index.ts` | Exported all new types from `decision-record.ts` |
| `packages/types/src/workflow.ts` | Added `outcome_pending`, `outcome_confirmed` states; `outcome_capture_initiated`, `record_arrival`, `confirm_outcome` events; full transition wiring |
| `apps/web/src/lib/workflow/dispatcher.ts` | Added `advanceToOutcomePending()` consequence after `decision_confirmed`; wires DK-601 DecisionRecord write |

### Mock data written by verification scripts (CASE-001)

| File | Written by | Contents |
|------|-----------|---------|
| `mock/cases/CASE-001/decision-record.json` | DK-601 verify | Full DecisionRecord; currently in final confirmed state |
| `mock/cases/CASE-001/arrival-event.json` | DK-602 verify | Immutable arrival audit record |
| `mock/cases/CASE-001/outcome-draft.json` | DK-603 verify | Auto-generated system draft |

---

## 2. API Endpoints Added

### `POST /api/cases/:caseId/arrival` (DK-602)

Records actual vessel arrival date and patches the mutable `tracking` section.

**Request body**
```json
{
  "actual_arrival_date": "2026-07-01",
  "recorded_by": "lena"
}
```

**Response**
```json
{
  "case_id": "CASE-001",
  "actual_arrival_date": "2026-07-01",
  "baseline_arrival_date": "2026-06-20",
  "actual_delay_days": 11,
  "tracking_active": true,
  "recorded_at": "<ISO timestamp>"
}
```

**Notes**
- 409 if arrival already recorded
- Reads `prediction.json` for `eta.baseline`
- Patches only `tracking.actual_arrival_date` and `tracking.actual_delay_days`
- `tracking_active` stays `true` — set to `false` only by DK-604
- NTFS null-byte guard on both writes

---

### `POST /api/cases/:caseId/outcome-draft` (DK-603)

Auto-generates the outcome draft from existing case files. Idempotent — safe to call multiple times.

**Request body**: none

**Response**: full `OutcomeDraft` object

**Source files read**: `decision-record.json`, `arrival-event.json`, `prediction.json`, `scenario-evaluation.json`

**Writes**: `outcome-draft.json` (overwrites on repeat calls — no side effects on other records)

---

### `POST /api/cases/:caseId/confirm-outcome` (DK-604)

Accepts human confirmation, writes final `OutcomeRecord` into `decision-record.json`, advances workflow to `outcome_confirmed`.

**Request body**
```json
{
  "confirmed_by": "lena",
  "confirmation_channel": "api",
  "production_impact": {
    "stopped": true,
    "stopped_days": 2,
    "customer_commitment_met": false
  },
  "decision_quality": "EXCELLENT",
  "actual_cost_eur": 220000,
  "notes": "..."
}
```

Required fields: `confirmed_by`, `production_impact`, `decision_quality`

Optional fields: `confirmation_channel` (default `"api"`), `actual_cost_eur` (override; else uses draft value), `notes`

**Response**
```json
{
  "case_id": "CASE-001",
  "workflow_state": { "state": "outcome_confirmed", ... },
  "outcome": { ... OutcomeRecord ... }
}
```

**Notes**
- 409 if outcome already confirmed (idempotency guard in `outcome-confirmer.ts`)
- 404 if `decision-record.json` or `outcome-draft.json` missing
- 422 if workflow not in `outcome_pending` (via `dispatchWorkflowEvent`)
- Calls `confirmOutcome()` then `dispatchWorkflowEvent('confirm_outcome', ...)`

---

## 3. CASE-001 Test Sequence

Run these in order from repo root. Each step writes real files.

```bash
# Step 1 — Reset to clean state (DK-601 state: decision made, no arrival yet)
# (decision-record.json should already exist from DK-601 verify)
# If it doesn't: node scripts/verify-dk-601.mjs

# Step 2 — DK-602: Record arrival
# Via API (requires Next.js running):
curl -X POST http://localhost:3000/api/cases/CASE-001/arrival \
  -H "Content-Type: application/json" \
  -d '{"actual_arrival_date": "2026-07-01", "recorded_by": "lena"}'

# Or via standalone script:
node scripts/verify-dk-602.mjs

# Step 3 — DK-603: Generate outcome draft
curl -X POST http://localhost:3000/api/cases/CASE-001/outcome-draft

# Or:
node scripts/verify-dk-603.mjs

# Step 4 — DK-604: Confirm outcome
curl -X POST http://localhost:3000/api/cases/CASE-001/confirm-outcome \
  -H "Content-Type: application/json" \
  -d '{
    "confirmed_by": "lena",
    "confirmation_channel": "api",
    "production_impact": {
      "stopped": true,
      "stopped_days": 2,
      "customer_commitment_met": false
    },
    "decision_quality": "EXCELLENT",
    "notes": "Expedite worked. Arrived 3 days ahead of model prediction."
  }'

# Or (full end-to-end verify from any state):
node scripts/verify-dk-604.mjs
```

`verify-dk-604.mjs` resets to pre-confirmation state automatically, runs all 39 assertions, and leaves `decision-record.json` in the final confirmed state.

---

## 4. Expected Final Files (CASE-001)

After the full loop has run:

### `mock/cases/CASE-001/decision-record.json`

Key values in the final confirmed state:

```
id:                          07f600e6-3aac-4649-97f4-115979c21b99
schema_version:              "1.0"
created_at:                  2026-06-11T12:00:00Z
locked_at:                   null

context_snapshot:
  predicted_delay_days:      14
  prediction_confidence:     "HIGH"
  inventory_buffer_days:     3
  daily_downtime_cost_eur:   150000

decision:
  scenario_chosen:           "EXPEDITE"
  followed_recommendation:   true

tracking:
  tracking_active:           false          ← set by DK-604
  expected_arrival_date:     "2026-07-04"
  actual_arrival_date:       "2026-07-01"   ← set by DK-602
  actual_delay_days:         11             ← set by DK-602

outcome:
  status:                    "confirmed"
  confirmed_by:              "lena"
  confirmation_channel:      "api"
  is_auto_generated:         false
  prediction_error_days:     -3             ← arrived 3 days earlier than model predicted
  actual_delay_days:         11
  actual_cost_eur:           220000
  estimated_cost_avoided_eur: 1430000
  decision_quality:          "EXCELLENT"
  prediction_accuracy_assessment: "OVERESTIMATED"
                                            ← model over-forecast severity; good for pilot narrative
```

### `mock/cases/CASE-001/arrival-event.json`

Immutable audit record. Do not modify.

```
event_type:             "arrival_recorded"
actual_arrival_date:    "2026-07-01"
baseline_arrival_date:  "2026-06-20"
actual_delay_days:      11
```

### `mock/cases/CASE-001/outcome-draft.json`

Auto-generated by DK-603. Regenerated on each `POST /outcome-draft` call. Stores the system's pre-confirmation estimates. Do not manually edit — it is always overwritten.

---

## 5. Known Shortcuts and Demo-Stage Assumptions

These are deliberate Sprint 6A simplifications. They are not bugs. They are documented here so Sprint 6B and later sprints can address them without being surprised.

**Workflow state is in-memory only.** `MockDataAdapter` stores workflow state in a module-level `Map`. It seeds from `workflow-state.json` on first read but does not write back to that file. A server restart resets workflow state. Fix in Sprint 10 (persistence layer).

**`locked_at` is always `null`.** The spec says Sprint 6 pilot uses `locked_at: null`. Sprint 10 sets it to `created_at` once outcome is confirmed. Do not set it now.

**`execution` section is absent on CASE-001's DecisionRecord.** The execution field is typed as optional. No execution data is written in Sprint 6. Sprint 11 adds this.

**`confirmation_channel` defaults to `"api"`.** Sprint 6B adds `"email"` and `"ui"` as channels. The field exists and is stored — just defaults to `"api"` when the confirmation comes via the REST endpoint.

**`prediction_accuracy_assessment` uses a simple 3-tier threshold (`|error| ≤ 2 → ACCURATE`).** James's model will eventually provide a richer signal. The threshold is correct for the pilot.

**`verify-dk-604.mjs` modifies the real mock file.** The script resets `decision-record.json` to pre-confirmation state before running, then leaves it in the final confirmed state. This is intentional — the script is both a test and a state initializer. Do not run it inside a CI pipeline that expects the file to remain unchanged.

**No authentication on the confirmation endpoints.** `confirmed_by` is a free-form string — it is not validated against a user directory. Pilot assumption: Lena is the only operator.

---

## 6. What Must Not Be Touched in Sprint 6B

Sprint 6B owns the capture experience (email notification, token confirmation form, optional modal, optional dashboard indicator). The following must not change unless a verified bug is found.

**Data model — frozen**

- `DecisionRecord` interface in `packages/types/src/decision-record.ts`
- `OutcomeRecord` interface
- `OutcomeDraft` interface
- `ProductionImpact`, `DecisionQuality`, `PredictionAccuracyAssessment` types

If Sprint 6B discovers a missing field, add it as optional (`field?: type`) with a `null` default. Do not remove or rename existing fields.

**Core logic modules — read-only**

- `apps/web/src/lib/workflow/decision-record-writer.ts`
- `apps/web/src/lib/workflow/outcome-confirmer.ts`
- `apps/web/src/lib/workflow/outcome-draft-generator.ts`

Sprint 6B may call these functions. It must not modify them.

**NTFS write pattern — never bypass**

Every `writeFileSync` must be immediately followed by `readFileSync` + `JSON.parse()` (the NTFS null-byte guard). Never write to `decision-record.json` without this guard.

**Immutability contract — enforced by `outcome-confirmer.ts`**

The following sections of `DecisionRecord` are written once by DK-601 and never overwritten: `context_snapshot`, `recommendation_shown`, `decision`, `fingerprint`, `id`, `case_id`, `schema_version`, `created_at`, `locked_at`.

Any new code that writes to `decision-record.json` must use the read → patch → write pattern: spread the existing record, patch only the intended field, write back. Never construct a DecisionRecord from scratch in a patch handler.

**Verification script — must continue to pass**

Before merging any Sprint 6B PR that touches files in `apps/web/src/lib/workflow/` or `mock/cases/CASE-001/`, run:

```bash
node scripts/verify-dk-604.mjs
```

Expected: 39/39, exit 0.

---

## The Moat

What CASE-001 now preserves for the first time:

| What the system knew | `context_snapshot` — frozen at decision time |
|---|---|
| What it recommended | `recommendation_shown.top_recommendation = EXPEDITE` |
| What the human decided | `decision.scenario_chosen = EXPEDITE` (followed recommendation) |
| What actually happened | `outcome.actual_arrival_date`, `actual_delay_days`, `prediction_error_days` |
| Whether the decision was good | `outcome.decision_quality = EXCELLENT` |
| How accurate the model was | `outcome.prediction_accuracy_assessment = OVERESTIMATED` |
| Financial impact preserved | `actual_cost_eur = €220k`, `estimated_cost_avoided_eur = €1.43M` |

This is the first real record in DenkKern's learning loop. Every confirmed case from here becomes training signal for James's model and institutional memory for Lena's decisions.
