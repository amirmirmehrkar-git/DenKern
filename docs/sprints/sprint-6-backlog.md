---
title: Sprint 6 — Decision Record & Outcome Capture
version: 1.0
status: planned
date: 2026-06-11
sprint_goal: Every approved decision leaves a trace. Every resolved disruption captures an outcome.
scope: Sprint 6B (recommended) — 28 points, 10 days, 1 engineer
engineer: Amir
---

# Sprint 6 — Decision Record & Outcome Capture

## Governing Principle

> **No Sprint 6B work starts until CASE-001 successfully completes the full loop.**
>
> The goal of Sprint 6 is not user experience.
> The goal is to create the first Decision Memory record.
>
> The success criterion is not: email sent, modal shown, dashboard badge visible.
> The success criterion is: CASE-001 contains a valid immutable `DecisionRecord` and a confirmed `OutcomeRecord`.
> If that exists, DenkKern has completed its first full Signal → Decision → Outcome cycle.

---

## Sprint Goal

After Sprint 5, DenkKern can guide Lena through a decision. After Sprint 6, DenkKern remembers what she decided, tracks what actually happened, and asks her to confirm in one click.

The full loop:

```
[Sprint 5]                    [Sprint 6 adds]
Signal                        Signal
  ↓                             ↓
Context                       Context
  ↓                             ↓
Recommendation                Recommendation
  ↓                             ↓
Decision ──────────────────→  DecisionRecord (written automatically)
                                ↓
                              [vessel arrives]
                                ↓
                              Prediction error calculated
                                ↓
                              OutcomeDraft generated
                                ↓
                              [Lena receives notification]
                                ↓
                              One-click confirmation
                                ↓
                              OutcomeRecord locked ✓
```

---

## Context: What Exists After Sprint 5

**Files per case:**
```
mock/cases/CASE-XXX/
  disruption-context.json     ← full context snapshot
  workflow-state.json         ← current state machine state
  external-risk-signals.json  ← raw signals
  signal-states.json          ← accept/dismiss per signal (Sprint 5)
```

**Workflow states after Sprint 5:**
```
disruption_alert_received
→ context_open
→ context_reviewed
→ recommendation_ready
→ scenario_selected
→ awaiting_approval
→ decision_approved          ← workflow ends here
```

**What Sprint 6 adds:**
- `decision-record.json` written on `decision_approved`
- Workflow state machine continues after approval: `outcome_pending` → `outcome_confirmed`
- Vessel tracking background job continues post-decision
- Arrival notification system
- Outcome confirmation form
- Next-case modal prompt

---

## Schema

### New file: `mock/cases/CASE-XXX/decision-record.json`

```typescript
interface DecisionRecord {
  // ── Identity ────────────────────────────────────────────────────────────────
  id: string;                          // "DR-CASE001-1749644400000"
  case_id: string;                     // "CASE-001"
  industry_template: string;           // "chemical_manufacturing"
  case_type: string;                   // "maritime_supply_disruption"
  schema_version: "1.0";

  // ── Context Snapshot (immutable — written once at decision time) ────────────
  context_snapshot: {
    vessel_name: string;
    route: string;
    route_profile: string;
    destination_port: string;
    predicted_delay_days: number;
    prediction_confidence: "high" | "medium" | "low";
    inventory_buffer_days: number;
    critical_part: string;
    required_by_date: string;
    daily_downtime_cost_eur: number;
    daily_downtime_cost_source: "finance_validated" | "management_estimate" | "operator_estimate";
    replacement_available: boolean;
    replacement_cost_eur: number | null;
    replacement_lead_days: number | null;
    freight_available: boolean;
    freight_cost_eur: number | null;
    freight_lead_days: number | null;
    active_signal_count: number;
    dismissed_signal_count: number;
    highest_signal_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  };

  // ── Recommendation (immutable — what the system showed) ─────────────────────
  recommendation_shown: {
    top_recommendation: "WAIT" | "REROUTE" | "REPLACE";
    recommendation_confidence: number;              // 0–1
    ranked_scenarios: Array<{
      scenario: "WAIT" | "REROUTE" | "REPLACE";
      estimated_cost_eur: number;
      rank: number;
    }>;
  };

  // ── Human Decision (immutable — what Lena chose) ────────────────────────────
  decision: {
    scenario_chosen: "WAIT" | "REROUTE" | "REPLACE";
    followed_recommendation: boolean;              // computed: chosen === top_recommendation
    approval_required: boolean;
    approved_by: string | null;
    decided_at: string;                            // ISO timestamp
    override_reason: string | null;               // if followed_recommendation = false
  };

  // ── Tracking State (mutable until arrival) ──────────────────────────────────
  tracking: {
    tracking_active: boolean;                     // true until vessel arrives
    last_polled_at: string | null;
    expected_arrival_date: string;                // from prediction
    actual_arrival_date: string | null;           // populated when vessel arrives
    arrival_source: "ais_automatic" | "manual_entry" | null;
    arrival_recorded_at: string | null;
  };

  // ── Outcome (mutable for 30 days, then locked) ──────────────────────────────
  outcome: OutcomeRecord | null;

  // ── Execution Placeholder (Sprint 11 — null for all Sprint 6 records) ────────
  execution?: {
    status: 'not_started' | 'in_progress' | 'completed' | 'not_applicable';
    completed_at: string | null;
  } | null;

  // ── Fingerprint (for future similarity search) ──────────────────────────────
  fingerprint: {
    delay_bucket: "short_1_3" | "medium_4_7" | "long_8_14" | "critical_15_plus";
    inventory_bucket: "none_0" | "minimal_1_2" | "short_3_5" | "adequate_6_plus";
    cost_bucket: "low_sub50k" | "medium_50_150k" | "high_150_500k" | "critical_500k_plus";
    replacement_available: boolean;
    freight_available: boolean;
    route_region: "north_sea" | "english_channel" | "bay_of_biscay" | "mediterranean" | "other";
  };

  // ── Metadata ────────────────────────────────────────────────────────────────
  created_at: string;
  locked_at: string | null;                       // set 30 days after outcome confirmed
}
```

### OutcomeRecord (embedded in DecisionRecord)

```typescript
interface OutcomeRecord {
  // ── System-computed fields (never require user input) ───────────────────────
  actual_delay_days: number;                      // from AIS or manual arrival entry
  prediction_error_days: number;                  // actual - predicted (negative = better)
  recommendation_followed: boolean;               // from decision record
  estimated_cost_at_decision_eur: number;         // cost of chosen scenario at decision time
  actual_cost_estimated_eur: number | null;       // recalculated from actual delay (WAIT) or PO (REPLACE)

  // ── User-confirmed fields (required — 3 questions) ──────────────────────────
  production_impact: "line_ran_normally" | "line_slowed_down" | "line_stopped" | null;
  decision_quality: "good" | "acceptable" | "poor" | null;
  prediction_accuracy_assessment: "better_than_expected" | "about_right" | "worse_than_expected" | null;

  // ── Optional enrichment (user-supplied, not required) ───────────────────────
  actual_cost_validated_eur: number | null;       // finance-validated actual cost
  customer_delivery_affected: boolean | null;
  notes: string | null;

  // ── Metadata ─────────────────────────────────────────────────────────────────
  draft_generated_at: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  confirmation_channel: "vessel_arrival_form" | "next_case_modal" | "direct" | null;
  locked_at: string | null;
  is_auto_generated: boolean;                     // true if never confirmed by human
}
```

### Computed fingerprint helper

```typescript
function buildFingerprint(ctx: DisruptionContext): DecisionRecord['fingerprint'] {
  const delay = ctx.predicted_delay_days;
  const buffer = ctx.inventory_buffer_days ?? 0;
  const cost = ctx.daily_downtime_cost_eur;

  return {
    delay_bucket:
      delay <= 3 ? 'short_1_3' :
      delay <= 7 ? 'medium_4_7' :
      delay <= 14 ? 'long_8_14' : 'critical_15_plus',

    inventory_bucket:
      buffer === 0 ? 'none_0' :
      buffer <= 2  ? 'minimal_1_2' :
      buffer <= 5  ? 'short_3_5' : 'adequate_6_plus',

    cost_bucket:
      cost < 50000  ? 'low_sub50k' :
      cost < 150000 ? 'medium_50_150k' :
      cost < 500000 ? 'high_150_500k' : 'critical_500k_plus',

    replacement_available: ctx.replacement_available ?? false,
    freight_available:     ctx.freight_available ?? false,
    route_region: routeProfileToRegion(ctx.route_profile),
  };
}
```

---

## Workflow State Machine Changes

Add two new states after `decision_approved`:

```
decision_approved
  ↓ (automatic — DecisionRecord written, tracking begins)
outcome_pending              ← NEW: tracking vessel, awaiting outcome confirmation
  ↓ (on outcome confirmed)
outcome_confirmed            ← NEW: OutcomeRecord confirmed, case closed
```

```typescript
// Updated workflow-state.json after approval
{
  "state": "outcome_pending",
  "available_actions": ["record_arrival", "confirm_outcome"],
  "tracking_active": true,
  "decision_record_id": "DR-CASE001-1749644400000"
}
```

---

## API Changes

### New endpoints

```
POST /api/cases/:id/arrival
  Body: { actual_arrival_date: string, source: "manual_entry" }
  Effect: Records actual arrival, computes prediction_error, generates OutcomeDraft
  Returns: { decision_record_id, prediction_error_days, outcome_draft }

GET  /api/cases/:id/decision-record
  Returns: full DecisionRecord including current outcome state

PUT  /api/cases/:id/outcome
  Body: { production_impact, decision_quality, prediction_accuracy_assessment, notes? }
  Effect: Confirms OutcomeRecord, transitions state to outcome_confirmed
  Returns: { message, prediction_accuracy_grade, decision_quality_summary }

GET  /api/decisions/pending
  Returns: list of cases where outcome is null or unconfirmed
  Used by: next-case modal to check if any outcomes need attention

GET  /api/decisions/summary
  Returns: aggregate stats (total decisions, outcomes confirmed, avg prediction error)
  Used by: dashboard overview card
```

### Changed endpoints

```
POST /api/cases/:id/approve  (existing approval endpoint)
  Now also:
    1. Writes decision-record.json to case folder
    2. Transitions workflow-state to outcome_pending
    3. Sets tracking.tracking_active = true
  No breaking changes to existing callers.
```

---

## Agent Changes: Post-Decision Vessel Tracking

### Problem
The prediction adapter currently runs once at case creation. It sets `predicted_delay_days` and stops. After `decision_approved`, there is no mechanism to detect when the vessel actually arrives.

### Solution

**For the pilot (manual + mock — Sprint 6 default):**

A lightweight tracking job polls vessel status via the existing `MockPredictionAdapter`. The mock adapter already knows the vessel's predicted arrival. For the pilot, Nick or Lena triggers the "vessel arrived" action manually (via the admin UI or the direct API endpoint). The system then computes the prediction error automatically.

This is sufficient for Sprint 6 because the pilot has 1–3 cases, not thousands. Manual arrival recording is acceptable at this scale.

**For real AIS (when James enables it — Sprint 7+):**

The tracking job polls the real AIS feed at the vessel's IMO number. When the vessel's AIS status changes to "Moored" or "At Anchor" at the destination port, trigger the automatic arrival event.

### Implementation

```typescript
// packages/engine/src/tracking/vessel-arrival-tracker.ts

interface TrackingJob {
  case_id: string;
  vessel_name: string;
  destination_port: string;
  expected_arrival: string;
  prediction_adapter: PredictionAdapter;
}

class VesselArrivalTracker {
  private jobs: Map<string, TrackingJob> = new Map();

  // Called when a decision is approved
  startTracking(caseId: string, context: DisruptionContext): void {
    this.jobs.set(caseId, {
      case_id: caseId,
      vessel_name: context.vessel_name,
      destination_port: context.destination_port,
      expected_arrival: context.expected_arrival_date,
      prediction_adapter: this.adapter
    });
  }

  // Called by the polling interval OR by manual arrival endpoint
  async recordArrival(
    caseId: string,
    actualArrivalDate: string,
    source: 'ais_automatic' | 'manual_entry'
  ): Promise<void> {
    const record = readDecisionRecord(caseId);
    if (!record || !record.tracking.tracking_active) return;

    const predictedDays = record.context_snapshot.predicted_delay_days;
    const originalDeparture = record.context_snapshot.required_by_date; // or voyage start
    const actualDelayDays = computeActualDelay(actualArrivalDate, record.tracking.expected_arrival_date);

    // Update tracking
    record.tracking.actual_arrival_date = actualArrivalDate;
    record.tracking.arrival_source = source;
    record.tracking.arrival_recorded_at = new Date().toISOString();
    record.tracking.tracking_active = false;

    // Generate outcome draft
    record.outcome = buildOutcomeDraft(record, actualDelayDays);

    writeDecisionRecord(caseId, record);

    // Fire arrival event → triggers notification
    await this.onVesselArrived(caseId, record);
  }

  private buildOutcomeDraft(
    record: DecisionRecord,
    actualDelayDays: number
  ): OutcomeRecord {
    const predictionError = actualDelayDays - record.context_snapshot.predicted_delay_days;
    const estimatedActualCost = record.decision.scenario_chosen === 'WAIT'
      ? actualDelayDays * record.context_snapshot.daily_downtime_cost_eur
      : record.recommendation_shown.ranked_scenarios
          .find(s => s.scenario === record.decision.scenario_chosen)
          ?.estimated_cost_eur ?? null;

    return {
      actual_delay_days: actualDelayDays,
      prediction_error_days: predictionError,
      recommendation_followed: record.decision.followed_recommendation,
      estimated_cost_at_decision_eur:
        record.recommendation_shown.ranked_scenarios[0].estimated_cost_eur,
      actual_cost_estimated_eur: estimatedActualCost,

      // User confirms these — null until confirmed
      production_impact: null,
      decision_quality: null,
      prediction_accuracy_assessment: null,
      actual_cost_validated_eur: null,
      customer_delivery_affected: null,
      notes: null,

      draft_generated_at: new Date().toISOString(),
      confirmed_at: null,
      confirmed_by: null,
      confirmation_channel: null,
      locked_at: null,
      is_auto_generated: true
    };
  }
}
```

---

## UX Flow 1 — Vessel Arrival Notification

Triggered automatically when `recordArrival()` fires.

### Email notification

```
Subject: MV Helene arrived — quick outcome update for CASE-001

Hi Lena,

Good news: MV Helene arrived at Hamburg on June 18th.
We predicted June 20th — that's 2 days earlier than expected. ✓

One quick question to close this case:

Was your production affected?

  ○  Line ran normally
  ○  Line slowed down
  ○  Line stopped

[Confirm outcome →]   (single link, opens a token-authenticated form)

---
This takes 60 seconds. Your response helps DenkKern improve
future predictions for your operations.

— DenkKern
```

### Token-authenticated outcome confirmation form

Route: `/confirm/:token` — a short-lived token (7 days) that links directly to the case outcome form. No login required.

```
┌──────────────────────────────────────────────────────────┐
│  DenkKern — CASE-001 Outcome Confirmation                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  MV Helene · Hamburg · June 18th                        │
│  Predicted: June 20th   Actual: June 18th               │
│  Prediction: 2 days better than expected ✓              │
│                                                          │
│  Decision: REPLACE — Alternative supplier (Bavaria)     │
│  Cost estimate at decision time: €68,400                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Was your production affected?          [required]       │
│                                                          │
│  ○  Line ran normally                                    │
│  ○  Line slowed down                                     │
│  ○  Line stopped                                         │
│                                                          │
│  Was this the right decision in hindsight?  [required]  │
│                                                          │
│  ○  Yes                                                  │
│  ○  Probably                                             │
│  ○  No — we should have done something different        │
│                                                          │
│  Notes (optional):                                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│              [ Save and close this case ]               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### After submission — prediction accuracy debrief

```
┌──────────────────────────────────────────────────────────┐
│  ✓  Outcome recorded — thank you.                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  CASE-001 · MV Helene · Prediction accuracy             │
│                                                          │
│  Predicted delay:   7 days                              │
│  Actual delay:      5 days                              │
│  Error:             2 days early                        │
│                                                          │
│  Your decision: REPLACE ✓                               │
│  System recommendation: REPLACE ✓                       │
│  Decision matched recommendation: Yes                   │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Estimated cost at decision:  €68,400                   │
│  Estimated actual cost:       €68,400 (same scenario)   │
│                                                          │
│  This outcome has been added to your decision history.  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## UX Flow 2 — Next-Case Outcome Confirmation Modal

Triggered when Lena opens the new case intake form and `GET /api/decisions/pending` returns at least one unconfirmed outcome.

### Condition check

```typescript
// In the new case creation flow, before rendering the intake form:
const pending = await fetch('/api/decisions/pending');
if (pending.count > 0) {
  showOutcomeModal(pending.records[0]); // Show one at a time, oldest first
}
```

### Modal design

```
┌──────────────────────────────────────────────────────────┐
│  Before we start: quick update on CASE-001              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  MV Helene arrived June 18th                            │
│  (Predicted: June 20th — 2 days earlier ✓)             │
│                                                          │
│  Decision: REPLACE — Alternative supplier               │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Was your production affected?                          │
│  ○  Line ran normally                                   │
│  ○  Line slowed down                                    │
│  ○  Line stopped                                        │
│                                                          │
│  Was this the right call?                               │
│  ○  Yes   ○  Probably   ○  No                          │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  [ Save and start new case ]      [ Skip for now ]     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Skip for now:** marks the modal as dismissed for this session. Shows again on next login if still unconfirmed.

**Save and start:** confirms the outcome, dismisses modal, proceeds to new case intake.

---

## User Stories and Acceptance Criteria

### DK-601 — Write DecisionRecord on approval
**Story:** As the system, when a decision is approved, automatically write a `decision-record.json` to the case folder so every decision is permanently recorded.

**Points:** 3

**AC:**
- [ ] `decision-record.json` is created in `mock/cases/CASE-XXX/` immediately on decision approval
- [ ] File contains full `context_snapshot` (all fields from `DisruptionContext`)
- [ ] File contains `recommendation_shown` with ranked scenarios and top recommendation
- [ ] File contains `decision.followed_recommendation` computed correctly
- [ ] File contains `tracking.tracking_active = true` and `expected_arrival_date`
- [ ] File contains computed `fingerprint` with all 6 bucket fields
- [ ] Existing approval API returns unchanged (non-breaking)
- [ ] NTFS write verification guard applied (same pattern as `disruption-context.json`)

**Technical notes:**
- Entry point: the existing approval handler. Locate where `workflow-state.json` is written for `decision_approved` and write `decision-record.json` in the same function.
- The context snapshot is built from `disruption-context.json` — read it, extract the fields defined in `DecisionRecord.context_snapshot`.
- `recommendation_shown` comes from the last `ScenarioEvaluation[]` output — this needs to be passed through to the approval handler or read from a temp file.

**Risk:** `recommendation_shown` data may not be easily available at the approval handler if it's not persisted between the recommendation step and the approval step. If so, write a `pending-recommendation.json` at scenario selection time and read it at approval.

---

### DK-602 — Manual vessel arrival endpoint
**Story:** As Nick (during the pilot), I can record that a vessel has arrived so the system can compute the prediction error and generate the outcome draft.

**Points:** 2

**AC:**
- [ ] `POST /api/cases/:id/arrival` accepts `{ actual_arrival_date: string, source: "manual_entry" }`
- [ ] Sets `tracking.actual_arrival_date` and `tracking.tracking_active = false`
- [ ] Computes `actual_delay_days` correctly (handles both earlier and later than expected)
- [ ] Generates `OutcomeDraft` with all auto-computable fields populated
- [ ] Sets `outcome.is_auto_generated = true`, all user-confirmable fields = `null`
- [ ] Transitions `workflow-state.json` to `outcome_pending`
- [ ] Returns `{ decision_record_id, actual_delay_days, prediction_error_days, outcome_draft }`
- [ ] 404 if case does not exist or tracking is not active

**Technical notes:**
- `actual_delay_days` = days between original predicted arrival and actual arrival. Must handle negative values (arrived early).
- For the computation: parse both dates, compute difference in whole days. `Math.round((actual - predicted) / 86400000)` — round to nearest day.
- Estimated actual cost for WAIT: `actual_delay_days × daily_downtime_cost_eur`. For REPLACE/REROUTE: use the `estimated_cost_eur` from the chosen scenario (cost already paid, not delay-based).

---

### DK-603 — Generate outcome draft on arrival
**Story:** As the system, when a vessel arrives, automatically generate a pre-filled outcome draft with all system-computable fields so Lena only needs to confirm 3 questions.

**Points:** 2

**AC:**
- [ ] `OutcomeRecord` is written to `decision-record.json` with system-computable fields filled
- [ ] `actual_delay_days` correct
- [ ] `prediction_error_days` correct (actual_delay - predicted_delay)
- [ ] `recommendation_followed` correct (from `decision.followed_recommendation`)
- [ ] `estimated_cost_at_decision_eur` correct (cost of chosen scenario at decision time)
- [ ] `actual_cost_estimated_eur` populated for WAIT scenario (delay × daily cost), null for REPLACE/REROUTE
- [ ] All user-confirmable fields (`production_impact`, `decision_quality`, `prediction_accuracy_assessment`) = `null`
- [ ] `draft_generated_at` populated with ISO timestamp
- [ ] `is_auto_generated = true`

---

### DK-604 — Outcome confirmation endpoint
**Story:** As Lena, I can confirm or correct the pre-filled outcome in 3 fields via API so the outcome record is validated and locked.

**Points:** 2

**AC:**
- [ ] `PUT /api/cases/:id/outcome` accepts `{ production_impact, decision_quality, prediction_accuracy_assessment, notes? }`
- [ ] Updates `OutcomeRecord` with confirmed fields
- [ ] Sets `confirmed_at`, `confirmed_by`, `confirmation_channel`
- [ ] Sets `is_auto_generated = false`
- [ ] Transitions workflow state to `outcome_confirmed`
- [ ] Returns `{ prediction_error_days, prediction_accuracy_grade, decision_quality_summary }`
- [ ] `prediction_accuracy_grade` computed: |prediction_error_days| ≤ 1 = "excellent", ≤ 3 = "good", ≤ 5 = "acceptable", > 5 = "needs_review"
- [ ] 400 if `production_impact` or `decision_quality` is missing
- [ ] 409 if outcome already confirmed

---

### DK-605 — Token-authenticated outcome confirmation form
**Story:** As Lena, I can confirm an outcome from a link in an email — no login required — so the friction of outcome capture is minimal.

**Points:** 3

**AC:**
- [ ] `GET /confirm/:token` serves a static HTML form pre-filled with outcome draft data
- [ ] Token is generated on draft creation, stored in `decision-record.json`, expires 7 days
- [ ] Form shows: vessel name, arrival date, prediction accuracy, decision made, estimated cost
- [ ] Form requires 3 fields: production_impact (radio), decision_quality (radio), notes (optional textarea)
- [ ] Submission calls `PUT /api/cases/:id/outcome` internally
- [ ] After submission: shows prediction accuracy debrief (vessel arrived X days early/late, cost estimate vs. actual)
- [ ] Form works on mobile (no JS dependencies required — pure HTML form POST)
- [ ] Expired tokens show: "This outcome link has expired. Please log in to record the outcome."
- [ ] Used token cannot be reused (one-time confirmation)

**Technical notes:**
- Token: `crypto.randomBytes(32).toString('hex')` — stored in `decision-record.json` as `confirmation_token` and `confirmation_token_expires_at`
- The form must be a server-rendered HTML page, not a React SPA. It must work without JavaScript for maximum mobile compatibility. A `<form action="/confirm/:token" method="POST">` that submits to a redirect is sufficient.
- Prediction accuracy debrief: show in the response page after form POST.

---

### DK-606 — Vessel arrival email notification
**Story:** As Lena, when the vessel arrives I receive an email with a one-click link to confirm the outcome so I do not need to remember to return to the platform.

**Points:** 3

**AC:**
- [ ] Email sent within 5 minutes of `recordArrival()` being called
- [ ] Email subject: "MV [vessel_name] arrived — quick outcome update for [case_id]"
- [ ] Email body includes: actual vs. predicted arrival, prediction accuracy assessment, decision made
- [ ] Email contains exactly one call-to-action link: `/confirm/:token`
- [ ] Confirmation token in email is same as the one in `decision-record.json`
- [ ] Email is sent to the `case_owner_email` field (set at case creation time)
- [ ] If `case_owner_email` is not set, log a warning but do not crash
- [ ] SMTP configuration via environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`)
- [ ] For local development: use `nodemailer` with console transport (logs email to stdout, no actual send)

**Technical notes:**
- Use `nodemailer` — already available in the Node ecosystem, zero new infrastructure.
- Console transport for local/pilot: `nodemailer.createTransport({ jsonTransport: true })` — logs the email JSON to stdout. No external service needed.
- For the actual pilot, configure SMTP with a simple Gmail app password or Resend free tier.
- The `case_owner_email` field must be added to `DisruptionContext` / intake form (1 field, already implicit in the pilot — Nick's email or Lena's email).

---

### DK-607 — Next-case outcome confirmation modal
**Story:** As Lena, when I start a new disruption case, I am shown a brief outcome confirmation for any unresolved previous case so outcome capture happens naturally within my workflow.

**Points:** 5

**AC:**
- [ ] `GET /api/decisions/pending` returns list of cases where `outcome.confirmed_at == null`
- [ ] When the new case intake form loads, frontend calls `GET /api/decisions/pending`
- [ ] If pending outcomes exist, show modal before intake form
- [ ] Modal shows one pending case at a time (oldest `decision_approved` first)
- [ ] Modal is pre-filled with system-inferred outcome draft
- [ ] Modal requires same 3 fields as the confirmation form
- [ ] "Save and start new case" confirms outcome + proceeds to intake
- [ ] "Skip for now" dismisses modal for this session (does not confirm outcome)
- [ ] If Lena skips 3 times, modal stops showing for that case (avoid nagging)
- [ ] Modal is accessible: works with keyboard navigation

**Technical notes:**
- Modal skip counter: store in `sessionStorage` client-side. After 3 skips, add `dismissed: true` flag to the `decision-record.json` (via `PUT /api/cases/:id/outcome/dismiss`). This prevents repeated prompting.
- The modal must be added to the new case intake route in the frontend. This is the highest-effort story in this sprint — the frontend routing change has the most moving parts.

---

### DK-608 — Prediction accuracy debrief after confirmation
**Story:** As Lena, after I confirm an outcome, I see a brief accuracy report so I understand how well the system predicted the outcome and feel rewarded for recording it.

**Points:** 2

**AC:**
- [ ] Shown immediately after outcome confirmation (both via email form and next-case modal)
- [ ] Shows: predicted delay, actual delay, prediction error in days
- [ ] Shows: accuracy grade (Excellent ≤1 day / Good ≤3 days / Acceptable ≤5 days / Needs review >5 days)
- [ ] Shows: whether decision matched recommendation (Yes/No)
- [ ] Shows: estimated cost at decision time vs. estimated actual cost
- [ ] Displayed inline (not a new page) in the email form; displayed in-modal for the next-case flow
- [ ] Language is positive and informative, never judgmental: "2 days better than expected" not "error: -2"

---

### DK-609 — Pending outcomes indicator in dashboard
**Story:** As Thomas (Plant Director), I can see how many disruption decisions are awaiting outcome confirmation so I can follow up with Lena if needed.

**Points:** 3

**AC:**
- [ ] Dashboard shows a count badge: "X decisions awaiting outcome"
- [ ] Clicking the badge opens a list of pending cases
- [ ] List shows: case ID, decision made, decision date, vessel name, days since decision
- [ ] Thomas can see each case's decision record (read-only)
- [ ] If 0 pending outcomes: badge hidden or shows "All outcomes recorded ✓"
- [ ] Badge updates in real time (or on page refresh)

---

## Sprint 6 Scope

> **Restructured after Principal Engineer review (2026-06-11).**
> Sprint 6 is now two sequential phases. Phase B does not start until Phase A's Definition of Done is met.
> A `DecisionRecord` confirmed by Nick via API is structurally identical in value to one confirmed by Lena via email.
> The priority is to close the loop once. UX comes after the data exists.

---

### Sprint 6A — Core Decision Loop (9 points, ~4 days)

**Phase A Definition of Done:**
`CASE-001` contains a complete immutable `DecisionRecord` and a confirmed `OutcomeRecord`.
The full loop executes end-to-end:
`Signal → Recommendation → Approval → Arrival → Outcome Draft → Confirmation → Decision Memory`

Confirmation in Phase A is via direct API call (Postman, curl, or a raw "Confirm Outcome" button).
No email. No token form. No modal. No dashboard badge.

| Story | Points | Day |
|-------|--------|-----|
| DK-601 — Write DecisionRecord on approval | 3 | Day 1 |
| DK-602 — Manual vessel arrival endpoint | 2 | Day 2 |
| DK-603 — Generate outcome draft on arrival | 2 | Day 2 |
| DK-604 — Outcome confirmation endpoint | 2 | Day 3 |
| **Total** | **9** | |

**Day 4** is integration testing for Phase A: run the full loop against CASE-001 and verify the output file. Fix gaps before Phase B begins.

---

### Sprint 6B — Capture UX (19 points, ~6 days)

**Starts only after Phase A Definition of Done is confirmed.**
These stories improve the capture rate and user experience. None of them change the data structure.

| Story | Points | Added value |
|-------|--------|------------|
| DK-605 — Token-authenticated confirmation form | 3 | Lena can confirm without login |
| DK-606 — Vessel arrival email notification | 3 | Pull-based trigger for Lena |
| DK-608 — Prediction accuracy debrief | 2 | Reward loop after confirmation |
| DK-607 — Next-case modal | 5 | Natural workflow capture trigger |
| DK-609 — Dashboard pending indicator | 3 | Governance visibility for Thomas |
| IndustryTemplate interface skeleton | 3 | Sprint 8 prerequisite — defer if 6B is under pressure |
| **Total** | **19** | |

**Note on DK-609 and IndustryTemplate:** These are the first stories to cut if Phase B runs over. DK-609 (dashboard badge) adds no loop value at 3 cases. IndustryTemplate is internal infrastructure with no demo impact.

---

### What does NOT belong in Sprint 6

These are wrong for Sprint 6, regardless of available time:

- AIS automatic polling (James enablement required — Sprint 7)
- `locked_at` enforcement — scheduler, lazy lock, or cron (field exists in schema; `null` is correct for pilot stage)
- Token index / lookup optimization (glob scan of 3 files costs nothing)
- Slack notification channel (Sprint 11)
- ERP read integration (first enterprise customer — Sprint 9+)
- Decision similarity search (requires 20+ outcome records)
- Learning layer analysis (requires 50+ outcome records)
- Multi-case outcome bulk confirmation
- Outcome editing after lock (governance concern — flag for Sprint 8)

---

## Day 1 Investigation Checklist

Before writing a single line of Sprint 6 implementation, Amir must resolve four unknowns. These are gates, not nice-to-haves. Getting any of them wrong makes the first `DecisionRecord` incorrect, and the schema is immutable after first write.

**Investigation 1 — `recommendation_shown` persistence (blocks DK-601)**

Find where `ScenarioEvaluation[]` output currently lives after the recommendation step. Trace the execution path:
```
scenario engine → recommendation → UI → approval handler
```
If the ranked scenarios with `estimated_cost_eur` are not written to disk between these steps, the approval handler cannot populate `recommendation_shown`.

**Resolution:** If not persisted → add `pending-recommendation.json` written at scenario selection time, read at approval. This is a prerequisite for DK-601 itself.

**Investigation 2 — `predicted_delay_days` reference date (blocks DK-602)**

Before implementing `computeActualDelay()`, confirm with James in writing:

> Is `predicted_delay_days` measured from: (a) original scheduled departure, (b) case notification date, or (c) `required_by_date`?

The answer determines what `expected_arrival_date` means in `tracking` and therefore whether `prediction_error_days` is correct. Write the answer as a code comment at the top of `computeActualDelay()`.

**Investigation 3 — `route_profile` actual values (blocks `buildFingerprint()`)**

Open `mock/cases/CASE-001/disruption-context.json` and read the exact value of `route_profile`. Write `routeProfileToRegion()` to match real data in the file, not assumed data. If the value is ambiguous, default to `'other'` explicitly and document it.

**Investigation 4 — `outcome_pending` state in frontend (blocks Day 4 integration test)**

Search the frontend for every place that branches on `workflow-state.json` state. Confirm that adding `outcome_pending` and `outcome_confirmed` will not cause a blank or broken case detail view. If the frontend has a `switch` or `if/else` on state that does not handle unknown values gracefully, add a default fallback before Day 1 ends.

---

## Implementation Order (Revised)

### Phase A — Core Loop (Days 1–4)

**Day 1 (morning):** Run the four Day 1 investigations above. Write `pending-recommendation.json` if needed. (~2–3 hrs)

**Day 1 (afternoon):** DK-601 — DecisionRecord on approval. Entry point: the existing approval handler. Write `decision-record.json` in the same function as `workflow-state.json`. Apply NTFS write guard. (~3–4 hrs)

**Day 2:** DK-602 + DK-603 — Arrival endpoint + outcome draft. These are coupled: one function triggers the other. Define `computeActualDelay()` using the confirmed reference date from Investigation 2. (~6 hrs)

**Day 3:** DK-604 — Outcome confirmation endpoint + state transition to `outcome_confirmed`. Add 409 for already-confirmed case. (~4 hrs)

**Day 4:** Full loop integration test on CASE-001. Run: approve → POST /arrival → PUT /outcome → read `decision-record.json`. Verify all fields. Fix gaps. If CASE-001 predates Sprint 6 deploy, create a fresh test case. Phase A is done when the output file matches the schema exactly.

### Phase B — Capture UX (Days 5–10, only if Phase A is confirmed complete)

**Day 5:** DK-605 — Token form. Server-rendered HTML only, no React. Check CSRF middleware and exempt `/confirm/:token` POST route explicitly.

**Day 6:** DK-606 — Email via nodemailer console transport. Add `case_owner_email` to intake form and backfill CASE-001 on this day (not earlier). Wire real SMTP before the Nick dry run.

**Day 6 afternoon:** DK-608 — Prediction accuracy debrief on form submission.

**Days 7–8:** DK-607 — Next-case modal. Hard timebox. Defer to Sprint 7 if it slips.

**Day 9:** DK-609 + IndustryTemplate skeleton (if time permits). These are the first cuts.

**Day 10:** Nick dry run. Full flow from new case creation through outcome confirmation without engineering involvement.

---

## Sprint 6 Exit Criteria

### Phase A criteria (required)
- [ ] `decision-record.json` exists in `mock/cases/CASE-001/` after approval
- [ ] All schema fields populated correctly — context_snapshot, recommendation_shown, decision, tracking, fingerprint
- [ ] `POST /api/cases/:id/arrival` records arrival and generates OutcomeDraft with correct `prediction_error_days`
- [ ] `PUT /api/cases/:id/outcome` confirms outcome, transitions to `outcome_confirmed`, returns accuracy grade
- [ ] `is_auto_generated` transitions from `true` to `false` on confirmation
- [ ] NTFS write guard applied to all three write operations (initial record, arrival update, outcome confirmation)
- [ ] `readDecisionRecord → patch → writeDecisionRecord` pattern used for all post-creation writes
- [ ] `prediction_error_days` reference date confirmed with James and documented in code comment

### Phase B criteria (required only if Phase B was built)
- [ ] `/confirm/:token` form works on mobile without JavaScript
- [ ] Email notification sent on vessel arrival (console transport for local, real SMTP for dry run)
- [ ] Next-case modal appears when a pending outcome exists
- [ ] Nick can record a vessel arrival and trigger the outcome email without engineering involvement
- [ ] Lena (or Nick acting as Lena) can confirm an outcome in under 90 seconds via the email link

### Pilot readiness criteria (required regardless of phase)
- [ ] CASE-001 has a complete `decision-record.json` with all schema fields
- [ ] CASE-001 has a confirmed `outcome` record — production_impact, decision_quality, and prediction_accuracy_grade populated
- [ ] Outcome capture flow is included in Nick's pilot checklist

---

## Risk Register for Sprint 6

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `recommendation_shown` not persisted at approval time | Medium | Blocks DK-601 | Day 1 Investigation 1. If not persisted, write `pending-recommendation.json` at scenario selection before any other Sprint 6 work. |
| `actual_delay_days` reference date ambiguous | Medium | Wrong `prediction_error_days` forever (immutable field) | Day 1 Investigation 2. Get written answer from James. Document in code. Do not start DK-602 without this. |
| `outcome_pending` state breaks frontend case detail view | High | First bug discovered on demo day | Day 1 Investigation 4. Audit all workflow-state branches. Add fallback before writing any code. |
| DK-607 (next-case modal) frontend routing complexity | High | Phase B slip | Hard 2-day timebox. Cut to Sprint 7 if it slips — Phase A is the sprint success condition. |
| Email SMTP setup underestimated | Medium | Nick dry run has no real email | Start SMTP configuration on Day 6 alongside DK-606. Gmail app password takes 30 min; Resend DNS propagation can take hours. Do not leave for Day 10. |

---

*Document owner: Claude / Platform Architect + Engineering Lead*
*Sprint restructured: 2026-06-11 — Phase A (core loop) gates Phase B (capture UX)*
*Previous sprint: Sprint 5B (pilot readiness)*
*Next sprint: Sprint 7 (second customer + pattern extraction)*
*Key dependency: Sprint 6 Phase A must be complete before any UX work begins. Schema is immutable after first record — resolve all Day 1 investigations before writing code.*
