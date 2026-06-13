---
title: Component Map
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - component-map
  - frontend
  - lena-2-0
---

# 07 — Component Map

This document maps every frontend component in the Free Version to its workflow state, required data contracts, child components, user actions, and emitted events. It is the reference for Hindu during implementation and for Alex during feature scoping.

No component defines its own workflow logic. All transition rules live in the orchestration layer. Components render what they receive and emit events — nothing more.

---

## Component Hierarchy Overview

```
App
├── OnboardingSetupPage
├── MissionControlDashboard
│   ├── MetricCard (×n)
│   ├── AlertCard (×n)
│   └── WorkflowTimeline
├── AlertCenterPage
│   └── AlertCard (×n)
├── ShipmentDisruptionDetailPage
│   ├── PredictionSignalPanel
│   ├── BusinessContextPanel
│   └── WorkflowTimeline
├── DecisionRoomPage
│   ├── PredictionSignalPanel
│   ├── BusinessContextPanel
│   ├── ScenarioComparisonMatrix
│   │   └── ScenarioCard (×n)
│   ├── RecommendationCard
│   └── DecisionActionPanel
├── ExecutionMonitoringPage
│   ├── ExecutionTaskList
│   ├── StatusBadge
│   └── WorkflowTimeline
└── AuditTimelinePage
    ├── AuditEntryCard
    ├── FinancialImpactPanel
    └── WorkflowTimeline
```

---

## Part A — Page-Level Components

---

### A1. `OnboardingSetupPage`

**Purpose:** Collects the operational context required to activate disruption monitoring for a shipment. Captures shipment identity, ERP context (daily loss, critical part, required date), and inventory state. On submit, emits `setup_completed` and transitions the case to `monitoring_active`.

**Related workflow states:** `setup_not_started` → `setup_configured` → `monitoring_active`

**Required data contracts:**
- Input: `ShipmentContext` (user-provided or pre-filled from mock)
- Output: populated `ShipmentContext` written to case record

**Child components:**
- Form fields (native — no custom component needed for v1)
- `StatusBadge` — shows current setup completion state

**User actions:**
- Fill shipment details (shipment name, destination, vessel name)
- Fill operational context (daily downtime cost, critical part, required-by date)
- Toggle replacement availability; fill replacement fields if true
- Submit form → `setup_completed`

**Emitted events:**
- `setup_completed` (on form submit, after validation)

**Mock / real / simulated dependencies:**
- Free version: form may be pre-filled with Lena 2.0 demo values from `mock/erp-context/CUST-001.json`
- Enterprise: form pre-filled from ERP adapter response

**Figma reference:** `[Figma: Onboarding / Setup Screen — TBD]`

**Implementation status:** `not_started`

---

### A2. `MissionControlDashboard`

**Purpose:** The operational overview screen. Shows active cases, alert status, key operational metrics, and a timeline of recent workflow events. Entry point after login. Lena lands here when she receives an alert notification.

**Related workflow states:** All states — dashboard is persistent; surfaces alerts from `alert_generated` onwards

**Required data contracts:**
- `AlertEvent[]` — for alert cards
- `WorkflowState` per case — for status display
- `ShipmentContext` (summary fields) — for case list
- `MetricCard` data derived from active cases (counts, risk levels)

**Child components:**
- `MetricCard` — active cases, open alerts, high-risk shipments, avg delay days
- `AlertCard` — one per active alert, ordered by severity
- `WorkflowTimeline` — recent state transitions across all cases

**User actions:**
- Click `AlertCard` → navigate to `ShipmentDisruptionDetailPage` (emits `alert_opened`)
- Click case row → navigate to current workflow screen for that case

**Emitted events:**
- `alert_opened` (on AlertCard click, if alert not yet opened)

**Mock / real / simulated dependencies:**
- Mock: `mock/prediction-events/SHIP-001.json` triggers the visible alert
- Metric counts derived deterministically from case state data

**Figma reference:** `[Figma: Mission Control Dashboard — TBD]`

**Implementation status:** `not_started`

---

### A3. `AlertCenterPage`

**Purpose:** Full list of all alerts across all cases, past and present. Allows Lena to scan, filter, and open any alert. Secondary entry point to the disruption workflow.

**Related workflow states:** `alert_generated`, `disruption_context_opened`, and all later states (historical alerts remain visible)

**Required data contracts:**
- `AlertEvent[]` — full alert list
- `WorkflowState` per case — for status badge on each alert row

**Child components:**
- `AlertCard` (×n) — each alert as a card or row
- `StatusBadge` — current case state per alert

**User actions:**
- Click alert → navigate to `ShipmentDisruptionDetailPage` or `DecisionRoomPage` depending on current case state
- Filter by severity, date, status

**Emitted events:**
- `alert_opened` (if alert not yet opened when navigated to)

**Mock / real / simulated dependencies:**
- Mock: static alert list generated from mock prediction event

**Figma reference:** `[Figma: Alert Center — TBD]`

**Implementation status:** `not_started`

---

### A4. `ShipmentDisruptionDetailPage`

**Purpose:** The disruption context screen. Lena reviews the enriched view of the disruption — prediction data, ERP context, inventory state, freight options, and environmental signals — before requesting scenario comparison. This is where she confirms she understands the situation.

**Related workflow states:** `alert_generated` → `disruption_context_opened`

**Required data contracts:**
- `DisruptionContext` — full enriched context
- `AlertEvent` — for alert summary header
- `WorkflowState` — to show correct action button (`available_actions`)

**Child components:**
- `PredictionSignalPanel` — ETA, delay probability, confidence score, confidence tier label, risk drivers
- `BusinessContextPanel` — daily downtime cost, critical part, required-by date, inventory state
- `WorkflowTimeline` — case state history up to current state

**User actions:**
- Review prediction and context panels
- Click "I've reviewed the context — show me my options" → emits `context_confirmed`
- This button is only shown when `available_actions` includes `context_confirmed`

**Emitted events:**
- `context_confirmed`

**Mock / real / simulated dependencies:**
- `PredictionSignalPanel` data: Real (James) or Simulated (mock emitter)
- `BusinessContextPanel` data: Mock (free version) or Real (ERP adapter)
- Environmental signals: Simulated (mock) — shown with `(simulated)` label

**Figma reference:** `[Figma: Shipment / Disruption Detail — TBD]`

**Implementation status:** `not_started`

---

### A5. `DecisionRoomPage`

**Purpose:** The core decision screen. Lena compares all scored scenarios, reviews the recommendation, and makes her explicit decision. This page is the product. Everything before it is setup; everything after it is execution and record-keeping.

**Related workflow states:** `scenarios_generated` → `recommendation_ranked` → `decision_pending` → `decision_approved`

**Required data contracts:**
- `ScenarioResult` — all scored scenarios + recommendation
- `RecommendationResult` — recommendation panel data
- `DisruptionContext` — context summary header
- `WorkflowState` + `available_actions` — controls which actions are enabled

**Child components:**
- `PredictionSignalPanel` — compact summary (not full detail)
- `BusinessContextPanel` — compact summary
- `ScenarioComparisonMatrix` — full scenario table with all options
  - `ScenarioCard` (×n) — one per scenario
- `RecommendationCard` — highlights top-ranked option with explanation and savings
- `DecisionActionPanel` — scenario selection + confirmation gate

**User actions:**
- Review scenario cards and comparison matrix
- Select a scenario → emits `scenario_selected`
- Review selected scenario and recommendation
- Click confirm → `decision_confirmed`
- Change selection before confirming → allowed (back-transition to `recommendation_ranked`)

**Emitted events:**
- `scenario_selected`
- `decision_confirmed` (only after explicit confirmation dialog)

**Mock / real / simulated dependencies:**
- `ScenarioResult`: Deterministic (computed by scenario engine from mock/real inputs)
- `RecommendationResult`: Deterministic

**Figma reference:** `[Figma: Decision Room — TBD]`

**Implementation status:** `not_started`

---

### A6. `ScenarioComparisonPage` *(sub-view of Decision Room)*

**Purpose:** In v1, scenario comparison lives inside `DecisionRoomPage` as `ScenarioComparisonMatrix`. If the comparison view grows in complexity (e.g. side-by-side detail, drill-down per scenario), it may be promoted to its own page. For now: a named section within `DecisionRoomPage`.

**Related workflow states:** `recommendation_ranked`, `decision_pending`

**Required data contracts:**
- `ScenarioResult.scenarios[]`
- `RecommendationResult`

**Child components:**
- `ScenarioComparisonMatrix`
- `ScenarioCard` (×n)

**User actions:** See `DecisionRoomPage`

**Emitted events:** See `DecisionRoomPage`

**Figma reference:** `[Figma: Scenario Comparison — inline with Decision Room — TBD]`

**Implementation status:** `not_started`

---

### A7. `RecommendationPanel` *(sub-view of Decision Room)*

**Purpose:** Surfaces the top-ranked recommendation with plain-language explanation, estimated savings, and the fixed label: *"The system ranks and explains. Lena makes the final decision."* Lives inside `DecisionRoomPage`.

**Related workflow states:** `recommendation_ranked`, `decision_pending`

**Required data contracts:**
- `RecommendationResult`

**Child components:**
- `RecommendationCard`

**User actions:** None — read-only display. Decision action is in `DecisionActionPanel`.

**Emitted events:** None

**Figma reference:** `[Figma: Recommendation Panel — inline with Decision Room — TBD]`

**Implementation status:** `not_started`

---

### A8. `ExecutionMonitoringPage`

**Purpose:** Shows the execution task list for the approved scenario. Lena marks steps complete manually in the free version. In the enterprise version, steps may auto-advance from workflow engine events. Displays execution progress and overall status.

**Related workflow states:** `execution_started` → `execution_monitoring`

**Required data contracts:**
- `ExecutionTask` — full task with steps
- `DecisionApproval` — summary of what was decided and by whom
- `WorkflowState` + `available_actions`

**Child components:**
- `ExecutionTaskList` — step list with status controls
- `StatusBadge` — per-step status and overall task status
- `WorkflowTimeline` — full case history with execution highlighted

**User actions:**
- Mark step as `in_progress`
- Mark step as `completed`
- Add optional note to a step
- Each step update → emits `execution_step_updated`

**Emitted events:**
- `execution_step_updated` (one per step status change)

**Mock / real / simulated dependencies:**
- Step definitions: loaded from `mock/execution-steps/:scenarioId.json`
- Step status updates: Real (user actions in both free and enterprise)

**Figma reference:** `[Figma: Execution Monitoring — TBD]`

**Implementation status:** `not_started`

---

### A9. `AuditTimelinePage`

**Purpose:** Read-only view of the complete case record. Shows the full decision history — prediction received, context reviewed, scenarios computed, decision made, execution completed, outcome (if filled). Supports auditability and post-incident review.

**Related workflow states:** `audit_logged`, `closed`

**Required data contracts:**
- `AuditEntry` — complete audit record
- `ScenarioResult` — scenarios as presented at decision time
- `DecisionApproval` — decision record
- `ExecutionTask` — completed execution summary

**Child components:**
- `AuditEntryCard` — key decision facts (who, what, when, why)
- `FinancialImpactPanel` — estimated vs actual costs, savings
- `WorkflowTimeline` — full case lifecycle from setup to close
- `ScenarioComparisonMatrix` — read-only, shows scenarios as they were at decision time
- `RecommendationCard` — read-only, shows recommendation as shown to Lena

**User actions:**
- Fill outcome block (optional): `actual_arrival_at`, `actual_total_cost_eur`, `estimated_loss_avoided_eur`, `outcome_status`, `notes`
- Close case → emits `audit_case_closed`

**Emitted events:**
- `audit_case_closed`

**Mock / real / simulated dependencies:**
- All data is from locked audit record — no live adapters needed

**Figma reference:** `[Figma: Audit Timeline / History — TBD]`

**Implementation status:** `not_started`

---

## Part B — Reusable Operational Components

These components are shared across pages. Each is a pure display component: it receives props from its parent page and emits user interaction callbacks upward. No component in this section reads from global state or emits events directly to the orchestration layer.

---

### B1. `StatusBadge`

**Purpose:** Displays a `WorkflowState` or step status as a coloured badge with a human-readable label.

**Props:**
- `state: WorkflowState | "pending" | "in_progress" | "completed" | "failed"`
- `size?: "sm" | "md"`

**Used by:** `MissionControlDashboard`, `AlertCenterPage`, `ExecutionMonitoringPage`, `AuditTimelinePage`

**Mock dependency:** None — purely derived from state values

---

### B2. `AlertCard`

**Purpose:** Displays a single `AlertEvent` as a scannable card. Shows severity, shipment name, delay probability, confidence score, and time since alert.

**Props:**
- `alert: AlertEvent`
- `caseState: WorkflowState`
- `onOpen: () => void`

**Used by:** `MissionControlDashboard`, `AlertCenterPage`

**Mock dependency:** Alert data from mock prediction event

---

### B3. `MetricCard`

**Purpose:** Displays a single operational KPI as a card with a label, value, and optional trend indicator.

**Props:**
- `label: string`
- `value: string | number`
- `unit?: string`
- `trend?: "up" | "down" | "neutral"`
- `severity?: "normal" | "warning" | "critical"`

**Used by:** `MissionControlDashboard`

**Mock dependency:** Values derived deterministically from case state data

---

### B4. `WorkflowTimeline`

**Purpose:** Renders the case lifecycle as a vertical timeline of named state transitions, each with a timestamp and optional actor label. Read-only.

**Props:**
- `events: Array<{ state: WorkflowState; label: string; occurred_at: string; actor?: string }>`
- `currentState: WorkflowState`

**Used by:** `MissionControlDashboard`, `ShipmentDisruptionDetailPage`, `ExecutionMonitoringPage`, `AuditTimelinePage`

**Mock dependency:** Event timestamps from mock event log

---

### B5. `ScenarioCard`

**Purpose:** Displays a single scored scenario — name, description, cost breakdown, risk level, execution complexity, and recommended badge. Selection state is controlled by parent.

**Props:**
- `scenario: Scenario`
- `selected: boolean`
- `onSelect: (scenarioId: string) => void`
- `disabled?: boolean` — true after decision_approved

**Used by:** `ScenarioComparisonMatrix`

**Mock dependency:** Scenario data from `ScenarioResult` (deterministic)

---

### B6. `ScenarioComparisonMatrix`

**Purpose:** Renders all scenarios side-by-side or in a ranked table with total cost, risk level, execution complexity, and recommended flag. Allows Lena to select a scenario.

**Props:**
- `scenarios: Scenario[]`
- `selectedId: string | null`
- `onSelect: (scenarioId: string) => void`
- `disabled?: boolean`

**Child components:** `ScenarioCard` (×n)

**Used by:** `DecisionRoomPage`, `AuditTimelinePage` (read-only)

**Mock dependency:** Deterministic from scenario engine output

---

### B7. `RecommendationCard`

**Purpose:** Highlights the recommended scenario with reason text, estimated savings, confidence note, and the fixed decision label. Always read-only.

**Props:**
- `recommendation: RecommendationResult`

**Strict rule:** `decision_note` must always be rendered exactly as received — it is never truncated, overridden, or made configurable in the UI.

**Used by:** `DecisionRoomPage`, `AuditTimelinePage`

**Mock dependency:** Deterministic from scenario engine

---

### B8. `DecisionActionPanel`

**Purpose:** The human gate. Shows the currently selected scenario (or prompt to select one), a confirm button, and a pre-confirmation summary. Confirm button is disabled until a scenario is selected. Opens a confirmation dialog before emitting `decision_confirmed`.

**Props:**
- `selectedScenario: Scenario | null`
- `availableActions: string[]` — from orchestration layer polling
- `onConfirm: () => void`
- `onChangeSelection: () => void`
- `disabled?: boolean` — true after decision_approved

**Strict rules:**
- Confirm button only enabled when `"decision_confirmed"` is in `availableActions`
- Confirmation dialog must display the selected scenario name, total cost, and the `decision_note` string before Lena can confirm
- No auto-confirmation, no default selection, no timer

**Used by:** `DecisionRoomPage`

**Mock dependency:** None — user action

---

### B9. `ExecutionTaskList`

**Purpose:** Renders the `ExecutionTask` step list with status controls. Each step has a status selector and optional notes field. Step updates are reported upward via callback.

**Props:**
- `task: ExecutionTask`
- `onStepUpdate: (stepId: string, status: string, notes?: string) => void`
- `disabled?: boolean` — true after audit_logged

**Child components:**
- `StatusBadge` per step

**Used by:** `ExecutionMonitoringPage`

**Mock dependency:** Step definitions from `mock/execution-steps/:scenarioId.json`

---

### B10. `AuditEntryCard`

**Purpose:** Displays the key facts from an `AuditEntry` in a structured, read-only format — decision made, by whom, when, what the recommendation was, what was chosen, and outcome (if filled).

**Props:**
- `auditEntry: AuditEntry`

**Used by:** `AuditTimelinePage`

**Mock dependency:** None — reads from locked audit record

---

### B11. `PredictionSignalPanel`

**Purpose:** Displays prediction data from `PredictionOutput` — expected ETA, delay probability, confidence score with tier label, and risk drivers list. Always read-only. Shows `(simulated)` label when source is mock.

**Props:**
- `prediction: PredictionOutput`
- `confidenceTier: "HIGH" | "MEDIUM" | "LOW"`
- `compact?: boolean` — condensed version for Decision Room header

**Strict rule:** Displays prediction values only. Must not allow editing or imply that values can be changed.

**Used by:** `ShipmentDisruptionDetailPage`, `DecisionRoomPage` (compact)

**Mock dependency:** Mock prediction JSON when adapter is `mock_emitter`

---

### B12. `BusinessContextPanel`

**Purpose:** Displays the operational and ERP context — daily downtime cost, critical part, required-by date, inventory state (replacement available or not), and freight options summary.

**Props:**
- `context: ShipmentContext`
- `compact?: boolean`

**Used by:** `ShipmentDisruptionDetailPage`, `DecisionRoomPage` (compact)

**Mock dependency:** ERP mock data (`mock/erp-context/CUST-001.json`)

---

### B13. `FinancialImpactPanel`

**Purpose:** Displays financial summary — estimated total cost of chosen action, estimated savings vs. waiting, and (if filled) actual cost and outcome status. Used in the audit view to support ROI validation.

**Props:**
- `recommendation: RecommendationResult`
- `approvedScenario: Scenario`
- `outcome?: AuditEntry["outcome"]`

**Used by:** `AuditTimelinePage`

**Mock dependency:** Deterministic (from scenario scores) + optional manual outcome data

---

## Part C — Strict UI Rules

These rules apply to every component in this document. They are not defaults — they are constraints enforced during implementation review.

**Rule 1 — No component implements workflow transition rules independently.**
Components render what they receive. They do not compute whether a state transition is valid. `available_actions` comes from the orchestration layer via the polling endpoint. A button is enabled if and only if the corresponding action is in `available_actions`.

**Rule 2 — The frontend renders `available_actions`, it does not derive them.**
The frontend must not contain logic like `if (state === "recommendation_ranked") { show confirm button }`. Instead: `if (availableActions.includes("decision_confirmed")) { show confirm button }`. The state machine lives in the backend.

**Rule 3 — Scenario scoring comes from the scenario engine only.**
No component computes, adjusts, re-ranks, or re-labels scenario scores. `ScenarioCard` and `ScenarioComparisonMatrix` display `Scenario` objects exactly as received. The `recommended` flag is set by the engine — not by the UI.

**Rule 4 — Prediction values are displayed, not modified.**
`PredictionSignalPanel` is a read-only display component. No component in the frontend modifies, recalculates, or re-labels prediction fields. The `(simulated)` label is driven by the `source` field in the data — not hardcoded in the component.

**Rule 5 — Lena's approval must be explicit.**
`DecisionActionPanel` must show a confirmation dialog that names the selected scenario, its total cost, and the `decision_note` string before emitting `decision_confirmed`. No scenario is "pre-selected" on render. No timer auto-confirms a selection.

---

## Implementation Status Summary

| Component | Type | Status |
|---|---|---|
| `OnboardingSetupPage` | Page | `not_started` |
| `MissionControlDashboard` | Page | `not_started` |
| `AlertCenterPage` | Page | `not_started` |
| `ShipmentDisruptionDetailPage` | Page | `not_started` |
| `DecisionRoomPage` | Page | `not_started` |
| `ExecutionMonitoringPage` | Page | `not_started` |
| `AuditTimelinePage` | Page | `not_started` |
| `StatusBadge` | Reusable | `not_started` |
| `AlertCard` | Reusable | `not_started` |
| `MetricCard` | Reusable | `not_started` |
| `WorkflowTimeline` | Reusable | `not_started` |
| `ScenarioCard` | Reusable | `not_started` |
| `ScenarioComparisonMatrix` | Reusable | `not_started` |
| `RecommendationCard` | Reusable | `not_started` |
| `DecisionActionPanel` | Reusable | `not_started` |
| `ExecutionTaskList` | Reusable | `not_started` |
| `AuditEntryCard` | Reusable | `not_started` |
| `PredictionSignalPanel` | Reusable | `not_started` |
| `BusinessContextPanel` | Reusable | `not_started` |
| `FinancialImpactPanel` | Reusable | `not_started` |

Status values: `not_started` | `in_progress` | `complete` | `needs_review`

This table should be updated by Hindu as implementation progresses.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial draft — 9 page components, 13 reusable components, hierarchy diagram, strict UI rules, implementation status table |
