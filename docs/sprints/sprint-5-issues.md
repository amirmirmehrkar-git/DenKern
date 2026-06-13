---
title: Sprint 5 — GitHub / Jira Issue Backlog
version: 1.0
status: active
engineer: Amir
sprint: 5
capacity_days: 10
total_story_points: 53
date: 2026-06-08
---

# Sprint 5 — Implementation Backlog
## Format: GitHub Issues / Jira

> **Sprint Goal:** A pilot customer can create and run their own disruption case end-to-end.
> Nick can onboard without Amir. Lena can dismiss irrelevant signals.
> The Decision Room shows financial assumptions transparently and fires the approval gate correctly.

---

## Roles

| Person | Responsibility in Sprint 5 |
|--------|---------------------------|
| **Amir** | All code. Sole engineer. |
| **Nick** | Pilot onboarding, dry run, customer interaction. No code. |
| **James** | Prediction feed (not in Sprint 5 scope — mock adapter remains) |

---

## Epic Index

| ID | Epic | Stories | Points |
|----|------|---------|--------|
| E1 | Agent Data Quality | DK-101, DK-102 | 6 |
| E2 | Case Lifecycle — Backend | DK-201, DK-202 | 10 |
| E3 | Multi-Case Dashboard | DK-301, DK-302 | 8 |
| E4 | Case Intake & Create Flow | DK-401, DK-402, DK-403 | 12 |
| E5 | Signal Trust Layer | DK-501, DK-502, DK-503 | 9 |
| E6 | Decision Room Transparency | DK-601, DK-602, DK-603 | 7 |
| E7 | Pilot Process | DK-701, DK-702 | 1 + dry run |
| | **Total** | **16 stories** | **53** |

---

## Dependency Graph

```
DK-101 ──────────────────────────────────────────► (standalone)
DK-602 ──────────────────────────────────────────► (standalone)

DK-201 (buildDisruptionContext)
  └─► DK-202 (POST /api/cases)
        ├─► DK-301 (GET /api/cases)
        │     └─► DK-302 (Dashboard)
        ├─► DK-401 (Intake Form)
        │     └─► DK-102 (Route Profile — needs form field)
        ├─► DK-403 (Scenario exclusion — needs context to exist)
        └─► DK-501 (Signal state API — needs caseId to exist)
              ├─► DK-502 (Engine filter)
              │     └─► DK-603 (Decision Room signal recalc)
              └─► DK-503 (Signal dismiss UI)

DK-601 (Financial panel) ──► depends on DK-202 (case with financial data)
DK-701 (Checklist) ──────► depends on working system (any time in Week 2)
DK-702 (Dry run) ────────► depends on all code stories complete
```

**Critical Path:**
`DK-201 → DK-202 → DK-401 → DK-501 → DK-502 → DK-503`

Any delay on any of these stories delays the sprint exit gate.

---

---

# EPIC E1 — Agent Data Quality

**Goal:** Agents only surface signals that are currently active and relevant to the specific route. No expired events. No route mismatches.

---

## DK-101 — Date validity filter in all four agents

**Labels:** `epic:agent-data-quality` `priority:p0` `type:backend`
**Points:** 3
**Depends on:** —
**Blocks:** DK-702 (dry run requires no expired signals)

### Description

As **Lena**, when I open a disruption case I want intelligence signals to reflect only currently active events, so that I am not making a €300k+ decision based on a storm that passed two weeks ago.

### Acceptance Criteria

- [ ] All four agents filter fixture events before constructing signals
- [ ] Filter logic: exclude event if `valid_until` is present **and** `new Date(event.valid_until) < startOfToday()` (UTC, date-only comparison — `valid_until: "2026-06-07"` expires at end of June 7, not start)
- [ ] Events with no `valid_until` field are always included (open-ended validity)
- [ ] An agent whose entire fixture set has expired returns `[]` — not an error, not a partial result
- [ ] Existing unit tests for all four agents continue to pass
- [ ] New unit test in each agent: inject one expired + one valid event; assert only the valid one appears in `run()` output
- [ ] Filter is applied before signal construction (not after validation)

### Technical Notes

**New utility:** Create `packages/intelligence/src/utils/date-validity.ts`

```typescript
export function isCurrentlyValid(event: { valid_until?: string }): boolean {
  if (!event.valid_until) return true;
  // Date-only comparison — treat valid_until as end-of-day
  const expiry = new Date(event.valid_until);
  expiry.setHours(23, 59, 59, 999);
  return expiry >= new Date();
}
```

**Files to modify** (one-line filter in each):
- `packages/intelligence/src/agents/geopolitical-risk.ts` — filter `geoEventsFixture` before `.map()`
- `packages/intelligence/src/agents/port-intelligence.ts` — filter `portEventsFixture`
- `packages/intelligence/src/agents/weather-context.ts` — filter `weatherEventsFixture`
- `packages/intelligence/src/agents/supplier-risk.ts` — filter `supplierEventsFixture`

Pattern (same in all four):
```typescript
const active = this.events.filter(isCurrentlyValid);
const relevant = active.filter(e => isRelevantToContext(e, context));
```

**Fixture update needed:** Verify at least 2–3 events per fixture have `valid_until` dates in the future (≥ 2026-12-31). If all events are expired after this filter, the pilot has no signals. Check before closing this story.

---

## DK-102 — Route profile field for fixture coverage

**Labels:** `epic:agent-data-quality` `priority:p0` `type:backend`
**Points:** 3
**Depends on:** DK-401 (form must include the `route_profile` field), DK-201 (context builder must pass it to agents)
**Blocks:** —

### Description

As **Nick**, when I seed a case I want to select a pre-validated route profile so that agents return relevant signals for the customer's trade lane — not signals calibrated for a different route.

### Acceptance Criteria

- [ ] `RouteProfile` type added to `@denkkern/types` or defined locally in `packages/intelligence/src/types.ts`:
  `'hamburg_north_sea' | 'rotterdam_english_channel' | 'antwerp_bay_of_biscay' | 'mediterranean_atlantic'`
- [ ] `AgentContext` extended with optional `route_profile?: RouteProfile`
- [ ] Each agent's relevance filter checks `route_profile` **in addition to** existing text matching — not instead of it
- [ ] Each fixture file has at least one event tagged with `"route_profile": "hamburg_north_sea"` (or equivalent) — these events match even if text matching would miss them
- [ ] If `route_profile` is absent, existing matching behaviour is unchanged (backward compatible with CASE-001)
- [ ] Unit test: context with `route_profile: 'hamburg_north_sea'` returns Hamburg port events even when `destination_port` is set to something generic
- [ ] Unit test: context without `route_profile` still returns events via text matching (regression)

### Technical Notes

**Type change** — add to `AgentContext`:
```typescript
route_profile?: 'hamburg_north_sea' | 'rotterdam_english_channel'
              | 'antwerp_bay_of_biscay' | 'mediterranean_atlantic';
```

**Relevance filter pattern** (example for PortIntelligenceAgent):
```typescript
function isRelevant(event: RawPortEvent, context: AgentContext): boolean {
  // Existing text match
  const dest = context.destination_port.toLowerCase();
  const textMatch = event.port_name.toLowerCase() === dest
    || (context.route?.toLowerCase().includes(event.port_name.toLowerCase()) ?? false);
  if (textMatch) return true;

  // Profile match
  if (context.route_profile && event.route_profile === context.route_profile) return true;

  return false;
}
```

**Fixture format** — add optional field to each event:
```json
{ "event_id": "HH-001", "port_name": "Hamburg", "route_profile": "hamburg_north_sea", ... }
```

---

---

# EPIC E2 — Case Lifecycle (Backend)

**Goal:** Any case can be created via API, producing valid and self-contained case files that all downstream routes and the engine can consume. This is the load-bearing foundation of the entire sprint.

---

## DK-201 — `buildDisruptionContext` pure function

**Labels:** `epic:case-lifecycle` `priority:p0` `type:backend`
**Points:** 5
**Depends on:** —
**Blocks:** DK-202, DK-403, DK-601

### Description

As the **system**, I need a deterministic, side-effect-free function that converts intake form data into a complete `DisruptionContext`, so that case creation logic can be tested independently of file I/O and HTTP.

### Acceptance Criteria

- [ ] Function located at `packages/api/src/case-builder.ts` (not inside the route handler)
- [ ] Signature: `buildDisruptionContext(caseId: string, req: CreateCaseRequest): DisruptionContext`
- [ ] Calls `MockPredictionAdapter` to populate prediction fields
- [ ] If `req.predicted_delay_days` is provided (> 0), it **overrides** the mock adapter's delay value — confidence is set to `1.0` when manually overridden
- [ ] If `req.replacement_cost_eur` is absent, `inventory.replacement_available = false` in output
- [ ] If `req.freight_cost_eur` is absent, `freight_options = []` in output
- [ ] `assembled_at` is `new Date().toISOString()` at call time (not hardcoded)
- [ ] `daily_downtime_cost_source` stored on the context object (not discarded)
- [ ] `route_profile` stored on the context if provided
- [ ] Output passes TypeScript type-check against `DisruptionContext`
- [ ] Unit test — minimal request (7 required fields only): output has `replacement_available: false` and `freight_options: []`
- [ ] Unit test — `predicted_delay_days: 9` override: output prediction delay equals 9, confidence equals 1.0
- [ ] Unit test — full request with replacement and freight: both appear correctly in output
- [ ] Function is pure — no `fs` calls, no HTTP calls, no side effects

### Technical Notes

**`CreateCaseRequest` interface** — define in `packages/api/src/types.ts`:
```typescript
export interface CreateCaseRequest {
  // Required
  vessel_name: string;
  destination_port: string;
  route: string;
  route_profile?: RouteProfile;
  current_location: string;
  critical_part: string;
  required_by: string;           // ISO date "YYYY-MM-DD"
  daily_downtime_cost_eur: number;
  daily_downtime_cost_source: 'finance_validated' | 'management_estimate' | 'operator_estimate';
  // Prediction override
  predicted_delay_days?: number;
  // Replacement (all-or-nothing)
  replacement_location?: string;
  replacement_cost_eur?: number;
  replacement_arrival_date?: string;
  // Freight (all-or-nothing)
  freight_via_port?: string;
  freight_cost_eur?: number;
  freight_arrival_date?: string;
}
```

**Mock prediction call** — `MockPredictionAdapter.predict()` already returns a `PredictionResult`. Call it with the assembled `ShipmentContext`. If `req.predicted_delay_days` is set, replace `result.predicted_delay_days` with the override value.

**The `daily_downtime_cost_source` field** needs to be added to `DisruptionContext` or `ShipmentContext` in `@denkkern/types`. If modifying shared types is too risky, store it as a top-level field on the context JSON — it's used for display only, not engine logic.

---

## DK-202 — `POST /api/cases` endpoint

**Labels:** `epic:case-lifecycle` `priority:p0` `type:backend`
**Points:** 5
**Depends on:** DK-201
**Blocks:** DK-301, DK-401, DK-403, DK-501, DK-601

### Description

As **Nick**, I want to submit case data to an API endpoint and have a fully structured case created on disk, so that Lena can open it immediately without any manual file operations.

### Acceptance Criteria

- [ ] `POST /api/cases` accepts `CreateCaseRequest` body (JSON)
- [ ] Generates `caseId` as `CASE-${Date.now().toString(36).toUpperCase()}` — guaranteed unique for human-scale usage
- [ ] Calls `buildDisruptionContext(caseId, req)` — no business logic in the route handler
- [ ] Creates directory `mock/cases/${caseId}/` with `{ recursive: true }`
- [ ] Writes `mock/cases/${caseId}/disruption-context.json` — frozen snapshot, never mutated after creation
- [ ] Writes `mock/cases/${caseId}/workflow-state.json`: `{ state: 'disruption_alert_received', available_actions: ['open_context'], assembled_at: <ISO> }`
- [ ] **Post-write verification:** reads each file back and parses it with `JSON.parse()` — if parse fails, returns `500` before sending `201` (catches NTFS null byte corruption)
- [ ] Returns `201` with `{ case_id: string, redirect: string }`
- [ ] Returns `400` with `{ errors: [{ field: string, message: string }] }` for:
  - Any required field missing or empty
  - `required_by` is today or in the past
  - `daily_downtime_cost_eur` ≤ 0 or not a number
  - Replacement fields: `replacement_location`, `replacement_cost_eur`, `replacement_arrival_date` — must all be present or all absent
  - Freight fields: `freight_via_port`, `freight_cost_eur`, `freight_arrival_date` — must all be present or all absent
- [ ] Integration test: valid POST → `mock/cases/:caseId/disruption-context.json` exists and is valid JSON
- [ ] Integration test: missing `required_by` → `400` with `field: 'required_by'` in errors array
- [ ] CASE-001 still loads correctly after this change (no regression to existing file layout)

### Technical Notes

**Validation pattern** — do not use a schema library; keep it explicit for pilot:
```typescript
const errors: {field: string, message: string}[] = [];
if (!req.vessel_name?.trim()) errors.push({ field: 'vessel_name', message: 'Required' });
if (!req.required_by) errors.push({ field: 'required_by', message: 'Required' });
else if (new Date(req.required_by) <= new Date()) errors.push({ field: 'required_by', message: 'Must be a future date' });
// ... etc
if (errors.length > 0) return res.status(400).json({ errors });
```

**NTFS null byte guard** (learned from Sprint 4):
```typescript
fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf8');
// Verify immediately
try {
  JSON.parse(fs.readFileSync(contextPath, 'utf8'));
} catch {
  return res.status(500).json({ error: 'File write verification failed', case_id });
}
```

**Directory path** — use `path.join(process.cwd(), 'mock', 'cases', caseId)` not a hardcoded relative path, to survive different working directories in test vs server contexts.

---

---

# EPIC E3 — Multi-Case Dashboard

**Goal:** The product has a real front door. Lena can see every case, its state, and take the right action in one click.

---

## DK-301 — `GET /api/cases` endpoint

**Labels:** `epic:dashboard` `priority:p0` `type:backend`
**Points:** 3
**Depends on:** DK-202 (case files must exist to test against)
**Blocks:** DK-302

### Description

As **Lena**, I want a list of all disruption cases returned by the API, so that the dashboard can render them without hardcoded data or manual file operations.

### Acceptance Criteria

- [ ] `GET /api/cases` reads all directories in `mock/cases/`
- [ ] For each case directory: reads `workflow-state.json` for `state`, `available_actions`, `assembled_at`
- [ ] For each case directory: reads `disruption-context.json` for `vessel_name`, `destination_port`, `route`, `required_by`, `critical_part`
- [ ] Returns array of `CaseSummary[]` sorted by `assembled_at` descending (newest first)
- [ ] Returns `[]` when no cases exist (not a 404 or 500)
- [ ] If a case directory is missing `workflow-state.json` or `disruption-context.json`, that case is **silently skipped** — not a 500
- [ ] Response shape per case:
  ```typescript
  {
    case_id: string;
    vessel_name: string;
    destination_port: string;
    route: string;
    required_by: string;
    critical_part: string;
    workflow_state: string;
    available_actions: string[];
    assembled_at: string;
  }
  ```
- [ ] CASE-001 appears in the response (backward compatibility — its existing files satisfy the interface)
- [ ] Unit test: two cases with different `assembled_at` — newer appears first

### Technical Notes

```typescript
import fs from 'fs';
import path from 'path';

const casesDir = path.join(process.cwd(), 'mock', 'cases');
const caseDirs = fs.existsSync(casesDir) ? fs.readdirSync(casesDir) : [];

const summaries = caseDirs.flatMap(caseId => {
  try {
    const statePath = path.join(casesDir, caseId, 'workflow-state.json');
    const ctxPath   = path.join(casesDir, caseId, 'disruption-context.json');
    if (!fs.existsSync(statePath) || !fs.existsSync(ctxPath)) return [];

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const ctx   = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
    return [{
      case_id: caseId,
      vessel_name: ctx.shipment_context?.vessel_name ?? caseId,
      // ... map remaining fields
    }];
  } catch {
    return []; // silently skip malformed cases
  }
});

return summaries.sort((a, b) => b.assembled_at.localeCompare(a.assembled_at));
```

**Watch for:** CASE-001's `disruption-context.json` may have a slightly different shape than newly created cases (assembled in Sprint 4 manually). Add fallback paths when extracting `vessel_name`, `destination_port`, etc.

---

## DK-302 — Dashboard page at `/dashboard`

**Labels:** `epic:dashboard` `priority:p0` `type:frontend`
**Points:** 5
**Depends on:** DK-301
**Blocks:** DK-702 (Nick dry run starts here)

### Description

As **Lena**, I want a dashboard at `/dashboard` that shows all my disruption cases with their current state and a direct action link, so I always know what requires my attention without hunting through the application.

### Acceptance Criteria

- [ ] Route `/dashboard` renders and fetches from `GET /api/cases` on load
- [ ] Each case card displays: vessel name, destination port, route, required by date, critical part label, workflow state badge, primary action button
- [ ] State badge colours: `disruption_alert_received` → amber, `context_review` → blue, `scenarios_generated` → purple, `decision_pending` → yellow, `decision_approved` → green, unknown → grey
- [ ] Primary action button text and destination:
  - `open_context` → **"Review Disruption"** → `/disruption/:caseId`
  - `make_decision` → **"Open Decision Room"** → `/decision-room/:caseId`
  - `decision_approved` → **"View Decision"** → `/decision-room/:caseId`
- [ ] **"+ New Case"** button in the page header → `/cases/new`
- [ ] Loading skeleton shown while API call is in flight (not a blank page)
- [ ] Empty state: "No active disruptions." with a "Create your first case →" link to `/cases/new`
- [ ] If `GET /api/cases` returns an error, show "Unable to load cases" with a retry button
- [ ] CASE-001 renders correctly on the dashboard (backward compatibility)
- [ ] Page works on a 1280px desktop viewport (pilot use case — no mobile requirement)

### Technical Notes

**Cases needing `required_by` formatting:** display as `DD MMM YYYY` (e.g. "15 Jun 2026"). Use `Intl.DateTimeFormat` — no date library needed.

**State badge component** — extract as a reusable `<StateBadge state={...} />` component. States will be reused on the decision room and context pages.

**Consider polling:** `setInterval` refetch every 30 seconds so the dashboard updates when Nick creates a case in another tab during the pilot session. Simple `fetch` + `setState` — no websockets needed.

---

---

# EPIC E4 — Case Intake & Create Flow

**Goal:** Nick can onboard any pilot customer by filling a web form. No terminal. No JSON files. No Amir required.

---

## DK-401 — Intake form at `/cases/new`

**Labels:** `epic:intake` `priority:p0` `type:frontend`
**Points:** 8
**Depends on:** DK-202 (form calls `POST /api/cases`)
**Blocks:** DK-102, DK-702

### Description

As **Nick**, I want a form at `/cases/new` where I enter the customer's shipment data, so that a new disruption case is created and immediately available for Lena to review — with no command-line tools and no Amir.

### Acceptance Criteria

**Required fields — form submission blocked if absent:**
- [ ] Vessel name (text input)
- [ ] Destination port (text input)
- [ ] Route profile (select: "Hamburg / North Sea", "Rotterdam / English Channel", "Antwerp / Bay of Biscay", "Mediterranean / Atlantic")
- [ ] Current location (text input, placeholder: "e.g. Off Brest")
- [ ] Critical part (text input, placeholder: "e.g. Hydraulic seals – Part #H-4421")
- [ ] Required by date (date input — browser native, must be today+1 or later)
- [ ] Daily downtime cost in € (number input, min: 1)

**Cost source field:**
- [ ] Dropdown immediately below daily downtime cost: "Finance validated / Management estimate / Operator estimate"
- [ ] Default value: "Management estimate"
- [ ] Label: "Source of this estimate"

**Prediction override (optional):**
- [ ] Number input: "Predicted delay (days)" — placeholder: "Leave blank for system default (4–6 days)"
- [ ] Accept only positive integers ≤ 90; show inline error if violated

**Replacement section (optional block — all-or-nothing):**
- [ ] Heading: "Replacement Option" with subtext "Completing this section enables the REPLACE scenario"
- [ ] Fields: Replacement location (text), Replacement cost € (number), Replacement arrival date (date)
- [ ] If any one of the three is filled, all three are required — show group-level error: "Complete all three replacement fields or leave all blank"

**Freight section (optional block — all-or-nothing):**
- [ ] Heading: "Freight Alternative" with subtext "Completing this section enables the REROUTE scenario"
- [ ] Fields: Via port (text), Freight cost € (number), Estimated arrival date (date)
- [ ] Same all-or-nothing group validation as replacement

**Submission behaviour:**
- [ ] "Create Case" submit button
- [ ] On submit: validate all rules client-side, show inline errors without page reload
- [ ] If valid: call `POST /api/cases`, show loading state on button
- [ ] On `201`: redirect to `/disruption/:caseId` (use `redirect` value from response)
- [ ] On `400`: merge server errors into field-level display
- [ ] On `5xx`: show dismissible banner: "Case creation failed. Please try again." — do not navigate away
- [ ] Form is scrollable — does not require a short viewport; full form visible on 1280px without horizontal scroll

### Technical Notes

**Build order within this story:**
1. Static HTML structure with all fields (no JS, no API) — commit separately
2. Add client-side validation — commit separately
3. Wire to `POST /api/cases` + redirect — final commit

This prevents an 8-point story from becoming a single uncommittable block.

**Date input behaviour:** Native `<input type="date">` gives a date string in `YYYY-MM-DD` format — matches `required_by` in `CreateCaseRequest`. Set `min` attribute to tomorrow: `input.min = new Date(Date.now() + 86400000).toISOString().split('T')[0]`.

**Group validation pattern:**
```typescript
const replacementFields = [req.replacement_location, req.replacement_cost_eur, req.replacement_arrival_date];
const filledCount = replacementFields.filter(Boolean).length;
if (filledCount > 0 && filledCount < 3) {
  errors.push({ field: 'replacement', message: 'Complete all three replacement fields or leave all blank' });
}
```

**Do not use a form library.** Vanilla form with manual validation is faster to build and easier to debug during a live pilot.

---

## DK-402 — Form validation and field-level errors

**Labels:** `epic:intake` `priority:p0` `type:frontend`
**Points:** 2
**Depends on:** DK-401
**Blocks:** —

### Description

As **Nick**, I want clear inline error messages when I submit incomplete or invalid data, so that I can fix the problem without guessing which field is wrong.

### Acceptance Criteria

- [ ] Each required field has an inline error state: red border + error message below field
- [ ] Error messages are specific: "Required", "Must be a future date", "Must be a positive number", "Complete all three replacement fields or leave all blank"
- [ ] Errors appear on submit attempt — not on blur (less annoying for Nick filling a long form)
- [ ] Once an error is shown, it clears as soon as the field is corrected (live validation after first submit attempt)
- [ ] Server `400` errors are mapped to field-level display — not shown only as a banner
- [ ] If `required_by` date is in the past: error shown immediately on blur (date fields are an exception — early feedback is useful)
- [ ] Tab order is logical: vessel → destination → route profile → location → part → date → cost → source → delay override → replacement group → freight group → submit

### Technical Notes

Manage a `touched: Set<string>` state. On first submit attempt, add all fields to `touched`. After that, validate on change for touched fields. This gives the common pattern: no errors on load, errors appear on first submit, clear as you fix.

---

## DK-403 — Scenario exclusion messaging on context page

**Labels:** `epic:intake` `priority:p1` `type:frontend`
**Points:** 2
**Depends on:** DK-202 (context JSON must exist with the right shape)
**Blocks:** —

### Description

As **Lena**, when a scenario is unavailable because intake data was not provided, I want a clear explanation rather than a silently missing scenario card — so I don't wonder if the system is broken.

### Acceptance Criteria

- [ ] Disruption context page reads `disruption-context.json` and checks scenario availability
- [ ] If `inventory.replacement_available !== true`: show info banner "Replace scenario unavailable — no replacement supplier was provided when this case was created."
- [ ] If `freight_options.length === 0`: show info banner "Reroute scenario unavailable — no freight alternative was provided when this case was created."
- [ ] Banners are styled as informational (blue or grey), not as errors (not red)
- [ ] If both scenarios are excluded: both banners appear stacked
- [ ] If both scenarios are available: no banners (not a "all scenarios available" success message)
- [ ] CASE-001 is not affected — CASE-001 has both replacement and freight options

### Technical Notes

Read from `context.inventory?.replacement_available` and `context.freight_options?.length`. These fields are written by `buildDisruptionContext` and should be present in all Sprint 5 cases. Add defensive null checks for CASE-001 compatibility.

---

---

# EPIC E5 — Signal Trust Layer

**Goal:** Lena has explicit control over which signals influence the recommendation. Dismissed signals are excluded from engine scoring. The product principle "AI provides context, human owns the decision" is functional, not just rhetorical.

---

## DK-501 — Signal state persistence (backend)

**Labels:** `epic:signal-trust` `priority:p0` `type:backend`
**Points:** 3
**Depends on:** DK-202 (caseId must exist)
**Blocks:** DK-502, DK-503

### Description

As the **system**, I need a reliable mechanism to store and retrieve per-signal accept/dismiss state for each case, so that Lena's signal judgments survive page reloads and correctly filter engine inputs.

### Acceptance Criteria

- [ ] `PATCH /api/cases/:caseId/signals/:signalId` accepts `{ state: 'ACTIVE' | 'DISMISSED' }`
- [ ] Reads `mock/cases/:caseId/signal-states.json` if it exists; creates it if absent
- [ ] Writes updated state: `{ [signalId]: 'ACTIVE' | 'DISMISSED' }`
- [ ] Returns `200` with `{ signal_id: string, state: string }`
- [ ] Returns `404` if `mock/cases/:caseId/` directory does not exist
- [ ] Returns `400` if `state` is not `'ACTIVE'` or `'DISMISSED'`
- [ ] `GET /api/cases/:caseId/signals/states` returns the full `signal-states.json` object — returns `{}` if file does not exist (not a 404)
- [ ] States persist across server restarts (file-backed, not in-memory)
- [ ] Unit test: PATCH signal DISMISSED → GET states → signal appears as DISMISSED
- [ ] Unit test: PATCH signal DISMISSED → PATCH same signal ACTIVE → GET states → signal is ACTIVE
- [ ] **NTFS guard:** apply the same post-write `JSON.parse` verification as in DK-202

### Technical Notes

**File path:** `path.join(casesDir, caseId, 'signal-states.json')`

**Read-modify-write pattern:**
```typescript
const statesPath = path.join(casesDir, caseId, 'signal-states.json');
const current: Record<string, string> = fs.existsSync(statesPath)
  ? JSON.parse(fs.readFileSync(statesPath, 'utf8'))
  : {};
current[signalId] = state;
fs.writeFileSync(statesPath, JSON.stringify(current, null, 2), 'utf8');
```

**Signal IDs are constructed by agents** (e.g. `PORT-HH-STRIKE-001`, `GEO-GE-BAY-001`). The client sends the `signal_id` it received from the context API — no lookup needed.

---

## DK-502 — Engine excludes DISMISSED signals

**Labels:** `epic:signal-trust` `priority:p0` `type:backend`
**Points:** 3
**Depends on:** DK-501
**Blocks:** DK-603

### Description

As the **system**, when computing scenario scores after `context_confirmed`, I must exclude any signals the operator has dismissed, so that the recommendation reflects only the operator's validated intelligence context.

### Acceptance Criteria

- [ ] When the `context_confirmed` event fires, signal states for the case are loaded from `signal-states.json`
- [ ] `mergeSignals()` (or its caller) filters out signals with state `'DISMISSED'` before passing to the engine
- [ ] The engine executes on the filtered signal list — dismissed signals affect no score, no modifier, no approval gate flag
- [ ] If all signals are dismissed: engine executes with `[]` — produces valid output from financial parameters alone (no error thrown)
- [ ] The unfiltered agent output is **not** modified — filtering happens at the merge/engine boundary, not at the agent level. Agent outputs remain intact for any future audit use.
- [ ] Unit test: seed a case where one signal has `recommended_engine_effect: 'flag_second_approval'` → dismiss that signal → re-run engine → `second_approval_required` is `false` (assuming no financial threshold trigger)
- [ ] Unit test: dismiss all signals → engine returns valid `ScenarioEngineOutput` with no errors

### Technical Notes

**Where to add the filter** — locate where `AgentRunner` results are passed to the engine. This is likely in the `context_confirmed` event handler or the consequence layer. The filter sits between `AgentRunner.run()` and `ScenarioEngine.evaluate()`:

```typescript
const rawSignals = await agentRunner.run(context);
const states = loadSignalStates(caseId);  // reads signal-states.json
const activeSignals = rawSignals.filter(s => states[s.signal_id] !== 'DISMISSED');
const engineInput = buildEngineInput(context, activeSignals);
const result = scenarioEngine.evaluate(engineInput);
```

**`loadSignalStates()`** — thin wrapper around the file read in DK-501. Keep it synchronous (the file read is fast for a small JSON object).

---

## DK-503 — Signal dismiss / restore UI

**Labels:** `epic:signal-trust` `priority:p0` `type:frontend`
**Points:** 3
**Depends on:** DK-501
**Blocks:** DK-702

### Description

As **Lena**, I want a Dismiss button on each signal card so that I can act on my professional judgment about whether a signal applies to my specific shipment — without it silently influencing a recommendation I don't agree with.

### Acceptance Criteria

- [ ] Each signal card on `/disruption/:caseId` has a **"Dismiss"** button when state is `ACTIVE`
- [ ] Clicking Dismiss: calls `PATCH .../signals/:signalId` with `{ state: 'DISMISSED' }`, updates card immediately on success (optimistic UI acceptable — roll back on error)
- [ ] Dismissed card appearance: reduced opacity (60%), **"Dismissed"** badge (not colour-only — accessibility), "Restore" button replaces "Dismiss"
- [ ] Clicking Restore: calls `PATCH` with `{ state: 'ACTIVE' }`, card returns to normal appearance
- [ ] Signal state counter above the panel: **"3 active · 1 dismissed"** — updates in real time without page reload
- [ ] On page load: `GET /api/cases/:caseId/signals/states` is called first; signal cards render with correct initial state
- [ ] Dismissed signals are visually de-emphasised but still visible (not hidden) — Lena can always restore
- [ ] If the PATCH call fails: show a brief inline error on the card ("Could not update — try again"), revert to previous state
- [ ] Works correctly with CASE-001's existing signals (backward compatibility — all default to ACTIVE since no `signal-states.json` exists)

### Technical Notes

**Load order on context page:**
1. Fetch context (`GET /api/cases/:caseId/context`)
2. Fetch signal states (`GET /api/cases/:caseId/signals/states`)
3. Render signal cards with merged state

Both fetches can be made in parallel (`Promise.all`).

**Optimistic update pattern:**
```typescript
// Store previous state, update immediately, roll back if request fails
const prev = signalStates[signalId];
setSignalStates(s => ({ ...s, [signalId]: 'DISMISSED' }));
try {
  await patchSignalState(caseId, signalId, 'DISMISSED');
} catch {
  setSignalStates(s => ({ ...s, [signalId]: prev }));
  showInlineError(signalId, 'Could not update — try again');
}
```

**Do not hide dismissed signals.** Hiding them is tempting but makes the product feel like it's making choices for the operator. Greyed-out-but-visible is the right UX.

---

---

# EPIC E6 — Decision Room Transparency

**Goal:** The Decision Room shows what assumptions produced each recommendation. Thomas can see why approval is required. Lena can trace every number back to an input she controls.

---

## DK-601 — Financial assumptions panel

**Labels:** `epic:decision-room` `priority:p1` `type:frontend`
**Points:** 3
**Depends on:** DK-202 (case must exist with financial data)
**Blocks:** —

### Description

As **Lena and Thomas**, I want to see the financial parameters driving the scenario scores in the Decision Room, so that I can immediately validate the assumptions before acting on the recommendation — and identify the moment a number is wrong.

### Acceptance Criteria

- [ ] Decision Room includes a collapsible **"Inputs"** panel below the scenario header
- [ ] Collapsed by default with toggle label **"Show inputs ▾"**
- [ ] Panel displays:
  - Daily downtime cost (€) — formatted as `€XX,XXX/day`
  - Cost source badge: **"Finance validated"** (green), **"Management estimate"** (amber), **"Operator estimate"** (grey)
  - Predicted delay (days) — with source label: **"Override"** if `predicted_delay_days` was manually set, **"System estimate"** otherwise
  - Replacement cost (€) — `"Not provided"` if REPLACE scenario unavailable
  - Freight cost (€) — `"Not provided"` if REROUTE scenario unavailable
  - Required by date — formatted as `DD MMM YYYY`
- [ ] Panel is **read-only** in Sprint 5 — no inline editing
- [ ] Panel renders correctly for CASE-001 (backward compatibility)
- [ ] Toggle state is remembered for the session (not reset on every render)

### Technical Notes

Data comes from `disruption-context.json` — specifically `shipment_context.daily_downtime_cost_eur`, `daily_downtime_cost_source`, `required_by`, and the scenario inputs already on the context.

`daily_downtime_cost_source` may not exist on CASE-001 (created before Sprint 5). Add a fallback: `source ?? 'management_estimate'`.

**Cost source badge** — same component can later be used in the intake form and context review page. Extract as `<CostSourceBadge source={...} />` for reuse.

---

## DK-602 — Configurable approval gate threshold

**Labels:** `epic:decision-room` `priority:p0` `type:config`
**Points:** 1
**Depends on:** —
**Blocks:** DK-702 (dry run must trigger the gate)

### Description

As an **operator**, the second approval gate must fire at a configurable threshold so that the pilot customer experiences the governance workflow with their actual financial values — and so future customers can set their own policy.

### Acceptance Criteria

- [ ] `scenario-defaults.json` (or equivalent config file) contains `"second_approval_threshold_eur": 100000`
- [ ] Engine reads threshold from config at runtime — **no hardcoded `300000`** anywhere in engine code
- [ ] Gate fires when **any** of these is true:
  - `total_financial_exposure >= second_approval_threshold_eur`
  - `execution_complexity === 'HIGH'`
  - Any merged signal has `recommended_engine_effect === 'flag_second_approval'`
- [ ] Unit test: exposure `€120,000`, threshold `€100,000` → `second_approval_required: true`
- [ ] Unit test: exposure `€80,000`, no HIGH complexity, no flag_second_approval signal → `second_approval_required: false`
- [ ] Config change takes effect without a code change or server restart (read at engine evaluation time, not at startup)
- [ ] Old threshold value (€300,000) is removed or clearly commented out — no ambiguity about which value is in effect

### Technical Notes

Search for `300000` in `packages/engine/src/` and replace with a config read. If the engine config is read from a JSON file, use `JSON.parse(fs.readFileSync(...))` at the top of the evaluation call — not cached in module scope.

**Estimated time: 15 minutes.** Do this first on Day 1 — it's a quick win and unblocks the approval gate narrative for the dry run.

---

## DK-603 — Decision Room reflects current signal state

**Labels:** `epic:decision-room` `priority:p1` `type:frontend`
**Points:** 3
**Depends on:** DK-502
**Blocks:** —

### Description

As **Lena**, when I dismiss a signal on the context page and then open the Decision Room, I want the scenario scores to reflect my updated context — so that the "what if I dismiss this signal?" question has a visible answer.

### Acceptance Criteria

- [ ] Decision Room scenario scores are computed from the current signal state at the time of page load
- [ ] If Lena dismisses a signal, navigates to Decision Room, and returns to context page — signal remains dismissed
- [ ] Decision Room has a **"Recalculate"** button (acceptable alternative to automatic background recalculation for Sprint 5)
- [ ] Clicking Recalculate: re-fetches scenarios by calling `POST /api/cases/:caseId/events` with `context_confirmed` — or a new dedicated `POST /api/cases/:caseId/recalculate` endpoint
- [ ] After recalculation: scenario scores update visibly; if WAIT cost changed due to signal dismissal, the new value is shown
- [ ] Stale scenario data (from a previous run with different signal states) is not silently displayed — either recalculate on load or show a "Signals updated — recalculate to refresh" banner
- [ ] Does not break CASE-001 existing scenario display (backward compatibility)

### Technical Notes

The simplest implementation for Sprint 5: when the Decision Room loads, check if `signal-states.json` was modified after the last scenario computation timestamp. If yes, show the "Signals updated" banner. The Recalculate button re-triggers the `context_confirmed` consequence, which runs agents + engine with current signal states (via DK-502 filter).

This avoids automatic background polling while still giving Lena explicit control over when to recalculate.

---

---

# EPIC E7 — Pilot Process

---

## DK-701 — Nick seed checklist

**Labels:** `epic:pilot-process` `priority:p1` `type:documentation`
**Points:** 1
**Depends on:** Working system (any time in Week 2)
**Blocks:** DK-702

### Description

As **Nick**, I want a one-page checklist that tells me exactly what customer data I need before seeding a case, so that I can prepare for any pilot session without asking Amir.

### Acceptance Criteria

- [ ] File created at `docs/pilot/nick-seed-checklist.md`
- [ ] Exactly 10 questions — one per required or critical optional input
- [ ] Each question has three columns: **What to ask**, **Why it matters**, **What happens if missing**
- [ ] A **"Before the session"** section with 5 validation steps Nick runs against the seeded case before going live
- [ ] A **"During the session"** section with 3 things to say when the customer asks about data sources
- [ ] Total read time under 5 minutes
- [ ] Written in plain language (not engineering language) — Nick is not technical

### Technical Notes

This is a documentation task, not a code task. Amir writes it from the perspective of what a non-technical person needs to know. Content should be drawn from the risk analysis: Risk 1 (route), Risk 2 (delay), Risk 7 (cost source), Risk 4 (onboarding alone).

---

## DK-702 — Nick solo dry run (Sprint 5 exit gate)

**Labels:** `epic:pilot-process` `priority:p0` `type:process`
**Points:** (not estimated — process task, not code)
**Depends on:** All code stories complete, DK-701
**Blocks:** Nothing — this is the final gate

### Description

**Nick** runs the complete pilot onboarding flow independently. Amir is **not available to help** during the run. Every place Nick pauses, gets confused, or hits an error is a blocking bug.

### Pass Criteria (all must be true)

- [ ] Nick opens `/cases/new` in a browser with no help
- [ ] Nick fills the intake form using a customer data sheet — vessel, route, costs, replacement, freight
- [ ] Nick submits and is redirected to the disruption context page
- [ ] Nick reviews signals on the context page
- [ ] Nick dismisses at least one signal he judges irrelevant
- [ ] Nick confirms context and the engine runs
- [ ] Nick navigates to the Decision Room
- [ ] Nick sees all scenario cards with financial details
- [ ] Nick opens the financial inputs panel and validates the numbers
- [ ] Nick selects a scenario — approval gate fires
- [ ] Nick (playing Lena's supervisor) approves the decision
- [ ] The case is complete and appears on the dashboard with state `decision_approved`
- [ ] **Total time: under 15 minutes**
- [ ] **Nick's blocking question count: 0**
- [ ] The case used is **not CASE-001** — it must be a new case with different vessel and costs
- [ ] CASE-001 still loads and displays correctly after the dry run (regression check)

### Failure Handling

If Nick has a blocking question: that question is a bug. Amir fixes it. Nick re-runs the segment.
If Nick finishes in 20+ minutes: the UX has a flow problem. Identify the slowest segment. Fix it.
The dry run does not end until all pass criteria are met.

---

---

# A. Week 1 Implementation Plan

**Days 1–5 | Goal: Complete case creation end-to-end. Nick can go from blank browser to disruption context page for a new case.**

---

### Day 1 — Foundation (8 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-602** — Configurable approval threshold | 1 | Start here. 15 minutes. Quick win, unblocks dry run narrative. |
| Morning | **DK-101** — Date validity filter | 3 | Independent, clean implementation. Extract `isCurrentlyValid` utility first, then apply to all 4 agents. Update fixture `valid_until` dates at the end. |
| Afternoon | **DK-201** — `buildDisruptionContext` (start) | 3 of 5 | Define `CreateCaseRequest` interface. Write the function skeleton. Wire mock prediction adapter. Do NOT start file I/O yet. |

**Day 1 commit:** `feat: date validity filter + configurable approval threshold + case builder skeleton`

---

### Day 2 — Core API (10 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-201** — `buildDisruptionContext` (finish) | 2 of 5 | Complete all field mappings, cost source, route profile passthrough. Write 3 unit tests. Merge. |
| Afternoon | **DK-202** — `POST /api/cases` | 5 | Route handler → validation → `buildDisruptionContext` → file writes → post-write verification. Do NOT build the form yet — test with curl/Postman. |

**Day 2 commit:** `feat: POST /api/cases — case creation with file persistence and validation`

**Day 2 checkpoint:** Run `curl -X POST /api/cases` with a valid payload. Verify `mock/cases/CASE-xxx/` appears with two valid JSON files. This is the foundation everything else builds on.

---

### Day 3 — Dashboard backend + frontend (8 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-301** — `GET /api/cases` | 3 | Read case directories, merge state + context files, return sorted summaries. Handle CASE-001 backward compat. |
| Afternoon | **DK-302** — Dashboard page `/dashboard` | 5 | Case cards, state badges, action buttons, "+New Case", empty state, loading state. Wire to `GET /api/cases`. |

**Day 3 commit:** `feat: GET /api/cases + dashboard page with case listing`

**Day 3 checkpoint:** Open the dashboard. CASE-001 appears. Clicking its action button navigates correctly.

---

### Day 4 — Intake form (structure + validation) (7 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-401** — Intake form structure | 4 of 8 | Build all fields, sections, layout. No API wiring yet. All fields render, cost source dropdown works, group sections visible. Commit this separately. |
| Afternoon | **DK-402** — Form validation | 2 | Add client-side validation rules, inline error display, group validation for replacement and freight sections. |

**Day 4 commit:** `feat: intake form layout and client-side validation`

---

### Day 5 — Intake form API wiring + route profile (6 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-401** — API wiring + redirect | 4 of 8 (remaining) | Wire form submit to `POST /api/cases`. Handle 201 redirect. Handle 400 server errors mapped to field-level display. Handle 5xx banner. |
| Afternoon | **DK-102** — Route profile fixture support | 3 | Add `route_profile` to `AgentContext`. Update fixture JSON. Update relevance filters in all 4 agents. Add unit tests. |

**Day 5 commit:** `feat: intake form API wiring + route profile fixture coverage`

**Day 5 checkpoint (End of Week 1):** Nick creates a new case using the intake form. A different case with different vessel/route/cost appears on the dashboard. Clicking it opens disruption context with signals. Date-valid signals only. Route profile fixtures match.

**Week 1 total: 39 points**

---

# B. Week 2 Implementation Plan

**Days 6–10 | Goal: Signal trust layer, Decision Room transparency, dry run, ship.**

---

### Day 6 — Signal state backend + engine filter (6 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-501** — Signal state API | 3 | PATCH + GET endpoints, file persistence, NTFS guard. Test with curl before building UI. |
| Afternoon | **DK-502** — Engine signal filter | 3 | Load states, filter at merge boundary, pass filtered list to engine. Unit test: dismiss `flag_second_approval` signal → gate no longer fires (financial-only case). |

**Day 6 commit:** `feat: signal state API + engine dismissal filter`

**Day 6 checkpoint:** PATCH a signal as DISMISSED. Re-run engine. Confirm the dismissed signal's effect is absent from output.

---

### Day 7 — Signal dismiss UI (3 points + buffer)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-503** — Signal dismiss UI | 3 | Dismiss/Restore buttons, state counter, optimistic updates, page-load state fetch. |
| Afternoon | **Integration testing** | (buffer) | Test the full signal flow: create case → context page → dismiss → confirm → Decision Room → scenarios reflect dismissed state. Fix edge cases. |

**Day 7 commit:** `feat: signal dismiss/restore UI with optimistic updates`

**Day 7 checkpoint:** Dismiss the Red Sea signal on a Hamburg case. Confirm context. Verify WAIT scenario cost is lower (Red Sea signal was not `flag_second_approval` but confirms engine is reading state).

---

### Day 8 — Decision Room transparency (6 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-601** — Financial assumptions panel | 3 | Collapsible panel, all inputs displayed, cost source badges, read-only. Backward compat with CASE-001. |
| Afternoon | **DK-603** — Decision Room signal-aware recalc | 3 | Stale-state banner, Recalculate button, re-trigger engine with current signal states. |

**Day 8 commit:** `feat: financial assumptions panel + signal-aware recalculation in Decision Room`

---

### Day 9 — Polish, checklist, edge cases (5 points)

| Time | Task | Points | Notes |
|------|------|--------|-------|
| Morning | **DK-403** — Scenario exclusion messaging | 2 | Info banners on context page when REPLACE/REROUTE are unavailable. Test with a case that has no replacement option. |
| Mid-morning | **DK-701** — Nick seed checklist | 1 | Write `docs/pilot/nick-seed-checklist.md`. 10 questions, 3 columns each. |
| Afternoon | **End-to-end smoke test** | (buffer) | Run full flow on both CASE-001 (regression) and a fresh CASE-002. Confirm all exit criteria observable. |

**Day 9 commit:** `feat: scenario exclusion messaging + fix sprint edge cases` + `docs: nick pilot seed checklist`

---

### Day 10 — Dry run day

| Time | Task | Notes |
|------|------|-------|
| 09:00–11:00 | **DK-702** — Nick solo dry run | Nick drives. Amir watches but does not help. Record every pause and question. |
| 11:00–13:00 | **Fix dry run blockers** | Any blocking issue Nick hit. If zero blockers: spend this time on CASE-001 regression. |
| 14:00–15:00 | **Final regression pass** | CASE-001 full flow. All four agents. Engine runs. Decision Room renders. |
| 15:00 | **Sprint 5 declared done** | All exit criteria met. Tag `sprint-5-complete` in git. |

---

---

# C. Critical Path

```
DK-201 (buildDisruptionContext)
  │
  ▼
DK-202 (POST /api/cases)          ← If this slips, EVERYTHING slips.
  │
  ├──► DK-301 → DK-302 (Dashboard)
  │
  ├──► DK-401 (Intake Form)        ← Second highest risk story.
  │
  └──► DK-501 (Signal state API)
         │
         ├──► DK-502 (Engine filter)
         │      └──► DK-603 (DR recalc)
         │
         └──► DK-503 (Signal dismiss UI)
                └──► DK-702 (Dry run)
```

**The critical path has zero slack.** If DK-201 takes two days instead of one (e.g. type system issues with `@denkkern/types`), Day 2's DK-202 and everything after it shifts by one day, and the sprint cannot complete in 10 days.

**Mitigation:** On Day 1, if DK-201 is taking longer than expected by 3pm, Amir cuts the full `CreateCaseRequest` type definition and uses a `Record<string, unknown>` intermediate type for Sprint 5 only — typed properly in Sprint 6. Speed beats correctness on the critical path.

---

# D. Highest Risk Story

## DK-401 — Intake Form (8 points)

**Why it is the highest risk:**

- Largest single story in the sprint
- Has UI and API concerns in the same story — failures in either block
- The all-or-nothing group validation (replacement, freight) is easy to get wrong in edge cases
- The "Build order" note in the story exists because this story has historically bloomed when not built incrementally
- If it ships late, DK-102 (which depends on the form field) slips with it, and Nick's dry run cannot test route profile coverage

**Early warning signal:** If DK-401 is not in a submittable-but-not-yet-wired state by end of Day 4 morning, the sprint is at risk. Escalate to the team immediately.

**Descope option if blocked:** Ship DK-401 without the route profile field (DK-102 can be cut). Nick enters route manually as text, and fixture matching uses text only. Risk 1 is partially mitigated — not fully. Acceptable for a first pilot session.

---

# E. Fastest Demoable Milestone

## End of Day 3: Dashboard + Multi-Case Support

By end of Day 3, the following is true:
- Dashboard shows CASE-001 and any newly created case
- `POST /api/cases` works (testable via curl)
- `GET /api/cases` returns real data
- CASE-001 full flow still works end-to-end (disruption → context → scenarios → Decision Room)

**This is demoable.** Nick can show the customer:
1. "Here is your case already seeded" (CASE-001 as stand-in)
2. "Here is the dashboard where you will see all your cases"
3. "Here is how we add a new one" (placeholder form or curl demo)

The intelligence layer, approval gate, and financial panel are all already working from Sprint 4. The Day 3 milestone adds the multi-case shell around them.

**If the pilot session is moved forward and the sprint is incomplete:** Day 3 is the minimum viable state. Every story after Day 3 adds trust and polish — none of them are required to demonstrate the core value proposition.

---

# F. Sprint 5 Exit Criteria

All of the following must be true before the sprint is declared complete.

### Code Criteria

- [ ] All four agents filter expired signals (`valid_until < today`) — verified by unit test
- [ ] `POST /api/cases` creates valid case files for a payload with all required fields — verified by integration test
- [ ] `GET /api/cases` returns both CASE-001 and a newly created case, sorted newest first
- [ ] Dashboard at `/dashboard` renders both cases with correct state badges and action buttons
- [ ] Intake form at `/cases/new` creates a new case on submit and redirects to `/disruption/:caseId`
- [ ] At least one signal on the new case can be dismissed; dismissed signal is excluded from engine scoring — verified manually
- [ ] Decision Room financial inputs panel shows the new case's `daily_downtime_cost_eur` and cost source badge
- [ ] Approval gate fires for a case with `total_financial_exposure >= €100,000` — verified manually
- [ ] Configurable threshold is read from config, not hardcoded — verified by grep (`grep -r "300000" packages/engine/`)

### Process Criteria

- [ ] DK-702 dry run completed: Nick ran the full flow solo in under 15 minutes with zero blocking questions
- [ ] CASE-001 regression: full flow works end-to-end after all Sprint 5 changes
- [ ] `docs/pilot/nick-seed-checklist.md` exists and has been reviewed by Nick
- [ ] No `assert { type: 'json' }` in any agent file — verified by grep (Sprint 4 carry-over check)
- [ ] `tsc --noEmit` passes on both `packages/intelligence` and `packages/engine` with no errors
- [ ] Git history is clean: each major story has its own commit with a meaningful message

### Pilot Readiness Criteria

- [ ] Nick can explain the data source for every signal in the Decision Room without asking Amir
- [ ] Nick can answer "where does that €78k/day number come from?" by pointing to the cost source badge
- [ ] Nick can explain why the approval gate fired by pointing to the financial inputs panel
- [ ] A customer who sees the Red Sea signal and says "that's not our route" gets a Dismiss button they can use immediately

---

*Document owner: Claude / Product Architect + Technical Lead*
*Companion: docs/sprints/sprint-5-backlog.md (first-pass), docs/roadmap/sprint-5-pilot-onboarding-design.md*
*Next: docs/sprints/sprint-6-issues.md (post-pilot)*
