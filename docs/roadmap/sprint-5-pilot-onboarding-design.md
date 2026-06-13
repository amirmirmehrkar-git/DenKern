---
title: Sprint 5 — Minimum Pilot Onboarding Design
version: 1.0
status: active
authors: [Claude / Product Architect + Technical Lead]
date: 2026-06-07
---

# Sprint 5 — Minimum Pilot Onboarding Design

> Starting from a blank customer. No CASE-001. No pre-seeded data.
> Shortest path to: pilot customer creates their own disruption case and receives a ranked recommendation.

---

## 1. Pilot Onboarding Workflow

A blank customer goes through exactly five steps. Everything else is automated.

```
Nick seeds case  →  Lena opens context  →  Lena confirms  →  Engine runs  →  Lena decides
     (1 min)            (2 min)              (30 sec)        (automated)      (5–10 min)
```

### Step-by-step

**Step 1 — Nick seeds the case (1 minute)**

Nick runs a CLI seed command or submits the intake form with the customer's shipment data.
A new case file is created. The case appears on the dashboard in state `disruption_alert_received`.

**Step 2 — Lena is notified and opens the disruption context**

The dashboard shows the new case. Lena clicks through.
The context page loads: prediction, business context, and agent-enriched signals.
All four agents run automatically on page load — no manual trigger.

**Step 3 — Lena reviews and confirms**

Lena reads the prediction, the risk signals, and the production deadline.
She clicks "Confirm context." This emits `context_confirmed`.

**Step 4 — Scenario engine runs (automated, <1 second)**

`context_confirmed` triggers the dispatcher consequence layer.
The engine computes REPLACE / REROUTE / WAIT scores and stores the result.
The approval gate evaluates automatically.

**Step 5 — Lena enters the Decision Room**

The Decision Room renders the ranked scenarios, financial impact, and approval gate.
If second approval is required, the confirm button is locked until the supervisor acts.
Lena selects a scenario and the supervisor approves. Decision is recorded.

---

## 2. Minimum Required Data

This is the smallest dataset that produces a meaningful recommendation.

### Required (the engine cannot run without these)

| Field | Source | Why required |
|---|---|---|
| `vessel_name` | Nick / intake form | Identifies the shipment |
| `destination` | Nick / intake form | Agent route-matching |
| `route` | Nick / intake form | Agent route-matching (geo, weather, maritime) |
| `current_location` | Nick / intake form | Context for Lena |
| `daily_downtime_cost_eur` | Nick / intake form | Core of every financial calculation |
| `required_by` | Nick / intake form | Determines delay impact, deadline urgency |
| `critical_part` | Nick / intake form | Contextual label for Lena |

### Required for REPLACE scenario

| Field | Default if absent | Notes |
|---|---|---|
| `inventory.replacement_available` | `false` | If false, REPLACE scenario is excluded |
| `inventory.replacement_cost_eur` | — | Required if replacement_available = true |
| `inventory.replacement_arrival_date` | — | Required if replacement_available = true |
| `inventory.replacement_location` | — | Label only |

### Required for REROUTE scenario

| Field | Default if absent | Notes |
|---|---|---|
| `freight_options[0]` | empty array | If empty, REROUTE scenario is excluded |
| `freight_options[0].cost_eur` | — | Required per option |
| `freight_options[0].estimated_arrival_date` | — | Required per option |

### Defaulted / mocked at pilot

| Field | Default | Why defaultable |
|---|---|---|
| `prediction` | James mock adapter (4–6 day delay, 0.68 confidence) | Mock adapter already returns plausible values |
| `weather_signal` | Static: medium severity, Bay of Biscay or route | Agent covers this from fixture |
| `news_signals` | Static: strike risk at destination | Agent covers this from fixture |
| `external_risk_signals` | Empty (agents provide them) | Agents run on every request |
| `harbor_congestion_signal` | 0.3 (default moderate) | Prediction mock adapter field |
| `mmsi` | `null` | Not needed for pilot |
| `shipment_id` | Auto-generated (`SHIP-{caseId}`) | Internal reference |
| `assembled_at` | `new Date().toISOString()` | Generated on creation |

### What this means in practice

A pilot customer can be onboarded with **10 fields**:

```
vessel_name, destination, route, current_location,
daily_downtime_cost_eur, required_by, critical_part,
replacement_cost_eur, replacement_arrival_date, replacement_location
```

Everything else is computed, defaulted, or provided by agents.

---

## 3. UI Screens

Four screens. Three are already largely built. One is new.

### Screen 1 — Dashboard (`/dashboard`) — NEEDS UPDATE

Currently hardcoded or non-existent as a multi-case list.

**What to add:**
- `GET /api/cases` endpoint that reads `mock/cases/*/workflow-state.json`
- Case cards: vessel name, destination, current workflow state, required_by, action button
- "+ New case" button → Screen 2
- State badges: disruption_alert_received, context_review, scenarios_generated, decision_pending, decision_approved

**Effort:** 1 day.

### Screen 2 — Intake form (`/cases/new`) — NEW

The only entirely new screen. A simple form, not a wizard.

**Fields (in order):**
```
Shipment section:
  Vessel name *
  Destination port *
  Route * (text, e.g. "English Channel — North Sea")
  Current location *

Production impact section:
  Critical part *
  Required by (date) *
  Daily downtime cost (€) *

Replacement option (optional — enables REPLACE scenario):
  Location
  Cost (€)
  Arrival date

Freight option (optional — enables REROUTE scenario):
  Via port
  Cost (€)
  Estimated arrival date
```

On submit: `POST /api/cases` → redirect to disruption context page.

**Effort:** 1.5 days.

### Screen 3 — Disruption context (`/disruption/:caseId`) — EXISTS

Already built for CASE-001. Works for any case — no changes needed to the page itself.

**What to verify:** The "Confirm context" button correctly emits `context_confirmed` for the new case ID. The workflow state machine is case-scoped (it is — by caseId param). ✓

**Effort:** 0.5 day verification + smoke test.

### Screen 4 — Decision Room (`/decision-room/:caseId`) — EXISTS

Already built for CASE-001. Works for any case by caseId.

**What to verify:** Scenario store is keyed by caseId (it is — `scenarioStore.get(caseId)`). The recommendation and financial impact panels render correctly for different shipment values. ✓

**Effort:** 0.5 day verification + smoke test.

---

## 4. APIs

### New endpoints

#### `GET /api/cases`

Returns all case summaries for the dashboard.

```typescript
// Response
interface CaseSummary {
  case_id: string;
  vessel_name: string;
  destination: string;
  route: string;
  required_by: string;
  critical_part: string;
  workflow_state: WorkflowState;
  available_actions: string[];
  assembled_at: string;
}

// Implementation: read mock/cases/*/workflow-state.json
// + extract vessel_name, destination, required_by from disruption-context.json
// Sorted by assembled_at desc
```

**Effort:** 3 hours.

#### `POST /api/cases`

Creates a new case from intake form data.

```typescript
// Request body (mirrors the intake form fields)
interface CreateCaseRequest {
  vessel_name: string;
  destination: string;
  route: string;
  current_location: string;
  critical_part: string;
  required_by: string;                       // ISO date
  daily_downtime_cost_eur: number;
  replacement_location?: string;
  replacement_cost_eur?: number;
  replacement_arrival_date?: string;
  freight_via_port?: string;
  freight_cost_eur?: number;
  freight_arrival_date?: string;
}

// What it does:
// 1. Generate caseId = `CASE-${Date.now().toString(36).toUpperCase()}`
// 2. Build DisruptionContext from request fields + mock prediction
// 3. Write mock/cases/:caseId/disruption-context.json
// 4. Write mock/cases/:caseId/workflow-state.json (state: disruption_alert_received)
// 5. Return { case_id, redirect: `/disruption/${caseId}` }
```

**Effort:** 4 hours.

### Existing endpoints — no changes needed

| Endpoint | Status |
|---|---|
| `GET /api/cases/:caseId/context` | Works for any caseId |
| `POST /api/cases/:caseId/events` | Works for any caseId |
| `GET /api/cases/:caseId/scenarios` | Works for any caseId |
| `GET /api/workflow-state/:caseId` | Works for any caseId |

---

## 5. Persistence Model

### Current (Sprint 4)

```
mock/
  cases/
    CASE-001/
      disruption-context.json     ← assembled context snapshot
      workflow-state.json         ← current state + available actions
      external-risk-signals.json  ← (redundant — already in disruption-context)
      alert.json                  ← source alert
      prediction.json             ← (redundant — already in disruption-context)
      shipment-context.json       ← (redundant — already in disruption-context)
```

### Sprint 5 (file-based, case-scoped)

```
mock/
  cases/
    CASE-{id}/                              ← created by POST /api/cases
      disruption-context.json               ← written on case creation
      workflow-state.json                   ← updated by event dispatcher
      audit-trail.jsonl                     ← NEW: append-only agent audit log
```

**Key decisions:**

1. `disruption-context.json` is the single source of truth for each case. No separate prediction.json or shipment-context.json. The assembly step happens at creation time and the file is frozen.

2. `workflow-state.json` is mutable. The event dispatcher writes to it on every event.

3. `audit-trail.jsonl` is append-only. Each line is one `AgentExecutionResult`. Never overwritten.

4. Scenario results remain in-memory (`scenarioStore`). This is acceptable for pilot — if the server restarts, the operator re-confirms context to recompute. A persistent scenario cache is Sprint 6.

### Mock adapter write path (the new method)

```typescript
// Add to MockDisruptionAdapter:
async createCase(req: CreateCaseRequest): Promise<string> {
  const caseId = `CASE-${Date.now().toString(36).toUpperCase()}`;
  const context = buildDisruptionContext(caseId, req);   // pure function
  const state = { state: 'disruption_alert_received', available_actions: ['open_context'] };

  fs.mkdirSync(`mock/cases/${caseId}`, { recursive: true });
  fs.writeFileSync(`mock/cases/${caseId}/disruption-context.json`, JSON.stringify(context, null, 2));
  fs.writeFileSync(`mock/cases/${caseId}/workflow-state.json`, JSON.stringify(state, null, 2));
  return caseId;
}

async listCases(): Promise<CaseSummary[]> {
  const caseDirs = fs.readdirSync('mock/cases');
  return caseDirs.map(id => {
    const state = JSON.parse(fs.readFileSync(`mock/cases/${id}/workflow-state.json`, 'utf8'));
    const ctx   = JSON.parse(fs.readFileSync(`mock/cases/${id}/disruption-context.json`, 'utf8'));
    return { case_id: id, vessel_name: ctx.shipment_context.vessel_name, ...state };
  }).sort((a, b) => b.assembled_at.localeCompare(a.assembled_at));
}
```

---

## 6. What Can Remain Mocked

These items produce correct, meaningful output for the pilot customer without real implementation:

| Component | Mock behaviour | Why acceptable |
|---|---|---|
| James prediction model | `MockPredictionAdapter`: returns 4–6 day delay with 0.65–0.75 confidence, scaled to `required_by` date | Customer trusts the workflow, not the exact number. Real model is Sprint 6/7. |
| Agent fixtures | All four agents use fixture JSON files keyed to destination and route | Signals are plausible for any European maritime route. Customer won't notice fixtures. |
| `harbor_congestion_signal` | Default 0.3 in `MockPredictionAdapter` | Adds modest WAIT modifier boost. Not visible to operator. |
| `weather_signal` in context | Static medium-severity entry for the route | Agent enrichment already adds weather — context-level field is backup. |
| Scenario engine config | `scenario-defaults.json` unchanged | Thresholds and modifiers are correct for pilot financial ranges. |
| Freight cost data | Operator enters manually in intake form | No API integration needed for pilot. |
| AIS vessel position | Operator enters `current_location` as text | "Off Portsmouth" is sufficient context. |

---

## 7. What Absolutely Must Be Real

These items cannot be mocked for a pilot customer. If they don't work, the pilot fails.

| Component | Why it must be real |
|---|---|
| **Case creation + persistence** | The customer's disruption data must survive a page reload. File write must succeed. |
| **Multi-case isolation** | CASE-001's data must not bleed into CASE-002. State machine must be scoped to caseId. |
| **Date validity filter in agents** | If the server is running during a demo and fixture dates expire mid-session, trust is destroyed. Must filter on `valid_until`. |
| **`context_confirmed` → engine dispatch** | The consequence layer must actually trigger scenario computation for the new case. |
| **Dashboard case listing** | The customer's case must be findable. A broken or empty dashboard ends the session. |
| **Approval gate for real financial values** | The customer's `daily_downtime_cost_eur` must flow through to the gate. If €120k/day × 4 days = €480k but the gate shows CASE-001's values, trust is broken. |

---

## 8. Sprint 5 Build Plan (10 working days)

| Day | Task | Owner | Deliverable |
|---|---|---|---|
| 1 | Date validity filter in all 4 agents | Amir | `valid_until` check, 4 unit tests |
| 1–2 | `buildDisruptionContext()` pure function | Amir | Takes `CreateCaseRequest`, returns valid `DisruptionContext` with mock prediction |
| 2–3 | `POST /api/cases` + mock adapter `createCase()` | Amir | Creates case files, returns caseId |
| 3–4 | `GET /api/cases` + mock adapter `listCases()` | Amir | Returns sorted case summaries |
| 4–5 | Dashboard page | Amir | Lists all cases, links to disruption context, "+ New case" button |
| 5–7 | Intake form (`/cases/new`) | Amir | 10-field form, validates, calls POST /api/cases, redirects |
| 7–8 | Audit trail persistence | Amir | Agent execution results appended to `audit-trail.jsonl` |
| 8–9 | Smoke test: seed CASE-002 from blank | Amir + Nick | Walk entire flow with a different vessel/destination/cost |
| 9–10 | E2E test: context + scenarios + decision room | Amir | 3 Playwright tests on the new case path |
| 10 | Nick onboarding dry run | Nick | Nick seeds a new case without Amir's help. Time it. |

**Sprint 5 exit criteria:**
- Nick can seed a new case from the intake form without writing code
- The new case has a different vessel, destination, and daily cost from CASE-001
- The Decision Room shows the correct financial figures for that case
- No expired signals appear
- Audit trail file exists and has entries

---

## The Three Versions

### The 2-week pilot version

**What it is:** Sprint 5 complete. Nick manually seeds cases. All computation is automatic. Lena gets a real recommendation for her real disruption.

**Workflow:**
1. Nick enters data in the intake form (or runs `pnpm seed:case` with the customer's shipment data)
2. Lena opens the case, reviews the prediction and signals, confirms
3. The engine ranks REPLACE / REROUTE / WAIT with the customer's actual cost figures
4. Lena and the supervisor make the decision

**What works:** End-to-end flow for any European maritime disruption with inventory and freight data. All financial calculations are real. Approval gate fires on real values.

**What doesn't work:** No signal editing by operator. No outcome recording. No real prediction model (mock adapter). No real agent feeds (fixtures, but plausible). Server restart loses in-progress scenario results.

**Honest limitation to set with customer:** "The intelligence signals are currently from curated sources that we've validated for European maritime routes. We'll add your specific trade lanes in the next sprint."

**Engineering cost:** ~7–8 days of Amir's time.

---

### The 1-month pilot version

**What it is:** Sprint 5 + Sprint 6 complete.

**Additions over 2-week version:**
- Operator can confirm/dismiss/edit signals before context_confirmed (`PATCH /api/cases/:caseId/signals` + signal review UI)
- Decision outcome recording (actual arrival date, actual production impact)
- Case intake via webhook / email alert (Nick can trigger from customer's alert system)
- Scenario results persisted to file (survive server restart)
- A second customer case variant with different trade lane validated

**What works:** Full loop — disruption in → decision out → outcome recorded. Nick can onboard a new customer without engineering involvement.

**What doesn't work:** No real prediction model. No real agent feeds. No customer-specific signal rules. No multi-tenant data isolation.

**Engineering cost:** ~8–10 additional days. Total: 16–18 days of Amir's time over 4 weeks.

---

### The production version

**What it is:** The product a paying customer uses on their real disruptions daily, with confidence in the data quality.

**Additions over 1-month version:**

**Data:**
- Real AIS vessel position feed (James + Amir)
- Real port status feeds for Hamburg, Rotterdam, Bremen, Antwerp (high-priority European ports)
- Real maritime weather (Met Office / DWD marine)
- Live connection to customer's ERP for `daily_downtime_cost_eur`, `required_by`, inventory

**Intelligence:**
- Date-scoped signal cache (avoid re-fetching within TTL)
- Customer-specific signal rules (override layer — Sprint 6/7)
- Decision memory (surface previous similar decisions)

**Platform:**
- Database persistence (PostgreSQL) replacing file store
- Multi-tenant isolation (one schema per customer, or row-level security)
- Auth (operators authenticated, supervisor approval via signed token)
- Webhook intake (alert from TMS fires `POST /api/cases` automatically)

**Recommendation quality:**
- Outcome data feeds back to James' model
- A/B comparison: what DenkKern recommended vs. what the customer decided

**Engineering cost:** 6–9 sprints beyond the 1-month version. Requires James on full-time feed integration and Amir on platform architecture.

---

## Boundary Summary

```
2-WEEK PILOT                     1-MONTH PILOT                    PRODUCTION
────────────────────────────     ────────────────────────────     ────────────────────
Manual case seeding (Nick)   →   Intake form + webhook        →   ERP/TMS integration
Mock prediction model        →   Mock prediction (still)      →   James real model
Fixture agent feeds          →   Fixture feeds + 1 real AIS   →   All real feeds
No signal editing            →   Signal confirm/dismiss        →   Customer rule engine
No outcome recording         →   Basic outcome form           →   Full feedback loop
File-based persistence       →   File + scenario cache        →   PostgreSQL
One customer, one config     →   2–3 customers, manual config →   Multi-tenant SaaS
```

The 2-week pilot validates the workflow and the narrative.
The 1-month pilot validates daily usability and operator trust.
Production validates commercial scale and data quality.

Do not build production before the 2-week pilot has a paying customer.
Do not build the 1-month pilot before the 2-week pilot has run a real disruption.

---

*Document owner: Claude / Product Architect + Technical Lead*
*Companion: docs/roadmap/sprint-5-7-roadmap.md*
