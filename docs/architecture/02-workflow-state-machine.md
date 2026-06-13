---
title: Workflow State Machine
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - state-machine
  - workflow
  - lena-2-0
---

# 02 — Workflow State Machine

DenkKern is an event-driven operational state orchestration system. A disruption case moves through a defined sequence of states, driven by discrete trigger events. The system never skips states, never auto-advances past a human gate, and never mutates upstream data (prediction) from within downstream logic (decision).

This document defines the complete state list, per-state specifications, trigger events, transition rules, and implementation guidance for Hindu.

---

## 1. ASCII Workflow Diagram

```
[setup_not_started]
        │ setup_completed
        ▼
[setup_configured]
        │ setup_completed (monitoring enabled)
        ▼
[monitoring_active]
        │ prediction_event_received
        ▼
[disruption_detected]
        │ alert_generated (automatic, same tick)
        ▼
[alert_generated]
        │ alert_opened (Lena opens dashboard)
        ▼
[disruption_context_opened]
        │ context_confirmed (Lena reviews context)
        ▼
[scenarios_generated]
        │ scenarios_requested (automatic after context confirmed)
        ▼
[recommendation_ranked]
        │ scenario_selected (Lena selects an option)
        ▼
[decision_pending]
        │ decision_confirmed (Lena explicitly confirms)
        ▼
[decision_approved]
        │ execution_triggered
        ▼
[execution_started]
        │ execution_step_updated (step logged)
        ▼
[execution_monitoring]
        │ audit_completed
        ▼
[audit_logged]
        │ case_closed
        ▼
[closed]
```

---

## 2. Full Workflow State Definitions

---

### `setup_not_started`

**Purpose:** The case or shipment exists in the system but has not been configured with the operational context required to run the disruption workflow.

**Entry condition:** Shipment record created. No customer context, daily loss, or prediction contract attached yet.

**Exit condition:** Customer context is attached (daily loss, critical part, required delivery date, inventory state). Prediction contract location is registered.

**Allowed transitions:** → `setup_configured`

**Relevant UI screen:** Setup / Onboarding screen (shipment configuration form)

**Required data:**
- `shipment_id`
- `customer_id`
- `critical_part`
- `daily_production_loss_eur`
- `required_by` date
- `inventory.replacement_available` (bool)

**Data source type:** Mock (free version) / Real (enterprise)

---

### `setup_configured`

**Purpose:** All context required to run the workflow is in place. The system is ready to begin monitoring for disruption signals.

**Entry condition:** `setup_completed` event received. All required setup fields present and valid.

**Exit condition:** Monitoring is activated (either manually or automatically after setup).

**Allowed transitions:** → `monitoring_active`

**Relevant UI screen:** Setup confirmation / case summary screen

**Required data:** All fields from `setup_not_started` plus confirmation timestamp.

**Data source type:** Mock / Real

---

### `monitoring_active`

**Purpose:** The system is actively watching for a prediction event from James' model for this shipment. No disruption has been detected yet.

**Entry condition:** Setup confirmed. Prediction contract location registered. Polling or webhook listener active.

**Exit condition:** `prediction_event_received` — James' model emits a prediction JSON with delay signal above threshold.

**Allowed transitions:** → `disruption_detected`

**Relevant UI screen:** Shipment list / monitoring dashboard (passive state — no alert shown)

**Required data:**
- `shipment_id`
- Registered prediction contract path or API endpoint
- Delay threshold for alert trigger (e.g. `p_delay_over_3_days > 0.5`)

**Data source type:** Real (James) / Simulated (mock event in free version)

---

### `disruption_detected`

**Purpose:** A prediction event has been received with delay probability above threshold. The system has identified an active operational risk. Alert generation is immediate.

**Entry condition:** `prediction_event_received` with qualifying delay signal.

**Exit condition:** Alert record created and surfaced. Transition is automatic — no human gate here.

**Allowed transitions:** → `alert_generated`

**Relevant UI screen:** None (internal state — resolves within the same event tick)

**Required data:**
- Full prediction JSON from James (see `contracts/prediction`)
- `p_delay_over_3_days`
- `confidence_score`
- `risk_drivers[]`

**Data source type:** Real (James) / Simulated (mock prediction JSON in free version)

**Note:** Prediction data is written to the case record as immutable input at this state. No downstream layer may modify these values.

---

### `alert_generated`

**Purpose:** An alert has been created and is visible to Lena in the dashboard. The case is awaiting operator acknowledgement.

**Entry condition:** Alert record written. Notification dispatched (UI badge, email, or webhook depending on plan).

**Exit condition:** `alert_opened` — Lena opens the disruption case.

**Allowed transitions:** → `disruption_context_opened`

**Relevant UI screen:** Alert notification / dashboard alert card

**Required data:**
- Alert summary: shipment name, expected delay, delay probability, confidence score
- Timestamp of alert generation
- Link to disruption case

**Data source type:** Deterministic (derived from prediction input)

---

### `disruption_context_opened`

**Purpose:** Lena has opened the disruption case. She is reviewing the full enriched context — prediction data, ERP context, inventory state, and freight options — before requesting scenario comparison.

**Entry condition:** `alert_opened` event. Prediction data and context layer data loaded and rendered.

**Exit condition:** `context_confirmed` — Lena signals she has reviewed the context and is ready to compare scenarios.

**Allowed transitions:** → `scenarios_generated`

**Relevant UI screen:** Disruption Context screen — shows delay distribution, confidence, risk drivers, ERP context (daily loss, inventory state)

**Required data:**
- Prediction output (from James — immutable)
- ERP context: `daily_production_loss_eur`, `critical_part`, `required_by`, `inventory`
- Freight options: expedite routes, costs, estimated arrival dates
- Context confirmation timestamp

**Data source type:** Real (prediction) + Mock/Real (ERP + freight)

---

### `scenarios_generated`

**Purpose:** The scenario engine has computed all available response options with their financial cost, delay days, and risk level. The recommendation has not yet been surfaced — this is a pre-ranking state.

**Entry condition:** `scenarios_requested` event (triggered automatically when context is confirmed). Scenario engine runs against enriched context.

**Exit condition:** All scenarios computed. Scoring complete. Ready to surface recommendation.

**Allowed transitions:** → `recommendation_ranked`

**Relevant UI screen:** Loading / transitional state (brief — resolves programmatically)

**Required data:**
- Prediction input (delay days, probability distribution)
- ERP context (daily loss)
- Available options: WAIT, EXPEDITE, REPLACEMENT (at minimum)
- Per-option: `action_cost_eur`, `expected_delay_days`

**Data source type:** Deterministic (formula applied to mock/real inputs)

**Scoring formula applied here:**
```
total_expected_cost = action_cost_eur + (expected_delay_days × daily_production_loss_eur)
```

---

### `recommendation_ranked`

**Purpose:** All scenarios have been scored and ranked. The lowest-cost option is flagged as recommended. A plain-language explanation is generated. Lena can now compare options.

**Entry condition:** Scenario scoring complete. `recommended: true` set on top-ranked option. Explanation text generated.

**Exit condition:** `scenario_selected` — Lena selects a scenario (may or may not be the recommended one).

**Allowed transitions:** → `decision_pending`

**Relevant UI screen:** Scenario Comparison screen — ranked table with cost, risk level, recommended flag, and explanation

**Required data:**
- Scored scenario list
- `recommended_option_id`
- `recommendation.reason` (plain language)
- `estimated_savings_vs_waiting_eur`

**Data source type:** Deterministic

**Guard:** This state must not be reached before `scenarios_generated` is complete. Recommendation must not be shown if scenario data is partial or absent.

---

### `decision_pending`

**Purpose:** Lena has selected a scenario. The system is awaiting her explicit confirmation before any execution or record-keeping begins. This is the primary human gate.

**Entry condition:** `scenario_selected` — Lena clicks a scenario option on the comparison screen.

**Exit condition:** `decision_confirmed` — Lena explicitly confirms her selection via a confirmation dialog or approval action.

**Allowed transitions:** → `decision_approved`
- Back-transition allowed: → `recommendation_ranked` (Lena may change her selection before confirming)

**Relevant UI screen:** Decision confirmation dialog / approval screen

**Required data:**
- `selected_option_id`
- User identity (Lena's ID)
- Timestamp of selection

**Data source type:** Real (user action)

**Guard:** No execution step may begin while in `decision_pending`. The system must not interpret selection as approval.

---

### `decision_approved`

**Purpose:** Lena has explicitly confirmed her decision. The record is locked. Execution may now begin.

**Entry condition:** `decision_confirmed` event. Confirmation action received from authenticated user.

**Exit condition:** `execution_triggered` — execution layer is notified and the case transitions to active execution.

**Allowed transitions:** → `execution_started`

**Relevant UI screen:** Decision confirmed state — shows selected option, approval timestamp, and "Execution in progress" indicator

**Required data:**
- `selected_option_id`
- `approved_by` (user identity)
- `approved_at` (timestamp)
- Full decision context snapshot (prediction values, scenario costs, model version) — written to audit record at this point

**Data source type:** Real (user action) + Deterministic (audit snapshot)

**Guard:** This state transition is irreversible. Once `decision_approved`, the case cannot return to `recommendation_ranked` or `decision_pending`.

---

### `execution_started`

**Purpose:** The execution layer has been triggered. The chosen action is being carried out (or logged as manually initiated in the free version). The case is in active execution.

**Entry condition:** `execution_triggered` event. Execution record created.

**Exit condition:** At least one `execution_step_updated` event received.

**Allowed transitions:** → `execution_monitoring`

**Relevant UI screen:** Execution status screen — shows chosen action, steps, and current status

**Required data:**
- `selected_option_id`
- Execution steps (manual checklist in free version / automated workflow steps in enterprise)
- `execution_started_at`

**Data source type:** Mock (free) / Real (enterprise workflow engine)

---

### `execution_monitoring`

**Purpose:** Execution is underway. Steps are being tracked. The case remains in this state until execution is complete and the outcome is ready for audit.

**Entry condition:** First `execution_step_updated` event received.

**Exit condition:** `audit_completed` — all execution steps are closed and the audit record is finalized.

**Allowed transitions:** → `audit_logged`

**Relevant UI screen:** Execution monitoring screen — step tracker, status updates, completion indicator

**Required data:**
- Execution step list with status per step
- `last_updated_at`

**Data source type:** Mock (free) / Real (enterprise)

---

### `audit_logged`

**Purpose:** The full decision record has been written and is immutable. The audit includes: prediction input, enriched context, scenarios with scores, recommendation, decision made, who made it, when, and execution outcome.

**Entry condition:** `audit_completed` event. All execution steps closed. Audit record written.

**Exit condition:** `case_closed` — operator or system closes the case.

**Allowed transitions:** → `closed`

**Relevant UI screen:** Audit view — read-only decision record and outcome summary

**Required data:**
- Prediction snapshot (immutable — as received from James)
- Scenario scores at time of decision
- `recommended_option_id`
- `selected_option_id`
- `approved_by`, `approved_at`
- Execution steps and outcome
- `model_version`, `decision_support_version`

**Data source type:** Deterministic / Real (locked record)

**Guard:** Audit record must not be writeable after `audit_completed`. No update or delete operations permitted.

---

### `closed`

**Purpose:** The case is fully resolved. No further state transitions are possible. The record is archived and available for review.

**Entry condition:** `case_closed` event.

**Exit condition:** None — terminal state.

**Allowed transitions:** None

**Relevant UI screen:** Case archive / closed case view

**Required data:** Completed audit record.

**Data source type:** Archived

---

## 3. Trigger Events

| Event | Triggered By | Transitions From → To |
|---|---|---|
| `setup_completed` | Operator completes setup form | `setup_not_started` → `setup_configured` → `monitoring_active` |
| `prediction_event_received` | James' model / mock event emitter | `monitoring_active` → `disruption_detected` → `alert_generated` |
| `alert_opened` | Lena opens the alert | `alert_generated` → `disruption_context_opened` |
| `context_confirmed` | Lena confirms she has reviewed context | `disruption_context_opened` → `scenarios_generated` |
| `scenarios_requested` | Automatic (on context_confirmed) | `scenarios_generated` → `recommendation_ranked` |
| `scenario_selected` | Lena selects a scenario option | `recommendation_ranked` → `decision_pending` |
| `decision_confirmed` | Lena explicitly confirms selection | `decision_pending` → `decision_approved` |
| `execution_triggered` | Automatic (on decision_confirmed) | `decision_approved` → `execution_started` |
| `execution_step_updated` | Manual log (free) / workflow engine (enterprise) | `execution_started` → `execution_monitoring` |
| `audit_completed` | System (on all steps closed) | `execution_monitoring` → `audit_logged` |
| `case_closed` | Operator or system | `audit_logged` → `closed` |

---

## 4. Strict Transition Rules

These rules are inviolable. Hindu must enforce them at the state machine level, not at the UI level alone.

**Rule 1 — No recommendation before scenarios are generated**
> State `recommendation_ranked` must not be entered unless `scenarios_generated` is complete and all scenario records have a valid `total_cost_eur`.

**Rule 2 — No execution before Lena approves**
> `execution_triggered` event must only fire from `decision_approved` state. The system must not trigger execution from `decision_pending`, `scenario_selected`, or any other state.

**Rule 3 — No audit closure before execution starts**
> `audit_completed` event is only valid from `execution_monitoring`. It is invalid from `execution_started` unless at least one execution step has been updated.

**Rule 4 — Prediction data is input-only and must not be mutated**
> James' prediction JSON is written to the case record at `disruption_detected`. All downstream layers read from this snapshot. No layer may overwrite, recalculate, or discard prediction fields. If prediction is updated (e.g. James re-runs the model), it is a new event, not a mutation of the existing record.

**Rule 5 — Scoring uses deterministic logic only**
> The formula `action_cost_eur + (expected_delay_days × daily_production_loss_eur)` is the only permitted scoring method. No ML weights, learned scores, or operator-preference adjustments may be introduced without Amir + Alex alignment.

---

## 5. Implementation Notes for Hindu

### 5.1 TypeScript State and Event Types

```typescript
// Workflow states
type WorkflowState =
  | 'setup_not_started'
  | 'setup_configured'
  | 'monitoring_active'
  | 'disruption_detected'
  | 'alert_generated'
  | 'disruption_context_opened'
  | 'scenarios_generated'
  | 'recommendation_ranked'
  | 'decision_pending'
  | 'decision_approved'
  | 'execution_started'
  | 'execution_monitoring'
  | 'audit_logged'
  | 'closed';

// Trigger events
type WorkflowEvent =
  | 'setup_completed'
  | 'prediction_event_received'
  | 'alert_opened'
  | 'context_confirmed'
  | 'scenarios_requested'
  | 'scenario_selected'
  | 'decision_confirmed'
  | 'execution_triggered'
  | 'execution_step_updated'
  | 'audit_completed'
  | 'case_closed';

// Transition map
const transitions: Record<WorkflowState, Partial<Record<WorkflowEvent, WorkflowState>>> = {
  setup_not_started:          { setup_completed: 'setup_configured' },
  setup_configured:           { setup_completed: 'monitoring_active' },
  monitoring_active:          { prediction_event_received: 'disruption_detected' },
  disruption_detected:        { prediction_event_received: 'alert_generated' },
  alert_generated:            { alert_opened: 'disruption_context_opened' },
  disruption_context_opened:  { context_confirmed: 'scenarios_generated' },
  scenarios_generated:        { scenarios_requested: 'recommendation_ranked' },
  recommendation_ranked:      { scenario_selected: 'decision_pending' },
  decision_pending:           { decision_confirmed: 'decision_approved', scenario_selected: 'recommendation_ranked' },
  decision_approved:          { execution_triggered: 'execution_started' },
  execution_started:          { execution_step_updated: 'execution_monitoring' },
  execution_monitoring:       { audit_completed: 'audit_logged' },
  audit_logged:               { case_closed: 'closed' },
  closed:                     {},
};
```

### 5.2 Where State Should Live in the Frontend

- **Case-level state** (`WorkflowState`) lives in the backend database, per case record. The frontend reads it via `GET /api/cases/:caseId/state`.
- **UI state** (loading indicators, dialog open/close, selected option before confirmation) is local React state or Zustand store — it does not write to `WorkflowState`.
- The frontend must not derive workflow state from UI interactions alone. It must confirm with the backend before rendering state-dependent screens (e.g. do not render the audit screen based on a local flag; read the state from the API).
- On page load, fetch current `WorkflowState` and route to the appropriate screen. This ensures deep-link correctness and prevents state desync.

### 5.3 How Mock Events Should Simulate Live Behaviour

In the free version, James' prediction event does not fire from a live ML model. Use a mock event emitter that:

1. Reads a static prediction JSON from `mock/prediction-events/SHIP-001.json`
2. Emits a `prediction_event_received` event on a configurable delay (e.g. 3 seconds after monitoring starts, or on a manual trigger button in dev mode)
3. Passes the same payload shape as the real prediction contract

```typescript
// Mock event emitter (dev/free version)
async function emitMockPredictionEvent(shipmentId: string): Promise<void> {
  const payload = await loadMockPrediction(shipmentId); // reads from mock/
  await dispatchWorkflowEvent(shipmentId, 'prediction_event_received', payload);
}
```

Mock events must use the same `dispatchWorkflowEvent` function as real events. No separate code path for mock vs. real.

### 5.4 How Real API Events Replace Mock Events Without Changing UI Flow

The event dispatch interface is the seam. Structure it as:

```
EventSource (mock OR real)
    └── emits WorkflowEvent + payload
          └── → dispatchWorkflowEvent(caseId, event, payload)
                └── validates transition
                      └── writes new state to DB
                            └── notifies frontend (polling or websocket)
```

To upgrade from mock to real:
- Replace the mock event source with a real webhook handler or James' API polling adapter
- The payload shape must match the prediction contract (already defined in `contracts/prediction`)
- `dispatchWorkflowEvent` and all UI flows remain unchanged

The UI never knows whether the event source is mock or real. It only receives `WorkflowState` and renders accordingly.

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-25 | Initial draft — 14 states, 11 events, transition map, strict rules, TypeScript types, mock/real event seam |
