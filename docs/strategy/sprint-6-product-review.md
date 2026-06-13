---
title: Sprint 6 Product & Architecture Review
version: 1.0
status: active
date: 2026-06-12
authors: [Claude / Platform Architect]
type: review
trigger: sprint-6-close
---

# Sprint 6 — Product & Architecture Review

> **Purpose:** Before defining Sprint 7, review what was built, what was validated, what risks remain, and what the highest-leverage next step actually is. Sprint 7 must be driven by validated learning, not by the next interesting engineering problem.

---

## 1. What Was the Original Sprint 6 Objective?

The sprint goal was stated as:

> *Every approved decision leaves a trace. Every resolved disruption captures an outcome.*

The governing constraint was equally clear:

> *The success criterion is not: email sent, modal shown, dashboard badge visible. The success criterion is: CASE-001 contains a valid immutable DecisionRecord and a confirmed OutcomeRecord.*

Sprint 6 was defined as the sprint that would complete the first full Decision Memory cycle: Signal → Recommendation → Decision → DecisionRecord → Arrival → OutcomeDraft → OutcomeRecord. No UI sophistication. No analytics. No retrieval. Just the first complete record.

---

## 2. What Was Actually Delivered?

**Sprint 6A — Core loop (complete)**
- `DecisionRecord` written automatically on `decision_approved` (DK-601)
- Arrival recorded via `POST /arrival`, patches `tracking.*` (DK-602)
- `OutcomeDraft` auto-generated from 4 source files (DK-603)
- `OutcomeRecord` confirmed via `POST /confirm-outcome`, patches `decision-record.json` immutably (DK-604)
- Workflow advances: `outcome_pending → outcome_confirmed`
- 39-assertion verification script passes against CASE-001

**Sprint 6B — Capture experience (complete)**
- One-time token lifecycle: generate, validate, mark-used
- `POST /send-outcome-notification` builds full email, writes `outbound-email.json`
- `/cases/:caseId/confirm-outcome?token=<uuid>` — Server Component page with token guard
- `ConfirmOutcomeForm` — Client Component with form, success view, error state
- CSS design system additions
- `tsc --noEmit` clean throughout
- `verify-dk-604.mjs` still passes 39/39 after Sprint 6B changes

**CASE-001 final state:**
```
confirmation_channel:             "api"     ← Sprint 6A verify script
decision_quality:                 "EXCELLENT"
prediction_accuracy_assessment:   "OVERESTIMATED"
actual_cost_eur:                  220,000
estimated_cost_avoided_eur:       1,430,000
tracking_active:                  false
outcome.status:                   "confirmed"
```

The original objective was met. The first Decision Memory record exists.

---

## 3. What Assumptions Were Validated?

**The data model is structurally sound.**
`DecisionRecord` survived two sprints of implementation without requiring field renames, type changes, or schema breaks. The immutability contract held. The NTFS null-byte guard caught real corruption. The pattern — read → patch → write — is stable.

**The workflow state machine is sufficient for the MVP loop.**
`outcome_pending → confirm_outcome → outcome_confirmed` required no rework. The self-transition `record_arrival → outcome_pending` correctly models the re-entrant state.

**Outcome capture can be frictionless at the pilot scale.**
The confirmation form is 5 fields (stopped, stopped_days, commitment_met, decision_quality, notes). It submits in one click. It renders correctly with data pre-populated from the draft. For a single-operator pilot, this is sufficient.

**Token-based confirmation removes the auth barrier for email channel.**
A UUID token with 7-day TTL and single-use enforcement is enough for pilot. No session management, no RBAC, no user directory needed. The operator follows a link; the link IS the auth.

**The email content is self-contained.**
`outbound-email.json` contains everything Lena needs to understand what she is confirming — arrival date, prediction accuracy note, cost comparison, CTA. This was testable without a real email provider.

---

## 4. What Assumptions Remain Unvalidated?

**That a real operations manager will actually complete outcome capture.**
The form was designed. The email was drafted. But nobody has clicked "Confirm outcome" in a real disruption context, 2 weeks after the crisis ended, with 4 other fires burning. The outcome capture rate for real pilot users is entirely unknown. This is the most important unvalidated assumption in the entire system.

**That the OutcomeDraft values will match reality closely enough to be useful pre-population.**
CASE-001's draft is synthetically perfect — the fields were hand-crafted to be consistent. In a real case, `actual_cost_eur` will come from a scenario evaluation that used an operator-entered daily downtime cost. If that number was wrong (likely), the pre-populated value is wrong, and Lena has to correct it. We don't know how often this happens or how wrong the values typically are.

**That `prediction_error_days` is a meaningful number.**
James's model predicts arrival. The error is computed as `actual_arrival − predicted_arrival`. But the prediction was made weeks before arrival, using data that changes daily. We do not know whether the error distribution is centered near zero, is systematically biased, or is too noisy to be informative at the pilot scale (N=1).

**That `estimated_cost_avoided_eur = 1,430,000` is a number a customer can stand behind.**
This number is `wait_cost_eur (1,650,000) − actual_cost_eur (220,000)`. The wait cost is modeled, not observed. If a customer audits this figure, they will ask: "How do you know production would have stopped for 11 days?" The answer today is: we computed it from the scenario engine using an operator-provided daily downtime figure. That is a model, not a fact. Nobody has challenged this number in a real meeting.

**That the workflow state machine is the right integration point.**
DK-601 wires `DecisionRecord` writing into the `decision_confirmed` workflow event consequence. This assumes the workflow state machine is always the source of truth for case progression. In a real customer environment, decisions may be recorded in SAP, an email approval thread, or a WhatsApp message. The workflow may not fire at all.

**That a single case type (maritime supply disruption) is enough to validate the business.**
The entire system is built for one disruption pattern. We have not yet discovered whether customers face enough of these disruptions per year to make DenkKern a routine tool vs. an occasional one.

---

## 5. What Is Still Mocked?

Everything customer-facing is mocked. This is the correct choice for a pilot. But it is important to name each mock explicitly so Sprint 7 does not paper over them with more code.

| Component | Mock | Production reality |
|-----------|------|-------------------|
| Email delivery | Written to `outbound-email.json` | SendGrid / Postmark / SES |
| Vessel data | `shipment-context.json` hand-written | AIS feed, port API (MarineTraffic, VesselFinder) |
| Prediction model | Static `prediction.json` | James's PyTorch model via HTTP adapter |
| ERP cost data | `erp-snapshot.json` hand-written | SAP / Oracle ERP integration |
| Scenario engine costs | Computed from hand-entered daily cost | Finance-validated cost model per customer |
| Authentication | No auth on any route | SSO / OAuth, RBAC per tenant |
| Multi-tenancy | Single `CASE-001` in flat `mock/cases/` | Per-tenant data isolation |
| Workflow state persistence | In-memory `Map`, seeds from file | Database-backed, survives server restart |
| Decision record storage | `mock/cases/:caseId/decision-record.json` | Database with immutability enforcement |
| External risk signals | Fixture JSON files | Live API feeds (weather, maritime security) |
| `confirmed_by` identity | Free-form string, not validated | User directory / IAM |

The most dangerous mocks are ERP cost data and workflow state persistence. ERP cost data because it is the foundation of every financial calculation. Workflow state persistence because a server restart loses all case state today — acceptable for demos, not for pilots.

---

## 6. What Would a Real Pilot Customer Challenge First?

In order of likelihood:

**First: "Where does the €1.43M saving number come from?"**
Every operations manager shown a €1.43M saving figure will immediately interrogate it. The answer — "we modeled what would have happened if you had done nothing" — is not satisfying to a finance team. They will ask for the methodology, the assumptions, and the data source for the daily downtime cost. If the answer is "your operations manager typed €150,000/day into a form," the number loses credibility instantly. This is not a reason to abandon the number — it is a reason to have a clear, defensible methodology written down before the first real customer demo.

**Second: "How does this connect to our ERP?"**
Lena works inside SAP every day. The moment DenkKern shows her data she already has in SAP — inventory levels, cost figures, supplier names — she will ask why she should maintain two systems. The answer ("DenkKern adds the decision layer SAP doesn't have") is correct but not obvious. If the data doesn't flow from SAP automatically, the system requires manual data entry, which is the second strongest barrier to adoption after outcome capture behavior change.

**Third: "What happens when the vessel data is wrong?"**
Maritime data has known quality problems. AIS data has gaps. Carrier ETAs are frequently optimistic. If DenkKern shows a 14-day delay and the vessel actually arrives 2 days late, the first customer reaction is "your system told me to spend €220k on an expedite for nothing." The accuracy of the prediction model under real conditions is completely unknown.

**Fourth: "Who sees this data?"**
An enterprise operations manager will immediately ask about data governance. Who else in the company can see their decision history? Can their manager see their decision quality ratings? Can the DenkKern team see their cost data? These are not blocking questions for a pilot, but they become blocking questions for a contract.

**Fifth: "Can we try it with a real case?"**
The hardest challenge, because it requires real vessel data, real ERP integration, and real time pressure. CASE-001 is a perfect synthetic case that will never happen exactly this way. The first real disruption will have missing data, ambiguous signals, and a cost structure that doesn't fit the model cleanly.

---

## 7. Top 3 Product Risks Today

**Risk 1 — Outcome capture rate will be too low to build a learning system.**
This is existential. The entire Decision Memory strategy depends on operations managers completing outcome capture after the disruption resolves. The behavior model for this is: wait 1–3 weeks after a high-stress event, then voluntarily log into a system and fill in a form about what happened. This is not natural. The email notification and one-click form reduce friction, but they do not solve the behavior problem. If outcome capture rate is 30% in the first pilot, the learning loop produces a biased, incomplete corpus. There is no technical fix for this — it is a product design and change management problem.

**Risk 2 — The financial calculation is not auditable enough for enterprise sign-off.**
`estimated_cost_avoided_eur` is the product's core value proof. Today it is computed from operator-entered figures using a modeled scenario. An enterprise customer's CFO or procurement team will require auditable methodology before approving a contract based on demonstrated savings. DenkKern cannot currently produce a "here is the data lineage for this number, here is the source, here is the assumption behind each variable" report. Without that, the number is marketing copy, not evidence.

**Risk 3 — Single case type creates a thin pilot surface.**
If the beachhead customer only experiences 2–3 maritime disruptions per year, DenkKern is a tool used 3 times per year. That is not enough usage to build habits, enough data to train the model, or enough value proof to justify a contract renewal. The "Lena-type" persona was correctly scoped, but the usage frequency assumption has not been validated. A manufacturing plant could easily go 6 months without a disruption of the severity CASE-001 represents.

---

## 8. Top 3 Technical Risks Today

**Risk 1 — Workflow state is in-memory only.**
The `MockDataAdapter` stores workflow state in a module-level `Map`. A server restart resets all case state. `workflow-state.json` is only read at startup, never written back. In a real pilot, if the Next.js server restarts (deployment, crash, memory pressure), every active case loses its current state and falls back to the seed state. This is the single most likely source of pilot embarrassment. Not a wrong answer or a slow response — a case that simply "resets" with no explanation.

**Risk 2 — The prediction model is entirely decoupled from live data.**
`prediction.json` is a hand-written file. The `JamesHTTPAdapter` exists but has never been called against a real model endpoint. The prediction model integration has never been tested end-to-end. For the pilot, this means the prediction data shown to Lena is frozen. If James updates his model or changes the output schema, nothing breaks visibly — the system just continues showing the old static values.

**Risk 3 — No idempotency or concurrency protection on case state mutations.**
The read → patch → write pattern on `decision-record.json` is correct and uses NTFS guards. But there is no locking mechanism. If two requests arrive simultaneously — an unlikely but possible race in a web server — the second write wins and the first is lost. In a single-operator pilot, this risk is negligible. In a multi-user environment (Lena + her supervisor + a second operator), it is a real correctness risk. The current architecture has no mutex, no optimistic locking, and no version field to detect conflicts.

---

## 9. Top 3 Reasons a Customer Would Pay for This

**Reason 1 — It makes a high-stakes, time-pressured decision legible in 20 minutes.**
When a critical vessel is delayed and production is at risk, an operations manager typically: calls the carrier (no useful information), emails the supplier (response in 2 hours), checks three spreadsheets (none agree), makes a gut decision, and hopes. DenkKern replaces this with: open the case, see the scenarios ranked by financial impact, see the confidence score, approve in one screen. The value is not that the recommendation is always right — it is that the decision is structured, documented, and defensible. This is what a mid-level manager needs when their VP asks "why did we spend €220k on an expedite?"

**Reason 2 — It creates an audit trail that protects the operator.**
Every decision in CASE-001 is timestamped, attributed, and linked to the signals that were active at the time. "I recommended WAIT, but James approved EXPEDITE on June 14th at 14:32, having reviewed 6 active signals including HIGH harbor congestion" — this record did not exist before DenkKern. For operations managers at enterprise companies where decisions are reviewed in post-mortems, having a structured audit trail is not a nice-to-have. It is career protection.

**Reason 3 — It will eventually tell them what worked and why.**
The near-term pitch (reasons 1 and 2) is about this decision, right now. The medium-term pitch — once outcomes accumulate — is about institutional memory. "In your last 8 disruptions where delay exceeded 10 days and buffer was under 3 days, REPLACE was the right decision 7 times. Your team chose WAIT 4 of those times and incurred an average additional cost of €340k." This requires N > 10 records to be credible. It does not exist yet. But it is the reason an operations director renews the contract in year 2, not just the reason they sign in year 1.

---

## 10. What Should Absolutely NOT Be Built in Sprint 7?

**Do not build the "similar cases" retrieval panel.**
The `ContextFingerprint` is designed. The retrieval logic is not built. With 1 confirmed outcome in CASE-001, the panel would show one result or nothing. Building similarity retrieval before there are at least 10–20 real outcomes creates a ghost feature that makes the system look thin, not smart.

**Do not build analytics or the outcome dashboard.**
Charts require data. A dashboard with N=1 is not a dashboard — it is a record display. Any time spent building analytics infrastructure is time not spent getting a second and third confirmed outcome from a real customer.

**Do not build multi-tenancy.**
Tenant isolation, per-tenant configuration, per-tenant data stores — none of this should exist in Sprint 7. The pilot is one customer, one installation, one `CASE-001`. Multi-tenancy is Sprint 9+ and requires a real second customer to design correctly.

**Do not connect the real email provider.**
Swapping `outbound-email.json` for a real SendGrid call requires environment variables, a deliverability strategy, an unsubscribe mechanism, and GDPR-compliant email infrastructure. None of this adds learning value for a pilot with one operator who can be handed the confirmation URL directly.

**Do not build the next-case modal or the dashboard indicator.**
These were correctly deferred at the end of Sprint 6B. They remain deferred. Adding these before the first pilot customer has used the system once is decoration, not validation.

**Do not start Industry Template 2.**
The Chemical Manufacturing / Maritime template is not yet proven with a real customer. Expanding to a second industry before the first is validated multiplies complexity without multiplying learning.

---

## The Central Question: Single Highest-Leverage Next Step

> *Based on everything now implemented, what is the single highest-leverage next step for validating DenkKern as a business, not as a software system?*

**Run a real disruption walkthrough with a real operations manager who does not know DenkKern exists.**

Not a demo with a friendly pilot customer who has been briefed. Not a walkthrough with Nick. Not a synthetic replay of CASE-001 with the team watching. A cold walkthrough: find one operations manager at a manufacturer — 45 minutes, no preparation on their side — show them CASE-001 as if it were their case, and observe.

The specific things to observe:

1. **At what point do they ask about the source of the cost data?** If it happens in the first 5 minutes, the number is not credible. If it happens at the end, it is a late-stage objection. If it doesn't happen, they are not the buyer.

2. **Do they trust the prediction?** Play through the scenario where the predicted delay was 14 days and the actual was 11 days. Show them `prediction_accuracy_assessment: OVERESTIMATED`. Ask them what they think of that. If their reaction is "that's useful — the model is better than I thought," the prediction narrative works. If their reaction is "so the system was wrong," the prediction framing needs to change.

3. **Will they complete the outcome confirmation without prompting?** After the walkthrough ends, send them the `outbound-email.json` confirmation URL (or describe the email). Ask them to confirm the outcome as if they were Lena. Measure whether they do it. This is the most important behavioral observation in the entire pilot phase.

4. **What do they say in the last 5 minutes, unprompted?** The most useful signal is not answers to questions but what the operations manager says when you stop talking. "This is nice but our ERP already has..." is different from "Can this work with our Hamburg supplier?" is different from "How much does this cost?" Each of those is a different signal about where the product sits in their mental model.

**Why this is higher leverage than any Sprint 7 feature:**

Every Sprint 7 engineering decision currently rests on untested assumptions. If the walkthrough reveals that operations managers do not trust cost-avoided numbers computed from modeled scenarios, the right Sprint 7 is to build a Finance Validation workflow — not a retrieval panel or an analytics dashboard. If the walkthrough reveals that the audit trail is the most compelling part ("I could use this to justify the expedite to my VP"), the right Sprint 7 is to make the decision record exportable as a PDF, not to build more backend infrastructure.

The system is sufficiently complete to validate with a human. One real conversation with a real operations manager will teach the team more about what to build next than any document written by the engineering team — including this one.

**The concrete ask:**

Nick should identify one operations manager — ideally someone he already knows, not a formal prospect meeting — and run a 45-minute structured walkthrough of CASE-001 before Sprint 7 planning begins. The output is not a sales demo. It is a set of observations documented as: what surprised them, what confused them, what they asked about, and whether they completed outcome confirmation when given the link.

Sprint 7 should be designed after that conversation, not before it.

---

## Sprint 6 Honest Assessment

| Dimension | Assessment |
|-----------|-----------|
| **Core objective achieved?** | Yes. First full Decision Memory record exists in CASE-001. |
| **Scope discipline?** | Yes. Modal and dashboard deferred correctly. Core loop protected. |
| **Build quality?** | High. tsc clean, 39/39 verification, NTFS guards throughout, no hacks. |
| **Business validation?** | Zero. No real customer has seen this. Everything is synthetic. |
| **Biggest technical debt?** | Workflow state in-memory only. One server restart loses all case state. |
| **Biggest product risk?** | Outcome capture behavior. The form exists; the behavior doesn't yet. |
| **Highest value artifact?** | `decision-record.json` — the first structured Decision Memory record. |
| **Ready for pilot?** | Ready for a structured walkthrough. Not ready for unsupervised customer use. |

---

*Document owner: Claude / Platform Architect*
*Written: post Sprint 6 close, June 2026*
*Input sources: sprint-6a-handoff.md, sprint-6b-handoff.md, decision-memory-strategic-analysis.md, beachhead-market-roadmap.md, sprint-6-backlog.md, CASE-001 mock data*
*Trigger: Amir's pre-Sprint 7 product review request*
