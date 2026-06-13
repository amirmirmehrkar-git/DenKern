---
title: Sprint 5 — Pilot Readiness Backlog
version: 1.0
status: active
sprint_goal: A pilot customer can create and run their own disruption case end-to-end. Nick can onboard a new case without Amir. Lena can dismiss irrelevant signals. The Decision Room shows financial inputs transparently and fires the approval gate correctly.
engineer: Amir
capacity: 10 working days
total_points: 55
points_per_day: 5.5
date: 2026-06-08
---

# Sprint 5 — Pilot Readiness Backlog

## Sprint Goal

> Nick runs a complete session — intake form → disruption context → signal dismiss → confirm → Decision Room → approval gate → decision — using a case that is **not CASE-001**, with the customer's actual route and cost. No Amir in the room. Time under 15 minutes. No blocking questions.

## Exit Criteria

- [ ] Nick seeds CASE-002 from the intake form without writing code
- [ ] CASE-002 uses a different vessel, destination, and daily cost than CASE-001
- [ ] All four agents filter expired signals (`valid_until < today`)
- [ ] At least one irrelevant signal can be dismissed; dismissed signals are excluded from engine scoring
- [ ] Decision Room shows financial inputs with cost source badge
- [ ] Approval gate fires when total exposure ≥ €100,000
- [ ] Nick solo dry run completed and signed off

---

## Story Point Scale

| Points | Effort | Calendar |
|--------|--------|----------|
| 1 | 1–2 hours | — |
| 2 | 3–4 hours | — |
| 3 | ~half day | — |
| 5 | ~full day | — |
| 8 | 1.5–2 days | — |
| 13 | ~3 days | — |

---

## Epics

| ID | Epic | Points | Priority |
|----|------|--------|----------|
| E1 | Agent Data Quality | 6 | P0 |
| E2 | Case Lifecycle (Backend) | 12 | P0 |
| E3 | Multi-Case Dashboard | 8 | P0 |
| E4 | Case Intake Form | 12 | P0 |
| E5 | Signal Trust Layer | 9 | P0 |
| E6 | Decision Room Transparency | 7 | P1 |
| P | Process & Documentation | 1 | P1 |
| **Total** | | **55** | |

---

## EPIC 1 — Agent Data Quality

**Goal:** Agents only return signals that are currently valid and operationally relevant to the specific route.

---

### S1.1 — Date validity filter in all four agents

**As Lena,** when I open a disruption case, I want to see only intelligence signals that are currently active, so that I am not making decisions based on events that already resolved.

**Acceptance Criteria:**

- [ ] All four agents (`GeopoliticalRiskAgent`, `PortIntelligenceAgent`, `WeatherContextAgent`, `SupplierRiskAgent`) filter fixture events before signal construction
- [ ] An event is excluded if `valid_until` is present and `valid_until < today` (ISO date comparison, UTC)
- [ ] An event without `valid_until` is always included (open-ended validity)
- [ ] An agent whose entire fixture is expired returns `[]`, not an error
- [ ] Existing unit tests for each agent pass with the filter in place
- [ ] New unit test: inject a fixture with one expired and one valid event; assert only the valid one appears in output

**Story Points: 3**

**Notes:** Apply the same filter pattern to all four agents. Extract as a shared `isCurrentlyValid(event: { valid_until?: string }): boolean` utility in `packages/intelligence/src/utils/date-validity.ts` to avoid duplication.

---

### S1.2 — Route profile field for fixture coverage

**As Nick,** when I seed a case for a customer, I want to select a pre-validated route profile so that the agents match the correct signals rather than relying solely on text matching.

**Acceptance Criteria:**

- [ ] `CreateCaseRequest` includes optional `route_profile` field of type `RouteProfile`
- [ ] `RouteProfile` enum values: `'hamburg_north_sea'`, `'rotterdam_english_channel'`, `'antwerp_bay_of_biscay'`, `'mediterranean_atlantic'`
- [ ] Each agent's relevance filter checks `route_profile` in addition to (not instead of) existing text matching
- [ ] If `route_profile` is absent, existing text matching behavior is unchanged
- [ ] At least one fixture entry per agent is tagged with a `route_profile` field so matching can be validated
- [ ] Unit test: a context with `route_profile: 'hamburg_north_sea'` returns Hamburg port events

**Story Points: 3**

**Notes:** This is a fixture-coverage fix, not a feed integration. The `route_profile` field guides the agent to the right subset of fixture data. It does not replace the `destination_port` / `route` text fields.

---

## EPIC 2 — Case Lifecycle (Backend)

**Goal:** Any case can be created via API, producing a valid and self-contained set of case files that all downstream pages and the engine can consume.

---

### S2.1 — `buildDisruptionContext` pure function

**As the system,** I need a deterministic function that converts intake form data into a complete `DisruptionContext`, so that case creation is consistent and testable independently of the API layer.

**Acceptance Criteria:**

- [ ] Function signature: `buildDisruptionContext(caseId: string, req: CreateCaseRequest): DisruptionContext`
- [ ] Located in `packages/api/src/case-builder.ts` (or equivalent — not inside the route handler)
- [ ] Uses `MockPredictionAdapter` to populate prediction fields
- [ ] If `req.predicted_delay_days` is provided, it overrides the mock adapter's delay value
- [ ] If `req.replacement_cost_eur` is absent or `req.replacement_available` is `false`, `inventory.replacement_available = false` in the output
- [ ] If `req.freight_cost_eur` is absent, `freight_options` array is empty in the output
- [ ] `assembled_at` is set to `new Date().toISOString()` at call time
- [ ] `daily_downtime_cost_source` is stored on the context (not discarded)
- [ ] Output passes TypeScript type check against `DisruptionContext`
- [ ] Unit test: given a minimal request (7 required fields only), function returns a valid `DisruptionContext` with `replacement_available: false` and `freight_options: []`
- [ ] Unit test: given `predicted_delay_days: 9`, prediction delay in output equals 9

**Story Points: 5**

---

### S2.2 — `POST /api/cases` endpoint

**As Nick,** I want to create a new disruption case by submitting shipment data, so that the case is immediately available for Lena to review without any manual file operations.

**Acceptance Criteria:**

- [ ] `POST /api/cases` accepts `CreateCaseRequest` body (see intake form for full field list)
- [ ] Generates `caseId` as `CASE-${Date.now().toString(36).toUpperCase()}`
- [ ] Calls `buildDisruptionContext(caseId, req)` and writes result to `mock/cases/:caseId/disruption-context.json`
- [ ] Writes `mock/cases/:caseId/workflow-state.json` with `{ state: 'disruption_alert_received', available_actions: ['open_context'], assembled_at: <ISO> }`
- [ ] Creates the directory `mock/cases/:caseId/` with `{ recursive: true }`
- [ ] Returns `201` with `{ case_id, redirect: '/disruption/:caseId' }`
- [ ] Returns `400` with `{ errors: [{ field, message }] }` if any required field is missing
- [ ] Returns `400` if `required_by` is a past date
- [ ] Returns `400` if `daily_downtime_cost_eur` is not a positive number
- [ ] Written files are valid JSON (no trailing null bytes — apply `.rstrip(b'\x00')` pattern if Edit tool is used)
- [ ] Integration test: POST with valid body → files exist on disk → GET /api/cases returns the new case

**Story Points: 5**

**Notes:** The NTFS null byte issue from prior sprints may recur when writing JSON files via Node's `fs.writeFileSync`. Add a post-write verification: read the file back and confirm it parses as valid JSON before returning 201.

---

## EPIC 3 — Multi-Case Dashboard

**Goal:** Lena can see all disruption cases at a glance and navigate to any of them. The dashboard is the product's front door.

---

### S3.1 — `GET /api/cases` endpoint

**As Lena,** I want a list of all my disruption cases returned from the API, so that the dashboard can render them without hardcoded data.

**Acceptance Criteria:**

- [ ] `GET /api/cases` reads all directories matching `mock/cases/*/`
- [ ] For each case, reads `workflow-state.json` and extracts `state`, `available_actions`, `assembled_at`
- [ ] For each case, reads `disruption-context.json` and extracts `vessel_name`, `destination_port`, `route`, `required_by`, `critical_part`
- [ ] Returns array of `CaseSummary` objects sorted by `assembled_at` descending (newest first)
- [ ] Returns `[]` if no cases exist (not an error)
- [ ] If a case directory is missing either file, that case is silently skipped (not a 500)
- [ ] Response time < 200ms for up to 20 cases
- [ ] Unit test: with CASE-001 and one newly created case, returns both sorted correctly

**Story Points: 3**

---

### S3.2 — Dashboard page at `/dashboard`

**As Lena,** I want a dashboard page that shows all my disruption cases with their state and a direct action link, so that I always know what needs my attention.

**Acceptance Criteria:**

- [ ] Route `/dashboard` renders the case list from `GET /api/cases`
- [ ] Each case card shows: vessel name, destination, route, required_by date, critical part, workflow state badge, primary action button
- [ ] State badges use distinct visual treatment: `disruption_alert_received` → orange, `context_review` → blue, `scenarios_generated` → purple, `decision_pending` → yellow, `decision_approved` → green
- [ ] Primary action button label matches `available_actions[0]`: `open_context` → "Review Context", `make_decision` → "Decision Room", `decision_approved` → "View Decision"
- [ ] "+ New Case" button in header links to `/cases/new`
- [ ] Loading state shown while API call is in flight
- [ ] Empty state: if no cases, show "No active disruptions. Start a new case." with link to `/cases/new`
- [ ] Dashboard auto-refreshes or has a manual refresh button (either acceptable for Sprint 5)
- [ ] CASE-001 appears on the dashboard using data from its existing files (backward compatibility)

**Story Points: 5**

---

## EPIC 4 — Case Intake Form

**Goal:** Nick can onboard a new customer case in under 5 minutes using a web form, with no coding required and no silent failures.

---

### S4.1 — Intake form page at `/cases/new`

**As Nick,** I want a form where I enter shipment, cost, replacement, and freight data, so that a fully configured case is created with a single submission.

**Acceptance Criteria:**

**Required fields (submission blocked if absent):**
- [ ] Vessel name (text)
- [ ] Destination port (text)
- [ ] Route profile (dropdown: Hamburg / North Sea, Rotterdam / English Channel, Antwerp / Bay of Biscay, Mediterranean / Atlantic)
- [ ] Current location (text, e.g. "Off Brest")
- [ ] Critical part (text)
- [ ] Required by (date picker — must be a future date)
- [ ] Daily downtime cost (€) (number input, positive only)

**Cost source field:**
- [ ] Daily downtime cost source (dropdown): "Finance validated", "Management estimate", "Operator estimate"
- [ ] Default: "Management estimate"
- [ ] Source stored in case context and displayed in Decision Room

**Prediction override field:**
- [ ] Predicted delay days (optional number input)
- [ ] Help text: "Leave blank to use the system default estimate (4–6 days)"
- [ ] If provided, must be a positive integer ≤ 90

**Replacement option section (optional — enables REPLACE scenario):**
- [ ] Replacement location (text)
- [ ] Replacement cost (€) (number)
- [ ] Replacement arrival date (date picker)
- [ ] All three fields must be filled together or not at all (partial = validation error)

**Freight alternative section (optional — enables REROUTE scenario):**
- [ ] Via port (text)
- [ ] Freight cost (€) (number)
- [ ] Estimated arrival date (date picker)
- [ ] All three fields must be filled together or not at all

**Submission behaviour:**
- [ ] Submit button calls `POST /api/cases`
- [ ] On `201`: redirect to `/disruption/:caseId`
- [ ] On `400`: display field-level error messages inline (not a page reload)
- [ ] On `5xx`: display "Case creation failed. Please try again." with a retry button

**Story Points: 8**

**Notes:** This is the largest single UI story in the sprint. Build the form structure first (all fields, no validation), then add validation, then wire the API call. Do not attempt to build it in one commit.

---

### S4.2 — Scenario exclusion messaging on context page

**As Lena,** when a scenario is unavailable because intake data was not provided, I want a clear explanation rather than a missing scenario with no context.

**Acceptance Criteria:**

- [ ] Disruption context page has a "Scenario availability" section below the signals panel
- [ ] If `disruption-context.json` has `inventory.replacement_available = false`: show "Replace scenario unavailable — no replacement supplier provided during case setup."
- [ ] If `freight_options` is empty: show "Reroute scenario unavailable — no freight alternative provided during case setup."
- [ ] If both are missing: both messages appear
- [ ] If both are present: the section is hidden (not shown as "all available")
- [ ] Messages are informational (grey/neutral), not error-styled

**Story Points: 2**

---

## EPIC 5 — Signal Trust Layer

**Goal:** Lena can explicitly dismiss signals she judges to be irrelevant. Dismissed signals are excluded from engine scoring. This embodies the DenkKern principle: AI provides context, human owns the decision.

---

### S5.1 — Signal state persistence (backend)

**As the system,** I need a reliable mechanism to store and retrieve per-signal accept/dismiss state for a case, so that Lena's signal judgments survive page reloads and feed correctly into the engine.

**Acceptance Criteria:**

- [ ] `PATCH /api/cases/:caseId/signals/:signalId` accepts `{ state: 'ACTIVE' | 'DISMISSED' }`
- [ ] Reads `mock/cases/:caseId/signal-states.json` if it exists; creates it if absent
- [ ] Writes updated state keyed by `signalId`: `{ [signalId]: 'DISMISSED' | 'ACTIVE' }`
- [ ] Returns `200` with `{ signal_id, state }`
- [ ] Returns `404` if `caseId` directory does not exist
- [ ] Returns `400` if `state` is not `'ACTIVE'` or `'DISMISSED'`
- [ ] `GET /api/cases/:caseId/signals/states` returns the full `signal-states.json` object (empty object `{}` if file absent)
- [ ] Signal states persist across server restarts (file-backed)
- [ ] Unit test: PATCH DISMISSED → GET states → signalId appears as DISMISSED

**Story Points: 3**

---

### S5.2 — Engine excludes DISMISSED signals

**As the system,** when computing scenario scores, I must exclude signals the operator has dismissed, so that the recommendation reflects only the operator's validated context.

**Acceptance Criteria:**

- [ ] Before engine execution, signal-states for the case are loaded
- [ ] `mergeSignals()` (or equivalent pre-engine step) filters out any signal with state `'DISMISSED'`
- [ ] Engine executes on the filtered signal list — dismissed signals do not affect any score or modifier
- [ ] If all signals are dismissed, engine executes with empty signal array — produces valid output from financial parameters alone (no error, no empty result)
- [ ] The `context_confirmed` event handler passes the filtered signal list to the engine
- [ ] Unit test: case with one `flag_second_approval` signal → dismiss it → re-run engine → `second_approval_required` changes (unless financial threshold still triggers it)

**Story Points: 3**

**Notes:** The signal filtering happens at the point of engine invocation, not at the agent level. Agents always return their full output. The operator's judgment is applied at the merge layer, preserving the agent output for audit purposes.

---

### S5.3 — Signal dismiss/restore UI

**As Lena,** I want a Dismiss button on each signal card so that I can act on my judgment about whether a signal applies to my specific shipment.

**Acceptance Criteria:**

- [ ] Each signal card on `/disruption/:caseId` shows a "Dismiss" button when state is `ACTIVE`
- [ ] Clicking Dismiss calls `PATCH .../signals/:signalId` with `{ state: 'DISMISSED' }`
- [ ] On success: card is immediately styled as dismissed (greyed out, "Dismissed" badge, "Restore" button replaces "Dismiss")
- [ ] Clicking Restore calls `PATCH` with `{ state: 'ACTIVE' }` — card returns to normal
- [ ] Dismissed state is visually distinct from active state by more than colour alone (badge text + reduced opacity)
- [ ] Dismiss count shown above the signals panel: "3 active · 1 dismissed" (updates in real time)
- [ ] Signal states are loaded from `GET .../signals/states` on page load — dismissed signals render correctly after reload
- [ ] Dismissing/restoring a signal while on the disruption context page does not require a full page reload

**Story Points: 3**

---

## EPIC 6 — Decision Room Transparency

**Goal:** The Decision Room shows the financial assumptions driving every recommendation. Lena and Thomas can see exactly what inputs produced which output. The approval gate fires reliably.

---

### S6.1 — Financial inputs panel in Decision Room

**As Lena and Thomas,** I want to see the financial parameters that drove the scenario scores, so that I can immediately validate the numbers before acting on the recommendation.

**Acceptance Criteria:**

- [ ] Decision Room includes a collapsible "Inputs" panel
- [ ] Panel is collapsed by default with a "Show inputs" toggle
- [ ] Panel displays:
  - Daily downtime cost (€) with source badge
  - Predicted delay (days) with source label ("Override" if manually set, "System estimate" if mock adapter)
  - Replacement cost (€) — shown if REPLACE scenario available, "Not provided" otherwise
  - Freight cost (€) — shown if REROUTE scenario available, "Not provided" otherwise
  - Required by date
- [ ] Source badge styling: "Finance validated" → green, "Management estimate" → amber, "Operator estimate" → grey
- [ ] Panel is read-only in Sprint 5 (no inline editing)
- [ ] Panel renders correctly for CASE-001 (backward compatibility)

**Story Points: 3**

---

### S6.2 — Approval gate threshold from config

**As an operator,** the second approval gate must fire at the configured threshold, not a hardcoded value, so that each customer's governance policy can be set independently.

**Acceptance Criteria:**

- [ ] `scenario-defaults.json` contains `"second_approval_threshold_eur": 100000`
- [ ] Engine reads threshold from config — no hardcoded `300000` anywhere in engine code
- [ ] Gate fires when `total_financial_exposure >= second_approval_threshold_eur` OR `execution_complexity === 'HIGH'` OR any merged signal has `recommended_engine_effect === 'flag_second_approval'`
- [ ] Unit test: exposure of €120,000 with threshold of €100,000 → `second_approval_required: true`
- [ ] Unit test: exposure of €80,000, no HIGH complexity, no flag_second_approval signal → `second_approval_required: false`
- [ ] Config change does not require a code change or server restart — read at runtime

**Story Points: 1**

---

### S6.3 — Decision Room reflects current signal state

**As Lena,** when I dismiss a signal and navigate to the Decision Room, I want the scenarios to reflect my updated context, so that I can do real-time what-if analysis.

**Acceptance Criteria:**

- [ ] Decision Room scenario scores are computed from the current signal state at the time of page load
- [ ] If Lena dismisses a signal, navigates to Decision Room, and returns to context page — signal is still dismissed
- [ ] Decision Room includes a "Recalculate" button that re-runs the engine with the current signal state (acceptable alternative to automatic recalculation)
- [ ] If WAIT scenario cost changes after a signal is dismissed, the new value is shown after recalculation
- [ ] No stale scenario data shown from a previous context confirmation without warning

**Story Points: 3**

---

## Process — Non-Code Items

### SP.1 — Nick seed checklist

**As Nick,** I want a one-page checklist that tells me exactly what customer data I need before seeding a case, so that I can onboard any customer without Amir's help.

**Acceptance Criteria:**

- [ ] `docs/pilot/nick-seed-checklist.md` created
- [ ] 10 questions covering all required and optional intake fields
- [ ] Each question includes: what to ask, why it matters, what happens if it's missing
- [ ] Includes a "Validate before session" section: confirm daily cost source, confirm route profile matches, confirm predicted delay matches current port notification
- [ ] Total read time < 5 minutes

**Story Points: 1**

---

### SP.2 — Nick solo dry run (Sprint exit gate)

**This is not a code task. It is the sprint's exit criterion.**

Nick runs the full pilot session independently:

1. Opens `/cases/new`
2. Fills the intake form with a case that is NOT CASE-001
3. Navigates to disruption context
4. Reviews signals, dismisses at least one irrelevant signal
5. Confirms context
6. Navigates to Decision Room
7. Reviews scenarios and financial inputs panel
8. Selects a scenario
9. Approval gate fires
10. Supervisor approves

**Pass criteria:**
- Total time < 15 minutes
- Nick has zero blocking questions for Amir
- No error pages or 500 responses
- Decision Room shows the new case's financial parameters, not CASE-001's

**Story Points: not estimated (process, not code)**

---

## Recommended Implementation Order

The order is driven by dependency: the intake form cannot be tested without `POST /api/cases`; the engine filter cannot be tested without signal state persistence; the Decision Room panel needs a case to exist.

### Block 1 — Foundation (Days 1–2, ~10 points)

Build the data layer first. Everything else depends on being able to create and read cases.

| Story | Points | Dependency |
|-------|--------|------------|
| S1.1 — Date validity filter | 3 | None — independent, quick win to start |
| S2.1 — `buildDisruptionContext` function | 5 | Needs `CreateCaseRequest` type |
| S6.2 — Approval gate threshold from config | 1 | None — 15 min config fix |
| S2.2 — `POST /api/cases` endpoint | 5 | Needs S2.1 |

**End of Block 1:** A case can be created via API. The approval gate reads from config.

---

### Block 2 — Discovery Surface (Days 3–4, ~13 points)

Build the visible surface: dashboard and intake form. These are the first things Nick will use.

| Story | Points | Dependency |
|-------|--------|------------|
| S3.1 — `GET /api/cases` endpoint | 3 | Needs case files from S2.2 |
| S3.2 — Dashboard page | 5 | Needs S3.1 |
| S4.1 — Intake form (`/cases/new`) | 8 | Needs S2.2 |

**End of Block 2:** Nick can open the dashboard, click "+ New Case", fill the form, and land on the disruption context page. The core onboarding path works end-to-end.

---

### Block 3 — Signal Trust Layer (Days 5–6, ~12 points)

Add the dismiss capability and route profile support. These are the trust-critical pieces.

| Story | Points | Dependency |
|-------|--------|------------|
| S5.1 — Signal state persistence (backend) | 3 | Needs case files from S2.2 |
| S5.2 — Engine excludes DISMISSED signals | 3 | Needs S5.1 |
| S5.3 — Signal dismiss/restore UI | 3 | Needs S5.1 |
| S1.2 — Route profile field for fixture coverage | 3 | Needs S4.1 (form must include the field) |

**End of Block 3:** Lena can dismiss signals. Dismissed signals are excluded from scoring. Route profile improves fixture relevance.

---

### Block 4 — Polish and Pilot Readiness (Days 7–8, ~9 points)

All remaining stories. These add transparency and close the last trust gaps.

| Story | Points | Dependency |
|-------|--------|------------|
| S6.1 — Financial inputs panel | 3 | Needs case data from S2.2 |
| S6.3 — Decision Room reflects signal state | 3 | Needs S5.2 |
| S4.2 — Scenario exclusion messaging | 2 | Needs context page + S2.1 |
| SP.1 — Nick seed checklist | 1 | Needs working system |

**End of Block 4:** Decision Room is transparent, scenario exclusions are explained, checklist is written.

---

### Days 9–10 — Buffer and Dry Run

**Day 9:** Nick dry run. Amir on standby only — no active building. Every gap Nick hits during the dry run is a bug, not a feature request.

**Day 10:** Fix anything that blocked the dry run. Final smoke test on CASE-001 (regression). Confirm all sprint exit criteria are met.

---

## Full Point Summary

| Epic | Stories | Points |
|------|---------|--------|
| E1 — Agent Data Quality | S1.1, S1.2 | 6 |
| E2 — Case Lifecycle | S2.1, S2.2 | 10 |
| E3 — Multi-Case Dashboard | S3.1, S3.2 | 8 |
| E4 — Case Intake Form | S4.1, S4.2 | 10 |
| E5 — Signal Trust Layer | S5.1, S5.2, S5.3 | 9 |
| E6 — Decision Room Transparency | S6.1, S6.2, S6.3 | 7 |
| P — Process | SP.1 | 1 |
| **Sprint total** | **17 stories** | **51** |
| Buffer (Days 9–10) | Dry run + fixes | ~10 |
| **True capacity required** | | **~51 + buffer** |

At 5–5.5 points per focused engineering day, 51 points fits in 9–10 days. **This sprint has no slack.** Any story that expands unexpectedly must be descoped — see descope candidates below.

---

## Descope Candidates (if sprint is at risk)

If Amir hits unexpected complexity, descope in this order — lowest pilot impact first:

| Story | Why it can be cut | Impact |
|-------|-------------------|--------|
| S6.3 — Signal state in Decision Room | Recalculate button can be added in Sprint 6 | Low — Lena can re-confirm context to get updated scenarios |
| S4.2 — Scenario exclusion messaging | Informational only — no scenario breaks without it | Low — operators will figure it out |
| S1.2 — Route profile field | Risky to cut if pilot customer's route has poor fixture coverage | Medium — check route before cutting |
| S6.1 — Financial inputs panel | Panel is trust-building, not functionally required | Medium — Nick can narrate the inputs verbally |

**Never descope:** S1.1, S2.1, S2.2, S3.1, S3.2, S4.1, S5.1, S5.2, S5.3, S6.2. These are the load-bearing stories. If any of these is cut, the sprint goal is not achievable.

---

## What This Sprint Does Not Build

Per roadmap decision — these are explicitly out of Sprint 5 scope:

- **Signal editing / authoring** — operators can dismiss signals but cannot change signal content
- **Outcome recording** — no form to record actual arrival date or production impact
- **E2E automated test suite** — manual smoke test covers the pilot path; automation is Sprint 6
- **Audit trail persistence** — agent execution log is Sprint 6
- **Scenario result persistence** — in-memory is acceptable for pilot (re-confirm to recompute)
- **Webhook case intake** — Nick seeds manually for the 2-week pilot
- **pnpm seed:case CLI** — intake form is sufficient

---

*Document owner: Claude / Product Architect + Technical Lead*
*Companion documents:*
- *docs/roadmap/sprint-5-7-roadmap.md*
- *docs/roadmap/sprint-5-pilot-onboarding-design.md*
- *docs/pilot/nick-seed-checklist.md (to be created in SP.1)*
