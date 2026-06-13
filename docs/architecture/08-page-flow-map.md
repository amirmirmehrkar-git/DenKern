---
title: Page Flow Map
type: architecture
project: DenkKern
status: draft
version: 1.0
updated: 2026-05-25
owner: Amir
tags:
  - denkkern
  - architecture
  - page-flow
  - routing
  - navigation
  - lena-2-0
---

# 08 — Page Flow Map

This document defines the navigation architecture for the DenkKern Free Version. It maps every route to its workflow states, required data, navigation rules, redirect logic, and fallback behaviour. It is the implementation reference for Hindu when building the Next.js routing layer.

The routing layer enforces no business logic. Its only job is to redirect users to the correct page for the current `WorkflowState` and block access to pages that require state that does not yet exist.

---

## 1. Route Map Overview

```
/setup                          ← case initialisation
/dashboard                      ← operational overview (home)
/alerts                         ← alert list
/shipments/:shipmentId          ← disruption context review
/decision-room/:caseId          ← scenario comparison + decision
/execution/:caseId              ← execution monitoring
/audit/:caseId                  ← audit record + outcome
/reports/:reportId              ← (reserved — not active in v1 MVP)
```

---

## 2. WorkflowState → Primary Route Mapping

This is the canonical mapping. When the system needs to redirect a user to "wherever they should be" for a case, it uses this table.

| WorkflowState | Primary Route |
|---|---|
| `setup_not_started` | `/setup` |
| `setup_configured` | `/setup` (confirmation step) |
| `monitoring_active` | `/dashboard` |
| `disruption_detected` | `/dashboard` (alert appears in feed) |
| `alert_generated` | `/dashboard` or `/alerts` |
| `disruption_context_opened` | `/shipments/:shipmentId` |
| `scenarios_generated` | `/decision-room/:caseId` |
| `recommendation_ranked` | `/decision-room/:caseId` |
| `decision_pending` | `/decision-room/:caseId` |
| `decision_approved` | `/decision-room/:caseId` → redirect to `/execution/:caseId` |
| `execution_started` | `/execution/:caseId` |
| `execution_monitoring` | `/execution/:caseId` |
| `audit_logged` | `/audit/:caseId` |
| `closed` | `/audit/:caseId` (read-only) |

---

## 3. ASCII Navigation Flow

```
/setup
  │  setup_completed
  ▼
/dashboard ◄──────────────────────────────────────────────┐
  │  alert clicked / case opened                          │
  ▼                                                       │
/alerts (optional intermediate)                           │
  │  alert opened                                         │
  ▼                                                       │
/shipments/:shipmentId                                    │
  │  context_confirmed                                    │
  ▼                                                       │
/decision-room/:caseId                                    │
  │  decision_approved                                    │
  ▼                                                       │
/execution/:caseId                                        │
  │  audit_completed                                      │
  ▼                                                       │
/audit/:caseId                                            │
  │  case_closed                                          │
  └──────────────────────────────────────────────────────┘
         (returns to dashboard with case archived)
```

---

## 4. Per-Route Specifications

---

### Route: `/setup`

**Page component:** `OnboardingSetupPage`
**Purpose:** Capture shipment and ERP context to activate disruption monitoring for a new case.

**Related workflow states:** `setup_not_started`, `setup_configured`

**Required data contracts:**
- Input: none (new case) or pre-filled `ShipmentContext` mock
- Output: `ShipmentContext` written to case on submit

**Allowed user actions:**
- Fill and submit setup form → emits `setup_completed`

**Emitted events:** `setup_completed`

**Redirect rules:**
- On successful submit → redirect to `/dashboard`
- If user navigates here when case already exists in `monitoring_active` or beyond → redirect to current state route (see Section 2)

**Unavailable-state behaviour:** Always accessible for creating a new case. For an existing case ID, redirects away if state is past `setup_configured`.

**Mock / real data dependencies:**
- Free version: form pre-filled from `mock/erp-context/CUST-001.json`
- Enterprise: form pre-filled from ERP adapter

---

### Route: `/dashboard`

**Page component:** `MissionControlDashboard`
**Purpose:** Operational home. Shows active cases, open alerts, key metrics, and recent workflow events. Primary entry point on login and after case closure.

**Related workflow states:** All states — dashboard is always accessible. Alert feed updates as cases transition from `alert_generated` onwards.

**Required data contracts:**
- `AlertEvent[]` — active alerts
- `WorkflowState` per active case
- `ShipmentContext` summary fields per case
- Derived metric counts

**Allowed user actions:**
- Click `AlertCard` → navigate to `/shipments/:shipmentId` and emit `alert_opened`
- Click active case row → navigate to current state route for that case

**Emitted events:** `alert_opened` (when AlertCard is clicked and alert not yet opened)

**Redirect rules:**
- Unauthenticated user → `/login` (auth not in scope for v1; note for enterprise)
- No case exists yet → show empty state with "Set up your first shipment" CTA → `/setup`

**Unavailable-state behaviour:** Always available. Shows empty state if no active cases.

**Mock / real data dependencies:**
- Alert feed: triggered by mock prediction event
- Metric counts: deterministic from case state data

---

### Route: `/alerts`

**Page component:** `AlertCenterPage`
**Purpose:** Full paginated list of all alerts — active and historical. Secondary entry point to disruption workflow.

**Related workflow states:** `alert_generated` and all later states (historical alerts remain listed)

**Required data contracts:**
- `AlertEvent[]` — all alerts, ordered by `triggered_at` descending
- `WorkflowState` per case — for status badge per alert row

**Allowed user actions:**
- Click alert row → navigate to current state route for that case
- Filter by severity, date range, status

**Emitted events:** `alert_opened` (if alert not yet opened when row is clicked)

**Redirect rules:**
- Alert row click: resolves current `WorkflowState` for the case and navigates to the correct route per Section 2 mapping

**Unavailable-state behaviour:** Accessible at all times. Empty state if no alerts have been generated.

**Mock / real data dependencies:**
- Mock prediction event generates the first alert

---

### Route: `/shipments/:shipmentId`

**Page component:** `ShipmentDisruptionDetailPage`
**Purpose:** Enriched disruption context screen. Lena reviews prediction data, ERP context, inventory state, freight options, and environmental signals before requesting scenario comparison.

**Related workflow states:** `alert_generated`, `disruption_context_opened`

**Required data contracts:**
- `DisruptionContext` (full)
- `AlertEvent` — for alert summary header
- `WorkflowState` + `available_actions`

**Allowed user actions:**
- Review panels (read-only)
- Click "Show me my options" → emits `context_confirmed` (only if in `available_actions`)

**Emitted events:** `context_confirmed`

**Redirect rules:**
- If `WorkflowState` is before `alert_generated` (e.g. `monitoring_active`) → redirect to `/dashboard` with message: "No active disruption for this shipment yet."
- If `WorkflowState` is `decision_pending` or later → redirect to `/decision-room/:caseId`
- On `context_confirmed` confirmed by orchestration → redirect to `/decision-room/:caseId`

**Unavailable-state behaviour:**
- If `DisruptionContext` is not yet assembled (context enrichment pending) → show loading state; poll until ready
- If `shipmentId` does not exist → 404, redirect to `/dashboard`

**Mock / real data dependencies:**
- `PredictionSignalPanel`: mock prediction JSON (free) or James ML output (real)
- `BusinessContextPanel`: mock ERP context (free) or ERP adapter (enterprise)
- Environmental signals: mock — displayed with `(simulated)` label

---

### Route: `/decision-room/:caseId`

**Page component:** `DecisionRoomPage`
**Purpose:** The core decision interface. Scenario comparison, recommendation, and Lena's explicit decision. This is the primary value screen of the product.

**Related workflow states:** `scenarios_generated`, `recommendation_ranked`, `decision_pending`, `decision_approved` (briefly, before redirect to execution)

**Required data contracts:**
- `ScenarioResult` (full — all scenarios + recommendation + assumptions log)
- `RecommendationResult`
- `DisruptionContext` (compact summary for context header)
- `WorkflowState` + `available_actions`

**Allowed user actions:**
- Review scenario cards and comparison matrix (always)
- Select a scenario → emits `scenario_selected` (enabled when `scenario_selected` in `available_actions`)
- Change selection before confirming → allowed (`scenario_selected` with different `scenario_id`)
- Confirm decision → emits `decision_confirmed` (enabled only when `decision_confirmed` in `available_actions`)

**Emitted events:**
- `scenario_selected`
- `decision_confirmed`

**Redirect rules:**
- If `WorkflowState` is before `scenarios_generated` (e.g. `disruption_context_opened`) → redirect to `/shipments/:shipmentId`
- If `WorkflowState` is before `alert_generated` → redirect to `/dashboard`
- On `decision_confirmed` confirmed by orchestration → redirect to `/execution/:caseId`
- If `WorkflowState` is `execution_started` or later → redirect to `/execution/:caseId`
- If `WorkflowState` is `audit_logged` or `closed` → redirect to `/audit/:caseId`

**Unavailable-state behaviour:**
- If `ScenarioResult` is not yet ready (scenario engine still running) → show loading indicator; do not render partial data
- If `caseId` does not exist → 404, redirect to `/dashboard`

**Mock / real data dependencies:**
- `ScenarioResult`: deterministic from scenario engine (same for mock and real)
- Context header: mock ERP data (free version)

---

### Route: `/execution/:caseId`

**Page component:** `ExecutionMonitoringPage`
**Purpose:** Step-by-step tracking of the approved scenario's execution. Lena marks steps complete manually in the free version.

**Related workflow states:** `execution_started`, `execution_monitoring`

**Required data contracts:**
- `ExecutionTask` (full with steps)
- `DecisionApproval` — summary of what was decided
- `WorkflowState` + `available_actions`

**Allowed user actions:**
- Mark step `in_progress` or `completed`
- Add notes to a step
- Each update → emits `execution_step_updated`

**Emitted events:** `execution_step_updated`

**Redirect rules:**
- If `WorkflowState` is before `decision_approved` (e.g. `decision_pending`) → redirect to `/decision-room/:caseId`
  - **Hard rule:** this redirect must be enforced even if user constructs the URL manually
- If `WorkflowState` is `audit_logged` or `closed` → redirect to `/audit/:caseId`
- On `audit_written` fired by orchestration → redirect to `/audit/:caseId`

**Unavailable-state behaviour:**
- If `ExecutionTask` is not yet created (execution_triggered not yet processed) → show loading state; poll until ready
- If `caseId` does not exist → 404, redirect to `/dashboard`

**Mock / real data dependencies:**
- Step definitions: `mock/execution-steps/:scenarioId.json`
- Step status updates: real user actions

---

### Route: `/audit/:caseId`

**Page component:** `AuditTimelinePage`
**Purpose:** Read-only case record. Shows the full decision history and execution summary. Lena can optionally fill the outcome block. Operator can close the case from here.

**Related workflow states:** `audit_logged`, `closed`

**Required data contracts:**
- `AuditEntry` (full — immutable)
- `ScenarioResult` (as-at-decision snapshot — from audit record, not re-fetched live)
- `ExecutionTask` (completed summary)

**Allowed user actions:**
- Fill outcome fields (optional): `actual_arrival_at`, `actual_total_cost_eur`, `estimated_loss_avoided_eur`, `outcome_status`, `notes`
- Click "Close case" → emits `audit_case_closed`

**Emitted events:** `audit_case_closed`

**Redirect rules:**
- If `WorkflowState` is before `audit_logged` (e.g. `execution_monitoring`) → redirect to `/execution/:caseId`
- If `WorkflowState` is before `execution_started` → redirect to current state route per Section 2
- On `audit_case_closed` → remain on `/audit/:caseId` in read-only `closed` state (no redirect — user may want to review the closed record)

**Unavailable-state behaviour:**
- If `AuditEntry` is not yet written → redirect to `/execution/:caseId`
- If `caseId` does not exist → 404, redirect to `/dashboard`
- **Stale audit snapshot:** if scenario config or engine version has changed since the audit was written, display a notice: "This audit record was generated with scenario engine v0.1. Current version is v0.2." Do not recompute. The audit record is immutable.

**Mock / real data dependencies:**
- All data from locked audit record — no live adapters needed

---

### Route: `/reports/:reportId`

**Page component:** `ReportsPage` *(reserved — not active in v1 MVP)*
**Purpose:** Aggregated operational reports across multiple cases — delay patterns, decision outcomes, ROI summary, recommendation accuracy. Depends on populated `AuditEntry.outcome` data from multiple closed cases.

**Status:** Reserved route. Returns 404 or "Coming soon" in v1. Not implemented until pilot produces closed cases with outcome data.

**Future data dependencies:**
- `AuditEntry[]` with populated `outcome` blocks
- Aggregated financial impact across cases

---

## 5. Deep-Link Behaviour

If a user navigates directly to a route (e.g. via bookmark, shared link, or page refresh), the router must validate that the current `WorkflowState` permits that route before rendering.

**Deep-link resolution flow:**

```
User opens /decision-room/:caseId directly
  │
  ├── Fetch WorkflowState for caseId
  │     └── If caseId not found → 404 → /dashboard
  │
  ├── Check minimum required state for route (see Section 6)
  │     └── If state < minimum → redirect to correct route per Section 2 mapping
  │
  └── If state ≥ minimum → render page normally
```

**Examples:**

| URL opened | Current state | Result |
|---|---|---|
| `/decision-room/CASE-001` | `monitoring_active` | Redirect → `/dashboard` |
| `/decision-room/CASE-001` | `disruption_context_opened` | Redirect → `/shipments/SHIP-001` |
| `/decision-room/CASE-001` | `recommendation_ranked` | Render normally |
| `/execution/CASE-001` | `decision_pending` | Redirect → `/decision-room/CASE-001` |
| `/execution/CASE-001` | `execution_monitoring` | Render normally |
| `/audit/CASE-001` | `execution_monitoring` | Redirect → `/execution/CASE-001` |
| `/audit/CASE-001` | `closed` | Render normally (read-only) |

---

## 6. Route Access — Minimum Required State

Each route has a minimum `WorkflowState` that must be met before the page renders. Below minimum → redirect to the correct route for the current state.

| Route | Minimum Required State | Redirect if Below Minimum |
|---|---|---|
| `/setup` | `setup_not_started` | (always accessible for new cases) |
| `/dashboard` | `monitoring_active` | (always accessible) |
| `/alerts` | `alert_generated` | `/dashboard` |
| `/shipments/:shipmentId` | `alert_generated` | `/dashboard` |
| `/decision-room/:caseId` | `scenarios_generated` | `/shipments/:shipmentId` |
| `/execution/:caseId` | `decision_approved` | `/decision-room/:caseId` |
| `/audit/:caseId` | `audit_logged` | `/execution/:caseId` |

---

## 7. Fallback Behaviour

### 7.1 Missing Shipment
- Route: `/shipments/:shipmentId` with an unknown `shipmentId`
- Behaviour: 404 page with message "Shipment not found." and CTA → `/dashboard`
- Do not expose internal IDs or stack traces

### 7.2 Missing Disruption Case
- Route: `/decision-room/:caseId`, `/execution/:caseId`, or `/audit/:caseId` with unknown `caseId`
- Behaviour: 404 page with message "Case not found." and CTA → `/dashboard`

### 7.3 Missing Decision (execution route accessed before decision approved)
- Route: `/execution/:caseId` when state is `decision_pending` or earlier
- Behaviour: Silent redirect to `/decision-room/:caseId` — no error shown
- This is a navigation constraint, not an error state

### 7.4 Stale Audit Snapshot
- Route: `/audit/:caseId` when scenario engine or config version has changed since audit was written
- Behaviour: Render the audit record as-is. Show a version notice: *"This case was evaluated with [engine_version]. Current version is [current_version]."*
- Do not recompute scenarios from current engine. The audit record is the record of what Lena saw when she decided — not a live recalculation.

### 7.5 Unavailable Prediction Input
- Scenario: mock emitter failed to fire, or James' adapter returned an error
- Behaviour: Case stays in `monitoring_active`. Dashboard shows case as "Awaiting prediction signal." No alert is generated. No disruption context is shown.
- A manual trigger button (dev/demo mode only) allows the mock prediction event to be fired from the dashboard, bypassing the delay timer.

---

## 8. Navigation Rules (Strict)

**Rule 1 — No execution route before decision approval.**
`/execution/:caseId` must redirect to `/decision-room/:caseId` if `WorkflowState` is anything other than `execution_started`, `execution_monitoring`, `audit_logged`, or `closed`. This check runs on every page load and on every navigation event to this route, not just on first load.

**Rule 2 — No audit closure before execution starts.**
`audit_case_closed` event is only emittable from `/audit/:caseId`. This route is only accessible when state is `audit_logged` or `closed`. The route guard enforces this before the page renders.

**Rule 3 — No Decision Room without scenarios generated.**
`/decision-room/:caseId` requires `WorkflowState ≥ scenarios_generated`. If scenarios are still computing (brief transition state), show a loading screen — do not render a partial `DecisionRoomPage` with empty scenario data.

**Rule 4 — Frontend renders only available actions from orchestration.**
Navigation-triggering action buttons (e.g. "Show me my options", "Confirm decision") are enabled only when the corresponding event appears in `available_actions` from the polling response. The frontend does not derive action availability from `WorkflowState` directly.

**Rule 5 — Frontend must not invent transitions.**
The frontend emits events. It does not write `WorkflowState` directly. It does not optimistically advance state before the orchestration layer confirms the transition. All state reads come from `GET /api/cases/:caseId/state`.

---

## 9. Implementation Notes for Hindu

### 9.1 Route Guards

Implement route guards as middleware that runs before each page render. Each guard:
1. Fetches `WorkflowState` for the `caseId` (or `shipmentId`) in the URL params
2. Checks the minimum required state (Section 6)
3. Redirects if below minimum; otherwise allows render

```
// Pseudo-code guard pattern
async function decisionRoomGuard(caseId: string): Promise<string | null> {
  const state = await fetchCaseState(caseId);
  if (!state) return "/dashboard";                        // not found
  if (state.order < ORDER["scenarios_generated"])         // below minimum
    return resolveRouteForState(state.current_state, caseId);
  return null;                                            // allow render
}
```

`ORDER` is a numeric mapping of states to enforce ordinal comparison without string matching. Define it from the `WorkflowState` type in `02-workflow-state-machine.md`.

### 9.2 Layout Structure

All authenticated routes share a common shell layout:
- **Top bar:** product name, active case indicator, user identity (v1: hardcoded as "Lena")
- **Left sidebar** (collapsible): navigation links — Dashboard, Alerts, active cases list
- **Main content area:** page-level component
- **Sidebar active state:** driven by current route, not by `WorkflowState` directly

The sidebar should highlight the current case's progress step when inside a case-specific route (`/shipments`, `/decision-room`, `/execution`, `/audit`).

### 9.3 Sidebar / Navigation Behaviour

- Dashboard and Alerts are always accessible from the sidebar
- Active cases list shows up to 5 most recent cases with a `StatusBadge` per case
- Clicking a case in the sidebar navigates to the current state route for that case (resolves via Section 2 mapping)
- Sidebar does not show setup, reports, or admin links in v1

### 9.4 Mock Routing Strategy

In the free version, there is one demo case: `CASE-001` / `SHIP-001`. The router handles this as a real case — no hardcoded demo routes. The mock adapters supply data; the routing layer is identical for mock and real.

For development and demo mode:
- `/dashboard` shows the mock alert as if the prediction event has fired
- A dev-mode button on `/dashboard` can trigger the mock prediction event manually (bypasses the event scheduler delay)
- All routes work normally once the mock case is in the correct state

### 9.5 Next.js Implementation Notes

- Use the **App Router** (`/app` directory) for all routes
- Route segments: `app/dashboard/page.tsx`, `app/shipments/[shipmentId]/page.tsx`, `app/decision-room/[caseId]/page.tsx`, `app/execution/[caseId]/page.tsx`, `app/audit/[caseId]/page.tsx`
- Route guards implemented as `middleware.ts` at the root, or as server-side redirect logic in `page.tsx` `generateMetadata` / layout fetches — not as client-side useEffect redirects (to avoid flash of wrong content)
- `WorkflowState` polling (`GET /api/cases/:caseId/state` every 3s) implemented as a client-side hook: `useWorkflowState(caseId)` — returns `{ currentState, availableActions, updatedAt }`
- This hook is the single source of truth for state across all components on a page. No component fetches state independently.
- Layout components should not fetch case state — only page-level components use `useWorkflowState`

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-25 | Initial draft — 8 routes, per-route specs, WorkflowState mapping, deep-link behaviour, 5 navigation rules, 5 fallback cases, Next.js implementation notes |
