---
title: Outcome Capture — Product Design from First Principles
version: 1.0
status: active
date: 2026-06-11
authors: [Claude / Platform Architect]
type: product-design
trigger: decision-memory-strategic-analysis
---

# Outcome Capture — Redesigned from First Principles

> **The problem in one sentence:** Outcome Capture requires a behavior that does not occur naturally. Operations managers do not return to document what happened. If you ask them to, most will not. If they do not, Decision Memory is a log, not a moat.

> **The goal:** Design a system that achieves 90%+ outcome data completeness without relying on Lena's memory, motivation, or schedule.

---

## The User Psychology Problem First

Before asking how to capture outcomes, ask why Lena would not do it.

**Two weeks after the crisis, Lena:**
- Is managing 2–3 new disruptions
- Has a backlog of internal reports
- Has moved emotionally past the resolved event
- Cannot quickly remember the exact numbers
- Has no immediate personal incentive to record history

**What Lena would need to overcome this:**
1. A trigger that reaches her when she is NOT already in a crisis
2. A task that takes under 90 seconds
3. An immediate personal return — she learns something useful by completing it
4. Pre-filled data so she does not have to remember the numbers
5. A social/accountability structure — someone else cares whether she did it

This is the design specification. Every decision below flows from it.

---

## 1. How Outcomes Can Be Captured with Minimal User Effort

The key reframe: **do not ask Lena to record what happened. Ask Lena to confirm what the system already thinks happened.**

The psychological difference is significant. Recording requires memory and effort. Confirming requires only recognition — a far lower cognitive load, a far higher completion rate.

**The Automatic + Confirm pattern:**

```
Step 1: DenkKern infers outcomes from available data
        ↓
Step 2: System pre-fills the outcome record
        ↓
Step 3: DenkKern surfaces the pre-filled record to Lena
        ↓
Step 4: Lena confirms (1 click) or corrects (30 seconds)
        ↓
Step 5: Record is locked
```

This flips the burden. Lena is not filling a blank form. She is reviewing a draft and clicking "Looks right."

**Minimum viable outcome — 3 fields, 30 seconds:**

```
Field 1: Production impact
         [Line ran normally] [Line slowed down] [Line stopped]
         → Radio button, pre-filled from AIS arrival data if delay was short

Field 2: Prediction accuracy
         "We predicted a 7-day delay. Was that roughly accurate?"
         [Better than expected] [About right] [Worse than expected]
         → Slider with anchor at "about right"

Field 3: Decision quality
         "In hindsight, was this the right decision?"
         [Yes] [Probably] [No]
         → Three buttons, one click
```

These three fields — production impact, prediction accuracy, decision quality — are the core of the memory corpus. Everything else is enrichment.

Do not ask for:
- Exact actual cost (calculate from ERP when integrated, estimate algorithmically when not)
- Exact actual delay days (read from AIS directly — this is already automatic)
- Detailed narrative (optional text field, not required)

---

## 2. Which Outcomes Can Be Inferred Automatically

This is where the design becomes powerful. A significant portion of the outcome record can be populated without any human action.

### Inferable from data DenkKern already touches

**Actual vessel arrival date — fully automatic**
AIS (Automatic Identification System) data is public and already used by James's prediction model. When the vessel arrives at Hamburg, Rotterdam, or Antwerp, DenkKern can read the actual arrival timestamp automatically.

```
predicted_arrival: 2026-06-20
actual_arrival:    2026-06-18   ← read from AIS
prediction_error:  -2 days     ← calculated, no user input needed
```

This is the single highest-value automatic capture. It fills in `actual_delay_days` and `prediction_error_days` with zero effort. It also enables prediction model calibration: after 1,000 cases, you know whether James's model over- or under-predicts on each route.

**Recommendation alignment — fully automatic**
DenkKern already knows:
- What was recommended (`recommendation.top_recommendation`)
- What was decided (`decision.scenario_chosen`)

```
recommendation_followed: decision.scenario_chosen === recommendation.top_recommendation
                       → calculated automatically
```

No user input needed.

**Estimated vs. actual cost delta — partially automatic**
If the operator chose WAIT, the estimated cost was `delay_days × daily_cost`. Once actual delay days are known (from AIS), the actual cost estimate can be recalculated automatically. This is not as accurate as ERP data, but it is better than nothing.

### Inferable from ERP/SAP integration (when available)

**Actual purchase order cost** — if REPLACE was chosen, the PO created in SAP has a line-item cost. Reading this field gives `actual_replacement_cost_eur` automatically.

**Production downtime record** — ERP systems record production line stoppages for accounting purposes. If the production line stopped, there is a cost-center record. Reading this field gives `actual_production_downtime_hours` automatically.

**Finance cost allocation** — month-end journal entries often capture the extraordinary cost of a disruption response. This is finance-validated actual cost.

### What cannot be inferred — requires human input

**Production impact severity** — AIS data tells you the vessel was late. It does not know whether Lena's factory had buffer stock. Only Lena knows whether production actually stopped.

**Decision quality judgment** — "Was this the right decision in hindsight?" is a human assessment. The system can approximate it (actual cost vs. estimated cost of alternatives), but the operator's direct judgment is irreplaceable.

**Customer delivery impact** — whether the delay caused a customer commitment failure requires human confirmation.

---

## 3. Which Outcomes Require Human Validation

Two categories: outcomes only a human can assess, and outcomes a human should validate even if inferred.

### Human-only (cannot be inferred)
- Production impact: did the line stop? For how long? Only Lena knows.
- Decision quality assessment: "Was this the right call?" Only Lena can answer.
- Customer impact: was any customer delivery affected? Lena knows; ERP may not capture this cleanly.

### Human-validates-system-inference
- Actual delay (system reads AIS, asks "was the arrival date approximately this?"): confirmation takes 1 second
- Actual cost (system estimates from ERP or formula, asks "does €X sound right?"): confirmation takes 5 seconds
- Prediction accuracy grade (system calculates, asks "does this match your experience?"): confirmation or correction

### Design rule: never show Lena a blank field if the system can make a reasonable estimate

An empty field communicates "we do not know — please remember and type." A pre-filled field with a confirm button communicates "here is what we think — correct it if needed." The second framing achieves 3–4x higher completion rates. This is a product design rule, not a technical constraint.

---

## 4. What a 90% Outcome Capture Workflow Looks Like

Achieving 90% requires four design rules working together: right trigger, right timing, pre-filled data, immediate personal return.

### The three trigger mechanisms

**Trigger 1 — The Vessel Arrives (automated, highest reliability)**

When AIS data shows the vessel has docked, DenkKern fires a notification automatically.

```
[Email / Slack / in-app notification]
Subject: MV Helene arrived — was your production affected?

Your shipment on MV Helene arrived at Hamburg on June 18th.
We predicted June 20th — 2 days better than expected.

One quick question:
[Line ran normally]  [Line slowed down]  [Line stopped]
```

This triggers at exactly the right moment: the disruption has resolved. Lena is no longer in crisis mode. The question is short. The three-button answer takes one click. The pre-filled arrival date shows Lena immediately that DenkKern is already tracking — she just needs to confirm the production impact.

Estimated capture rate from this trigger alone: 65–75%. The disruption is recent. The question is one click.

**Trigger 2 — Next Login Prompt (behavioral anchor)**

When Lena opens a new case, DenkKern shows a one-step modal before the new case begins:

```
[Modal]
Before we start: quick update on CASE-001

MV Helene arrived June 18th (we predicted June 20th — 2 days early).

Was your production affected?
[Line ran normally]  [Line slowed down]  [Line stopped]

Then: Was this the right decision in hindsight?
[Yes]  [Probably]  [No, we should have done something different]

[Save and continue →]
```

This works because: Lena is already in the tool with operational intent. A 30-second modal before the new case is not perceived as interruption. She is in decision-management mode. The context is natural.

This is the Epic model: outcome capture happens at the next clinical interaction, not as a standalone retrospective task. The next disruption creates the occasion to close the previous one.

Estimated additional capture rate: +15–20% on top of Trigger 1. Combined: 80–90%.

**Trigger 3 — 14-Day Email (fallback)**

If neither Trigger 1 nor Trigger 2 has fired and the outcome is not recorded, a single email 14 days post-decision:

```
Subject: [2 min] How did CASE-001 resolve?

Hi Lena,

Two weeks ago you approved a decision on the MV Helene disruption.
We tracked the actual arrival: June 18th (prediction was June 20th).

One question to close the loop:
[Click here to record what happened — 3 fields, 2 minutes]
```

This is the lowest-reliability trigger. Email click-through rates are low. But it catches the cases missed by Triggers 1 and 2.

Estimated additional capture: +5–10%. Combined total: ~90%.

### The three design rules that make 90% achievable

**Rule 1 — Never show a blank form. Always show a pre-filled draft.**
The vessel arrived on June 18th. The system knows this. Fill it in. Ask Lena to confirm, not recall.

**Rule 2 — Maximum 3 required fields. Everything else optional.**
Production impact. Prediction accuracy. Decision quality. Those are the required fields. Actual cost, notes, customer impact — all optional, surfaced after the 3 required fields are saved.

**Rule 3 — Immediate return on investment for completing the form.**
After submission, immediately show:
- "Your prediction accuracy for this case: ±2 days (better than your average of ±4 days)"
- "Decision quality score: 3 of your last 5 decisions were flagged as good in hindsight"
- "If you had chosen WAIT instead, estimated cost would have been €12,000 higher than what actually happened"

Lena learns something real. The form now feels like a debrief, not paperwork. This is the Gong model: after the sales call, Gong shows you the coaching insight. The rep fills in the outcome because the debrief is valuable to them.

---

## 5. How Comparable Companies Solved This Problem

### Gong.io — Outcome from connected system, not from user
Gong never asks sales reps to record deal outcomes. Gong connects to Salesforce, reads the deal status field, and automatically links call recordings to outcomes. Reps update Salesforce for their own reasons (quota tracking, pipeline management). Gong reads it passively.

**The lesson for DenkKern:** The highest-reliability outcome capture is reading data from a system where the outcome is already being recorded for a different reason. For Lena, that system is ERP/SAP — where production downtime and emergency purchase orders are recorded for accounting, not for DenkKern. Build the read connector, not the input form.

### Epic Systems — Outcome capture at the next interaction
Clinical outcomes are not recorded retrospectively. They are recorded at the next patient visit, when the doctor naturally reviews what happened since the last appointment. The next appointment creates the context and the occasion.

**The lesson for DenkKern:** Outcome capture should happen at the next disruption case, not in isolation. When Lena opens a new case, she is already thinking about disruptions. The modal for the previous case takes 30 seconds and feels like a natural workflow step.

### Salesforce CRM — Outcome capture requires a self-interest incentive
Close won/lost rates are high because salespeople need to update Salesforce to get credit for their quota. The system is designed so that recording the outcome serves the user's personal interest (commission tracking), not just the company's interest (pipeline data).

**The lesson for DenkKern:** Design outcome capture so Lena benefits personally from recording it. The prediction accuracy debrief ("you were right — we overestimated the delay") and the decision quality score ("4 out of 6 decisions in hindsight were good calls") serve Lena's professional self-image. She learns how good her judgment is. That is a personal benefit.

### Veeva Systems — Compliance creates capture
In clinical trial management, outcome data must be recorded for regulatory submission. Researchers don't record outcomes because they want to — they record them because the regulatory protocol requires it, and missing records block submission.

**The lesson for DenkKern:** For enterprise customers with formal review processes, outcome capture can be positioned as an internal governance requirement. "Every disruption decision over €100k requires a post-decision outcome record." Once this is part of the approval workflow rather than an optional afterthought, capture rates approach 100%.

This is a real positioning opportunity with enterprise buyers: "DenkKern gives your operations team a structured governance record for every significant disruption decision." The plant director (Thomas) wants this. It is accountability infrastructure, not just a learning tool.

### Palantir — Outcome is embedded in the operational workflow
Palantir embeds outcome capture in the operational process itself. The system is the operational record. Users do not switch between Palantir and a separate recording system — Palantir IS the system of record for the operation. Outcome data flows naturally because there is no other tool to use.

**The lesson for DenkKern:** Long-term, the most reliable outcome capture happens when DenkKern is the system of record for disruption decisions, not just a recommendation layer on top of existing systems. If Lena opens DenkKern to track the resolution of a disruption (not just to make the initial decision), outcome data is captured as a byproduct of normal usage.

This points toward a product evolution: a lightweight "Case Resolution" flow where Lena marks a case as resolved and answers 3 questions as part of closing it — not as a retrospective task but as the natural end of the workflow.

---

## 6. Explicit Workflow Step vs. Automated Background Process

**The answer is: both, in layers.**

**Layer 1 — Fully automatic, zero user action (captures ~40% of outcome data)**
- AIS arrival date → `actual_delay_days`
- Recommendation vs. decision comparison → `recommendation_followed`
- Estimated cost recalculation → `estimated_actual_cost_eur`

This happens in the background. Lena does not need to do anything. The system continuously watches for the vessel arrival and updates the record automatically.

**Layer 2 — Automatic inference + confirm (captures ~35% more)**
- System pre-fills the outcome draft with what it knows
- Surfaces confirmation via vessel arrival notification or next-login prompt
- Lena clicks "Looks right" or corrects one field
- Record is locked

**Layer 3 — Explicit 3-field form (captures ~15% more)**
- 14-day reminder if neither Layer 1 nor 2 has completed the record
- Three required fields, pre-filled where possible
- Completion shows immediate prediction accuracy debrief

**Layer 4 — ERP/SAP integration (enriches existing records, available to enterprise)**
- Reads PO line items and production downtime records
- Enriches the outcome record with finance-validated data
- Available as opt-in for customers with compatible ERP systems

The system should never wait for Layer 3 or 4 before recording a partial outcome. A record with `actual_delay_days` (automatic) + `recommendation_followed` (automatic) + `production_impact` (one click) is worth 80% of a complete record. Do not let the perfect outcome record block the good enough outcome record.

**The rule:** Lock partial records automatically at 30 days. If Lena never confirmed the production impact, record it as `null` and mark the record as auto-generated. Partial records are usable for prediction calibration even if they cannot be used for decision quality analysis.

---

## 7. Integrations That Create the Highest Outcome Capture Value with the Least Engineering Effort

Ranked by (capture value × implementation ease) / cost:

### Tier 1 — Implement immediately (already in the system or trivially available)

**AIS Vessel Tracking API (James already uses this)**
Value: Automatic `actual_delay_days` and `prediction_error_days` for every maritime case. Zero user effort.
Effort: James's model already calls AIS-equivalent data. Extend it to poll for actual arrival post-decision.
Impact: Fills the most important numeric field in every outcome record automatically.
Priority: **Sprint 6. This is the foundation of prediction calibration.**

**Internal Vessel Tracking Continuation**
Value: After a decision is made, continue tracking the vessel until arrival. Today, tracking stops when the case moves to "decision approved."
Effort: Minimal — reuse existing agent, extend the tracking window.
Impact: Vessel arrival notification (Trigger 1) becomes possible.

### Tier 2 — Implement for first enterprise customer

**Slack Integration (read-only, for notification delivery)**
Value: Outcome capture notifications reach Lena through a channel she already monitors. The vessel arrival notification, next-case prompt, and 14-day reminder all delivered to the Slack channel where Lena works.
Effort: Slack webhook is 1 day of work. Already planned for execution in Sprint 11.
Impact: Significantly higher notification open rates than email. Trigger 1 becomes a Slack message: "MV Helene arrived. Was production affected? [one click button]"
Note: This reframes Slack integration from "execution notification" to "outcome capture channel." The same integration serves both purposes.

**Email Notification (basic SMTP)**
Value: 14-day outcome reminder email. Low tech, high reach.
Effort: 1–2 days.
Impact: Fallback capture for cases where Slack wasn't triggered or didn't result in action.

### Tier 3 — Implement when the first enterprise customer requests it

**ERP Read Integration (SAP, Dynamics, etc.)**
Value: Automatic `actual_replacement_cost_eur` from purchase orders. Automatic `production_downtime_hours` from cost center records.
Effort: 4–8 weeks per ERP system (auth, data model mapping, error handling).
Impact: Finance-validated outcome data. Removes the largest source of manual estimation error.
Strategic note: Position this as "outcome intelligence connector," not "execution integration." Lower IT resistance (read-only), higher perceived value (automatically validates DenkKern's estimates against real financials).

**Critical reframe for the sales conversation:**
> "We connect to your ERP not to update it, but to automatically measure what your decisions actually cost. After 6 months, you will know exactly which disruption response strategies are financially optimal for your operations."

This sells as intelligence, not workflow automation. It reduces IT friction (read-only access is easier to approve than write access). And it captures the most valuable outcome data automatically.

### Tier 4 — Long-term roadmap only

**Finance System Integration (SAP Finance, Oracle Financials)**
Month-end actual cost allocation, budget variance reports.
Effort: 3–6 months per customer.
Available when: enterprise contract specifies it.

**Customer Delivery System**
Tracks whether outbound deliveries were actually affected by the disruption.
Effort: Highly variable, customer-specific.
Available when: customer requests it.

---

## 8. Should Outcome Capture Be the Primary Reason for Enterprise Integrations?

**Yes. This is the strategic flip, and it is correct.**

The original integration vision was:
> "We integrate with SAP and Slack to coordinate execution after a decision is approved."

This is execution automation. Every RPA vendor, every workflow tool, every enterprise platform already does execution automation. It is a commodity position. It requires write access to production systems. It requires deep IT cooperation. It takes months per customer.

The reframed integration vision is:
> "We integrate with your ERP and Slack to automatically measure what your decisions actually cost — so you build a record of what works in your operations."

This is outcome intelligence. Nobody does this. It requires read-only access. It is faster to implement. And it generates data that makes DenkKern irreplaceable.

**The practical consequences of this flip:**

| | Execution integration | Outcome capture integration |
|---|---|---|
| Access required | Write (high risk, long approval) | Read (low risk, fast approval) |
| IT resistance | High | Low |
| Implementation time | 3–6 months | 2–6 weeks |
| Value proposition | Automation | Intelligence |
| Competitive differentiation | Low (many alternatives) | High (nobody does this) |
| Contribution to moat | Indirect (convenience) | Direct (data) |

**The integration pitch to the enterprise buyer:**

Nick should NOT say:
> "DenkKern will update your SAP when a decision is approved."

Nick SHOULD say:
> "DenkKern connects to your ERP to automatically record what disruption decisions actually cost you. After 12 months, you will have a validated record of every significant disruption, what you decided, and what it cost — automatically reconciled against your ERP actuals. No other tool gives you this."

The buyer (Thomas, the Plant Director) is much more likely to say yes to "you get a validated decision audit trail" than to "we can update your SAP automatically." The first is accountability intelligence. The second is process automation that his IT team will question.

---

## The Redesigned Outcome Capture Epic

Based on this analysis, Outcome Capture should be an independent epic with three phases:

### Phase 1 — Automatic Capture Foundation (Sprint 6, 2 days)
- Continue vessel tracking after decision approval (reuse existing agent)
- Write `DecisionRecord` on decision approval (schema from decision-memory document)
- Auto-populate `actual_delay_days` from AIS arrival data
- Auto-populate `recommendation_followed` from decision vs. recommendation comparison
- Lock the auto-populated fields as system-generated

### Phase 2 — Human Confirmation Flow (Sprint 6, 2 days)
- Vessel arrival notification: Slack + email, 1-click production impact confirmation
- Next-case prompt: 30-second modal before new case, 3 fields
- 14-day fallback email
- Immediate prediction accuracy debrief on completion

### Phase 3 — Governance Mode (Sprint 7–8)
- Case resolution workflow: Lena formally "closes" a case with outcome recorded
- Decision audit trail view: Thomas can see every decision with its outcome
- Outcome capture rate metric visible to DenkKern team
- Slack integration for notification delivery

### Phase 4 — ERP Outcome Connector (first enterprise customer, Sprint 9+)
- Read-only ERP integration for purchase orders and production records
- Auto-enrich existing outcome records with finance-validated cost data
- Position as "outcome intelligence connector" in sales conversation

---

## Summary: The Three Rules That Determine Whether the Memory Strategy Succeeds

**Rule 1:** Never ask Lena to fill in data the system can infer. Pre-fill everything. Ask for confirmation, not recall.

**Rule 2:** Trigger outcome capture at the moment of natural re-engagement — when the vessel arrives, or when the next disruption case begins. Not via a standalone reminder sent to her inbox.

**Rule 3:** Make completion immediately valuable to Lena personally. Show her the prediction accuracy debrief. Show her the decision quality trend. The outcome record should feel like a debrief that serves her, not paperwork that serves the platform.

If all three rules are followed, 90% capture is achievable without enterprise integrations. With ERP outcome connectors, the record becomes finance-validated and the capture becomes partially automatic. The memory moat follows.

---

*Document owner: Claude / Platform Architect*
*Written in response to: decision-memory-strategic-analysis session, June 2026*
*Key insight: integrations should be designed for outcome capture first, execution second*
*Next action: validate Phase 1 (vessel tracking continuation + DecisionRecord) is achievable in Sprint 6*
