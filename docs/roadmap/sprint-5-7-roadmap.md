---
title: DenkKern Development Roadmap — Sprint 5–7
version: 1.0
status: active
authors: [Claude / Product Architect + Technical Lead]
date: 2026-06-05
context: Post Sprint 4 + P0 fixes. Pilot readiness 80/100. CASE-001 end-to-end verified.
---

# DenkKern Development Roadmap — Sprint 5–7

> **Organising principle:** Every item is evaluated through one lens — what is the shortest path from today's demo to a paying pilot customer?  
> Architecture elegance is not a priority. Pilot success, customer trust, and learning velocity are.

---

## Current State (Post Sprint 4 + P0 Fixes)

| Dimension | Status |
|---|---|
| Pilot readiness | 80/100 — above 70 demo threshold |
| End-to-end flow | Agent → Signal → Merge → Engine → Decision Room — verified |
| CASE-001 | Executes fully. All P0 fixes committed. |
| Known gaps | Date validity in agents, geo/supplier unit tests, audit trail in-memory |
| Missing write paths | No operator signal confirm, no case intake, no decision outcome recording |
| Multi-case | Not implemented. Pilot customer cannot onboard their own disruptions. |

---

## The Shortest Path to a Paying Pilot Customer

A pilot customer needs four things DenkKern does not yet fully provide:

1. **Onboarding** — they need to bring their own disruptions into the system, not just CASE-001
2. **Trust** — they need to see that the system is correct, auditable, and won't embarrass them
3. **Agency** — operators need to be able to confirm, correct, or override what the system surfaces
4. **Proof** — after the decision is made, they need to show internally that it worked

Everything else is downstream of those four. Items that don't serve one of them are post-pilot.

---

## Candidate Item Evaluation

### 1. Date Validity Enforcement in Agents

**Why it matters:** Agents currently emit all signals from fixtures regardless of `valid_until`. After P0-1 fixed the dates manually, this is invisible in the demo. But in a real pilot with live or semi-live data, expired signals will appear and destroy operator trust within the first week.

**Customer value:** Clean, current intelligence. "Why is the system telling me about a strike that ended yesterday?" is a support ticket that ends pilots.

**Demo value:** Low — P0-1 masks this for now.

**Pilot value:** High. The first time a real signal expires during a pilot this becomes a P0 incident.

**Technical effort:** Low. Add a `now >= valid_from && (valid_until == null || now <= valid_until)` filter in each agent's `run()` before emitting signals. One line per agent, one test per agent.

**Dependencies:** None.

**Priority: P0 — Sprint 5 day 1.**

---

### 2. Full E2E Test Coverage (Signal → Engine → Gate → Decision Room)

**Why it matters:** Currently there is no single test that exercises the entire path from `AgentContext` through to `second_approval_required` and the rendered UI state. Each layer is tested in isolation but the seams are not. A refactor in any one layer can silently break the demo.

**Customer value:** None visible. Internal confidence only.

**Demo value:** Prevents demo breakage. The worst possible demo outcome is "let me refresh that" three times in front of a customer.

**Pilot value:** High. Pilot customers expect reliability. A broken demo during a pilot call with a VP is a lost deal.

**Technical effort:** Medium. The evidence script written in Sprint 4 covers the backend path (agent → merge → engine). What's missing is a Playwright or Cypress test covering: (1) GET /api/cases/CASE-001/context returns correct merged signals, (2) GET /api/cases/CASE-001/scenarios returns correct recommendation, (3) Decision Room page renders signal panel, scenario matrix, and approval gate. Three tests, maybe four hours of work.

**Dependencies:** Dev server must be runnable in CI (Next.js `next build && next start`).

**Priority: P0 — Sprint 5.**

---

### 3. Multi-Case Support

**Why it matters:** This is the single biggest gap between the current demo and a usable pilot product. CASE-001 is hardcoded. The pilot customer will have real disruptions — a different vessel, a different port, a different part. Without multi-case support there is no pilot, there is only a demo.

**Customer value:** Can actually use the product for their real disruptions.

**Demo value:** High. Being able to say "here is last week's disruption for your Hamburg shipment" is categorically more compelling than "here is our fictional MSC Barcelona scenario."

**Pilot value:** Critical. This is the enabler. Without it nothing else matters.

**Technical effort:** Medium-high. The mock adapter already supports multiple cases by file path (`mock/cases/:caseId/`). What's needed:
  - Case listing endpoint (`GET /api/cases`)
  - Case creation endpoint or seeding script (`POST /api/cases` or a CLI)
  - Dashboard that shows all open cases, not just a hardcoded link to CASE-001
  - A workflow to create a new alert/disruption and have it enter the system

  The hardest part is case creation — defining what fields are required and how an alert becomes a case. A minimal version is a seed script (Amir runs `pnpm seed --case CASE-002 --vessel "Maersk Eindhoven" --destination Rotterdam`) and a dashboard listing all cases. That alone unlocks pilot onboarding.

**Dependencies:** Dashboard page (may already exist), workflow state machine generalisation.

**Priority: P0 — Sprint 5. Blocking everything else for pilot.**

---

### 4. Agent Audit Trail Persistence

**Why it matters:** The `AgentAuditTrail` is in-memory and cleared on every process restart. In a demo this is invisible. In a pilot, when a customer's IT security team or legal team asks "what did the system do and when?", the answer is currently "we don't know after the last restart."

**Customer value:** Accountability. Enterprise buyers require audit trails — they need to be able to answer internal compliance questions.

**Demo value:** Low — no one asks during a demo.

**Pilot value:** High. The first audit question kills the pilot if this isn't answered.

**Technical effort:** Low-medium. Write audit entries to the mock adapter file store as JSON lines (`mock/cases/:caseId/audit-trail.jsonl`). The `AgentAuditTrail` class already has the right shape — it just needs a `persist()` hook. For the pilot, file-based is fine. Database comes later.

**Dependencies:** Mock adapter write capability (already exists for workflow state).

**Priority: P1 — Sprint 5.**

---

### 5. Operator Signal Review + Confirm Step

**Why it matters:** Currently Lena sees agent signals in the Decision Room but cannot interact with them. She cannot say "yes, I know about this strike, confirm it" or "this Red Sea signal is not relevant to our vessel." The system decides for her. That undermines trust and removes the human-in-the-loop value proposition.

**Customer value:** Operator agency. The customer is buying a decision support tool, not an autonomous decision system. The distinction matters enormously to enterprise buyers.

**Demo value:** High. "Lena can confirm or dismiss signals before the engine runs" is a compelling demo beat that answers the "what if the AI is wrong?" question.

**Pilot value:** Critical for trust. Operators who feel overruled by the system stop using it.

**Technical effort:** Medium. Two parts:
  1. A signal review step in the disruption context page — show agent signals, allow confirm/dismiss/edit before `context_confirmed`
  2. The write path: `PATCH /api/cases/:caseId/signals` that writes confirmed signals to the case record

  The merge logic already handles this correctly (static wins). What's missing is the UI and the write endpoint.

**Dependencies:** Item 3 (multi-case). Item 7 (PATCH endpoint).

**Priority: P1 — Sprint 5/6.**

---

### 6. Case Intake Workflow

**Why it matters:** How does a new disruption enter DenkKern? Currently the answer is "Amir seeds it manually." In a pilot the answer needs to be "the alert fires, the case opens, Lena is notified." Without a case intake path the pilot customer cannot use the product reactively — which is the entire value proposition.

**Customer value:** The product works when they actually have a disruption, not just when a demo is pre-loaded.

**Demo value:** Medium. A live "new alert just came in" moment in a demo is powerful.

**Pilot value:** Very high. The pilot customer is paying for real disruption support, not demo support.

**Technical effort:** Medium. Minimum viable: a `POST /api/cases` endpoint that accepts an alert payload and creates a case with `disruption_alert_received` state. Pair with Nick's customer onboarding — he can manually trigger this via a UI form or webhook from their ERP/TMS.

**Dependencies:** Item 3 (multi-case), alert type schema.

**Priority: P1 — Sprint 6.**

---

### 7. PATCH /api/cases/:caseId/signals

**Why it matters:** This is the write path for operator-confirmed signals — the backend half of Item 5. Without it, the operator review UI has nowhere to persist.

**Customer value:** Enables operator agency (see Item 5).

**Demo value:** Needed for signal review demo beat.

**Pilot value:** Required for Item 5 to work in production.

**Technical effort:** Low. One endpoint, one mock adapter write, mergeSignals already handles the semantics. The hard design question (validation, auth) can be punted for pilot — it's a mock adapter.

**Dependencies:** Item 5 (signal review UI drives the need).

**Priority: P1 — Sprint 6, same sprint as Item 5.**

---

### 8. Decision Outcome Tracking

**Why it matters:** After Lena approves REPLACE, DenkKern has no mechanism to record what actually happened. Did the replacement parts arrive? Did production continue? Was the €512,500 saving real? Without this, the product cannot learn, the recommendation quality cannot be evaluated, and the customer cannot demonstrate ROI to their board.

**Customer value:** ROI proof. "DenkKern saved us €512,500 last quarter" is how a pilot becomes a contract.

**Demo value:** Low — outcomes aren't visible until after the decision.

**Pilot value:** Very high for renewal and expansion. The pilot is acquisition; this is retention.

**Technical effort:** Low for basic tracking. After `decision_approved`, allow the operator to record: `actual_arrival_date`, `production_impact_actual_days`, `outcome_notes`. Store per case. That's a small form and a file write. No ML required at this stage.

**Dependencies:** Item 3 (multi-case), workflow state (execution phase).

**Priority: P1 — Sprint 6.**

---

### 9. Real External Feeds Replacing Fixtures

**Why it matters:** AIS vessel tracking, live port status, live weather — replacing the fixture-backed agents with real API calls.

**Customer value:** Real intelligence, not simulated.

**Demo value:** High — being able to show "this is the actual position of your vessel right now" is compelling.

**Pilot value:** Depends on the customer. Some pilot customers will accept simulated data if the workflow is compelling. Others will not trust the product until it uses real data. This needs to be a customer-by-customer decision.

**Technical effort:** High. Each agent needs a real feed adapter. AIS (MarineTraffic or similar), port status (individual port APIs or IFTIA), weather (OpenWeatherMap Marine, Met Office). James' prediction adapter already has the interface pattern. But API contracts, error handling, rate limits, and data normalisation are 2–3 sprints of work minimum.

**Dependencies:** AgentContext needs vessel MMSI (already added). Feed API credentials. James' adapter pattern can be reused.

**Priority: P2 — post-pilot. Exception: if the first pilot customer explicitly requires real AIS data, ship one feed (AIS only) as a P1 in Sprint 6.**

---

### 10. Insurance Partner Workflow

**Why it matters:** Insurance underwriters want to see disruption decisions and outcomes as part of war-risk or cargo insurance underwriting. DenkKern's decision audit trail is potentially valuable to a maritime insurer.

**Customer value:** Opens a second revenue stream or a channel partnership.

**Demo value:** None for the first pilot customer (a manufacturer, not an insurer).

**Pilot value:** None for Sprint 5–7.

**Technical effort:** High. Entirely separate product surface — a read-only insurer portal, data export, policy linkage.

**Priority: P2 — explicitly post-pilot. Do not build.**

---

### 11. Customer-Specific Override Layer (Configuration Layer)

**Why it matters:** Right now ERS-001/ERS-002 are embedded in the case fixture. In production each customer needs to be able to configure their own signal rules — "always flag HAM port events as HIGH for our Hamburg-bound vessels", "ignore Red Sea signals for our North Atlantic routes." This is the layer above operator-per-case overrides.

**Customer value:** The product feels like it knows their business, not a generic tool.

**Demo value:** Medium — showing customer-specific rules is compelling in a tailored demo.

**Pilot value:** Low for first pilot. One customer, one manual configuration. Override per case (Items 5/7) is sufficient.

**Technical effort:** High. Requires a rules engine, a configuration UI, and customer-scoped data isolation.

**Priority: P2 — Sprint 7 at earliest. Items 5 and 7 (case-level overrides) are the stepping stone.**

---

### 12. Scenario Explanation Engine

**Why it matters:** Currently explanations are string-concatenated in `score.ts`. They are readable but not interactive or expandable. A richer explanation layer would let Lena ask "why is WAIT so much more expensive?" and get a drill-down.

**Customer value:** Transparency and trust in the recommendation.

**Demo value:** Medium — "you can drill into any cost component" is a nice demo beat.

**Pilot value:** Low. The existing explanations are sufficient for the pilot. Lena does not need a Q&A interface to trust a cost breakdown she can see.

**Technical effort:** Medium-high. Would require an LLM call path or a structured explanation tree. Scope creep risk is high.

**Priority: P2 — post-pilot. The current explanation strings are good enough.**

---

### 13. Decision Memory

**Why it matters:** If the same vessel, route, and disruption type has been seen before, DenkKern should surface the previous decision and outcome. "Last time MSC Barcelona was delayed in Bay of Biscay, you chose REROUTE and saved €300k" is a powerful operator assist.

**Customer value:** Institutional memory. The product gets smarter with usage.

**Demo value:** Potentially very high — but only after real decisions have been made.

**Pilot value:** Zero for the first pilot case. High for renewal.

**Technical effort:** Medium. Requires a semantic index of past decisions (vector search or simple keyword/route matching). Cannot be built before there are real decisions to remember.

**Dependencies:** Items 3, 6, 8 (multi-case, intake, outcome tracking). You cannot build memory without decisions.

**Priority: P2 — Sprint 7 at earliest. Requires real pilot data first.**

---

### 14. Recommendation Quality Evaluation

**Why it matters:** Automated evaluation of whether DenkKern recommended the right option, measured against actual outcomes. This is how James improves the prediction model and how the team validates that the engine is calibrated.

**Customer value:** Indirect — better recommendations over time.

**Demo value:** None.

**Pilot value:** Low for acquisition. High for the technical team's confidence.

**Technical effort:** Medium. Requires outcome data (Item 8), ground truth definition, and an evaluation harness.

**Priority: P2 — depends entirely on Items 8 and 13 existing first.**

---

## Classification

### A. Must-have before first pilot

| # | Item | Sprint | Owner |
|---|---|---|---|
| 1 | Date validity enforcement in agents | Sprint 5 | Amir |
| 2 | Full E2E test coverage | Sprint 5 | Amir |
| 3 | Multi-case support (listing + seeding) | Sprint 5 | Amir |
| 4 | Agent audit trail persistence | Sprint 5 | Amir |
| 5 | Operator signal review + confirm step | Sprint 5/6 | Amir + Nick (UX) |

These five items are the delta between "demo that impresses" and "product a customer can use."

### B. Should-have during pilot

| # | Item | Sprint | Owner |
|---|---|---|---|
| 6 | Case intake workflow (`POST /api/cases`) | Sprint 6 | Amir |
| 7 | `PATCH /api/cases/:caseId/signals` write path | Sprint 6 | Amir |
| 8 | Decision outcome tracking | Sprint 6 | Amir + Nick |
| 9 | Real AIS feed (if customer requires it) | Sprint 6/7 | James + Amir |

### C. Post-pilot scaling

| # | Item | Notes |
|---|---|---|
| 10 | Insurance partner workflow | Separate product. Don't build yet. |
| 11 | Customer-specific override layer | Item 5/7 is sufficient for first pilot. |
| 12 | Scenario explanation engine | Current strings are good enough. |
| 13 | Decision memory | Requires real decisions to exist first. |
| 14 | Recommendation quality evaluation | Requires Items 8 + 13 first. |

---

## Sprint Plans

### Sprint 5 — Pilot Ready (2 weeks)

**Goal:** Any team member can onboard a new case and run it end-to-end without touching code.

| Day | Item | Deliverable |
|---|---|---|
| 1 | Date validity enforcement | All four agents filter expired signals. Unit tests pass. |
| 1–2 | E2E test suite | Three Playwright/API tests: context enrichment, scenario computation, Decision Room render. |
| 3–5 | Multi-case support | `GET /api/cases` listing. `pnpm seed` CLI. Dashboard shows all cases. |
| 6–7 | Audit trail persistence | Audit entries written to `mock/cases/:caseId/audit-trail.jsonl`. |
| 8–10 | Signal review UI (read-only first) | Disruption context page shows agent signals before confirm. No write yet. |

**Sprint 5 exit criteria:**
- Nick can seed a new case from a terminal command
- The new case appears in the dashboard
- The new case runs end-to-end through the Decision Room
- No expired signals appear in any case
- E2E test suite passes in CI

---

### Sprint 6 — Pilot Operational (2 weeks)

**Goal:** Pilot customer can report a disruption, review signals, confirm a decision, and record what happened.

| Day | Item | Deliverable |
|---|---|---|
| 1–2 | PATCH /api/cases/:caseId/signals | Write path. Mock adapter persists confirmed signals. |
| 2–4 | Signal review + confirm UI | Operator can confirm/dismiss/edit signals before context_confirmed. |
| 5–6 | Case intake (`POST /api/cases`) | Nick or customer can create a new case via form or API. |
| 7–8 | Decision outcome form | After decision_approved, operator records actual outcome. |
| 9–10 | Nick's onboarding tooling | Whatever Nick needs to onboard the first customer without Amir's help. |

**Sprint 6 exit criteria:**
- Nick can onboard a new customer case without engineering involvement
- Operator can confirm and override a signal before the engine runs
- After a decision, the outcome can be recorded
- First pilot customer can be handed a working URL

---

### Sprint 7 — Pilot Learning (2 weeks, post first pilot)

**Goal:** Collect signal from real usage and decide what to double down on.

| Item | Rationale |
|---|---|
| Real AIS feed (one agent) | If pilot customer requested it. Otherwise delay. |
| Decision memory (basic) | Surface previous similar decisions. Requires Sprint 6 outcome data. |
| Customer-specific signal rules | If pilot customer is using overrides heavily. |
| Recommendation quality (manual) | Review first 10 pilot decisions manually. Not automated yet. |
| James model update | Feed actual delay outcomes back to James for retraining. |

**Sprint 7 is data-driven.** Do not plan its specifics now. Plan it based on what the first 2 weeks of pilot usage reveals.

---

## Top 5 Priorities

1. **Multi-case support** — There is no pilot without it. A product that only works for one hardcoded case is a demo, not a product.

2. **Date validity enforcement** — One expired signal in a customer's first session destroys trust that takes months to rebuild. It takes one hour to fix.

3. **Operator signal review + confirm** — Enterprise buyers need to see human-in-the-loop. "The AI tells Lena what it found, Lena confirms it, then the engine runs" is the trust narrative. Without operator agency the product is an autonomous system, which is a much harder sell.

4. **Case intake workflow** — The pilot customer's real disruption needs to enter the system. Manual seeding by Amir is not a pilot, it is a concierge service.

5. **Decision outcome tracking** — This is the ROI measurement. Without it the pilot customer cannot demonstrate value internally, and the renewal conversation has no data behind it.

---

## Top 3 Risks

### Risk 1: The pilot customer asks "can it use our data?"

**Scenario:** The first pilot customer wants to connect their TMS, ERP, or AIS feed. They don't want to manually provide shipment data. The answer today is "not yet."

**Mitigation:** Set the expectation before the demo. "For the pilot, we work from your data, which we pre-load. Real-time integration is Sprint 7." This is acceptable if the value proposition is compelling enough. Have James ready with the adapter interface so the conversation about integration is credible.

**If unmitigated:** The customer decides to wait for real integration before piloting. Deal stalls. Discovery takes two months.

---

### Risk 2: The first pilot disruption is too different from CASE-001

**Scenario:** The pilot customer's first real disruption is a vessel bound for Rotterdam, not Hamburg, with a supplier in Vietnam, not Poland, and a prediction model James hasn't calibrated. The scenario engine produces nonsense outputs.

**Mitigation:** Before going live, seed 2–3 case variants with different destinations, routes, and suppliers and verify they produce sensible outputs. Do not go into a pilot with only Hamburg validated. Nick should be testing case variants as part of customer onboarding.

**If unmitigated:** A wrong recommendation in the first week destroys trust that the demo built. The product is not wrong — it's uncalibrated — but the customer cannot distinguish.

---

### Risk 3: The approval gate blocks the workflow in practice

**Scenario:** `second_approval_required = true` on the recommended scenario for every case. The pilot customer's supervisor is on vacation, or the approval flow doesn't map to their org structure. Lena cannot confirm any decision. The product is useful but unusable in practice.

**Mitigation:** Make the approval threshold configurable per customer in `scenario-defaults.json`. Consider a "soft approval" mode for pilot — the system recommends and records, but does not block. Add a `PATCH /api/cases/:caseId/approve` endpoint that accepts an `approved_by` field and allows the operator themselves to be the approver during pilot.

**If unmitigated:** The pilot customer uses the product for recommendations but ignores the approval gate, which means the workflow data is incomplete and the ROI story is "we showed them scenarios."

---

## Top 3 Things We Should Explicitly NOT Build Yet

### 1. Real external feeds (beyond AIS if required by pilot customer)

**Why not:** Each feed requires API credentials, error handling, rate limiting, data normalisation, and ongoing maintenance. The fixture-backed agents produce the same demo narrative as real feeds. The value is in the workflow, not the data source. Building real feeds before a paying customer confirms they need it is a distraction. Exception: if the first pilot customer's procurement team makes it a contractual requirement.

**When to revisit:** After Sprint 7 when the pilot customer's specific data needs are confirmed.

---

### 2. Insurance partner workflow

**Why not:** This is a different customer, a different workflow, and a different product surface. It requires a read-only insurer portal, policy linkage, data export standards, and potentially regulatory considerations. None of that is relevant to getting the first manufacturing pilot live. The team has three people. Splitting focus before the core product is validated is how startups fail.

**When to revisit:** After the first pilot is confirmed and renewed. This becomes a channel expansion conversation with Nick.

---

### 3. Automated recommendation quality evaluation

**Why not:** You need real decisions to evaluate. You need outcome data (Item 8, not yet built). You need ground truth definitions that require at least one pilot cycle to establish. Building an evaluation harness before there is data to feed it, and before the recommendation criteria are validated by real users, produces metrics that measure the wrong thing with confidence. Review the first 10 pilot decisions manually. That is faster and more insightful than any automated system at this stage.

**When to revisit:** After Sprint 7, once decision outcome data exists and the team agrees on what "good" looks like.

---

## Summary for Nick (Customer + GTM)

The product is demo-ready now. For a paying pilot, Amir needs approximately two sprints to close the gap — specifically: the ability to onboard a new customer case without engineering involvement, and an operator signal confirmation step that shows the human is in control.

The strongest pilot narrative is: *"We pre-load your last three disruptions. You see what DenkKern would have recommended. You compare against what you actually decided. You see the cost difference. Then your next real disruption goes through the live system."*

That narrative requires multi-case (Sprint 5) and decision outcome tracking (Sprint 6). Everything else is negotiable.

---

*Document owner: Claude / Product Architect + Technical Lead*  
*Review cadence: End of each sprint*  
*Next review: End of Sprint 5*
