---
title: DenkKern Outcome Reality Model v1.0
version: 1.0
status: Approved Working Model
date: 2026-06-12
authors: [Amir, Claude / Platform Architect]
type: canonical-model
blocks: Sprint 7 planning
references:
  - docs/sprints/sprint-7-gate.md
  - docs/strategy/validation-operating-model.md
  - docs/strategy/outcome-reality-interview-guide.md
---

# DenkKern Outcome Reality Model v1.0

> **Status: Approved Working Model**
> This document is the canonical reference for Outcome Capture, Decision Memory Architecture, and the Outcome Reality Gate.
> No Sprint 7 planning should contradict this model without explicit review.

---

## Purpose

Define how outcomes are captured, validated, tracked, and stored inside DenkKern before Sprint 7 planning begins.

---

## Core Principle

**Outcome is not a single event.**

Outcome is a timeline of confirmations, validations, and business consequences that emerge over time after a disruption decision is taken.

---

## Outcome Structure

A case outcome has three possible dimensions:

```
Outcome
├── Operational Outcome
├── Financial Outcome
└── Business Outcome
```

Not every case requires all three. A case may contain:

- Operational only
- Operational + Financial
- Operational + Financial + Business

…depending on the disruption type and decision taken.

---

## Outcome Dimensions

### Operational Outcome

Records what happened to operations after the decision.

Examples (controlled vocabulary + extensible):

- Production Continued
- Production Slowed
- Production Stopped
- Other

### Financial Outcome

Records the financial consequence of the decision.

Examples (controlled vocabulary + extensible):

- Actual Cost
- Cost Avoided
- Budget Impact
- Penalty Impact
- Other Financial Impact

### Business Outcome

Records the customer and commercial consequence of the decision.

Examples (controlled vocabulary + extensible):

- Customer Commitment Met
- Customer Commitment Missed
- SLA Breached
- No Customer Impact
- Insurance Claim
- Other Business Impact

**All three vocabularies are intentionally small at MVP.** Categories are extensible and customer-specific. The real operational language will be discovered through pilot observations and customer usage, not designed upfront.

---

## Outcome Ownership Model

### Case Owner — Lena

Lena is the owner of the case.

Lena's responsibilities:

- Maintain the case throughout its lifecycle
- Trigger follow-up actions and checkpoints
- Coordinate stakeholders when confirmation is needed
- Record outcome facts as they are confirmed

**Lena is not responsible for evaluating decision quality.** She records what happened — not whether the decision was good.

### Operational Validation

Typically confirmed by: Operations, Production, Supply Chain.

### Financial Validation

Typically confirmed by: Finance, Procurement, Controllers.

### Business Validation

Typically confirmed by: Plant Director, Operations Director, Leadership.

---

## Outcome Facts vs. Decision Evaluation

These two concepts must remain strictly separate.

### Outcome Facts

Objective observations about what happened.

Examples:

- Production continued
- Shipment departed on time
- Customer commitment met
- Actual cost €250,000
- Insurance claim filed

Facts are recorded by Lena and validated by the relevant stakeholder. They carry no judgement.

### Decision Evaluation

An assessment of whether the decision was the right call, given all context available at the time and after.

Examples:

- Excellent
- Good
- Mixed
- Poor

**Decision evaluation depends on:**

- Company strategy at the time of decision
- Customer priority and relationship weight
- Risk appetite of the organisation
- Cost tolerance and budget position
- Operational constraints and alternatives available

**Decision evaluation belongs to leadership.** It must not be self-assessed by Lena or by the system. The system records the facts. A human manager evaluates quality in context.

---

## Outcome Timeline

There is no single outcome date. Different outcome components become visible at different points after the decision.

| Outcome component | Typical visibility window |
|---|---|
| Shipment rerouted / departed | 1 day |
| Expedite shipment status | 3 days |
| Production impact confirmed | 3–7 days |
| Supplier replacement confirmed | 7–14 days |
| Customer impact confirmed | At delivery or project close |
| Financial impact settled | 2–8 weeks |
| Insurance claim resolved | After claim decision (30+ days) |

These windows are indicative. The system proposes default timing based on decision type; the Case Owner may override.

---

## Outcome Checkpoints

Outcome tracking is performed through checkpoints.

**A checkpoint is not a reminder. A checkpoint is a task requiring confirmation.**

### Example checkpoint tasks

- Please confirm shipment departed.
- Please confirm production impact.
- Please confirm actual cost received from Finance.
- Please confirm customer commitment status.
- Please confirm insurance claim outcome.

### Checkpoint planning

The system proposes default checkpoints based on the decision type taken.

Default examples:

| Decision type | Default checkpoint |
|---|---|
| Expedite | Check after 3 days |
| Supplier Replacement | Check after 14 days |
| Insurance Claim | Check after 30 days |
| Reroute | Check after 1–3 days |

The Case Owner may accept, modify, remove, or add checkpoints at any time after the decision is recorded.

---

## Notification Model

Checkpoint notifications may be sent to any combination of:

- Decision Maker
- Operations
- Production
- Supply Chain
- Procurement
- Finance
- Plant Director
- Other stakeholders

Notification recipients are configurable per checkpoint and per case. The default recipient set is determined by the decision type and the outcome dimensions active for the case.

---

## No-Response Handling

When a checkpoint notification receives no response, the default flow is:

```
Task Sent
  → Reminder 1
  → Reminder 2
  → Reminder 3
  → Status: Pending / Unresolved
```

**No automatic closure occurs.**

After three unanswered reminders, Lena determines the next step:

- Close the checkpoint manually (outcome unknown)
- Extend the checkpoint window
- Escalate to a more senior stakeholder
- Route to a different stakeholder
- Mark as Unresolved and include in the final outcome summary

---

## Decision Memory

Decision Memory stores the complete lifecycle of every case outcome.

The memory must be able to answer:

| Question | Source |
|---|---|
| What happened operationally? | Operational Outcome record |
| What decision was taken? | DecisionRecord |
| What was checked after the decision? | Checkpoint log |
| Who was asked to confirm? | Notification log |
| Who confirmed, and when? | Confirmation records |
| What remained unresolved? | Unresolved checkpoint log |
| What was the final outcome? | Outcome Summary |
| What did this cost? | Financial Outcome record |
| Was there a customer impact? | Business Outcome record |

The memory captures both confirmations and non-responses. An unresolved checkpoint is a signal, not a gap to be hidden.

---

## Taxonomy Principle

Outcome categories are extensible and customer-specific by design.

The MVP vocabulary is intentionally small. Future categories will be discovered through:

- Domain Expert interviews (see `docs/strategy/outcome-reality-interview-guide.md`)
- Pilot case observations
- Customer vocabulary in onboarding conversations

The goal is not to define a perfect taxonomy before the first pilot. The goal is to learn the real operational language that customers use to describe disruption outcomes — and build the vocabulary around that evidence.

---

## Frequency Assumption

The current ICP assumption is:

> 20+ disruption decisions per year per operations manager

This assumption remains subject to validation through Domain Expert interviews and the Sprint 7 Gate (H9 hypothesis). If contradicted, the product positioning — not the outcome capture model — must change.

---

## Architectural Principles

Two principles that must not be violated in Sprint 7 design:

**1. Outcome is factual. Decision Quality is contextual. Both must be stored. Neither must be confused with the other.**

Outcome records are written by Lena and confirmed by stakeholders. They contain observed facts. Decision quality records are written by managers or leadership after evaluation. The two records may reference each other but must remain structurally separate.

**2. Outcome is a timeline, not a field.**

Do not design a single `outcome_status` field. Design a checkpoint log with a final summary. An outcome that has no response after 14 days is structurally different from a confirmed outcome — both must be representable without data loss.

---

## Sprint 7 Impact

This document is the canonical reference for:

- **Outcome Reality Gate** — `docs/sprints/sprint-7-gate.md`
- **Outcome Capture Design** — any Sprint 7 ticket touching OutcomeRecord, OutcomeDraft, or ConfirmOutcomeForm
- **Decision Memory Architecture** — the checkpoint log and outcome summary storage model
- **Notification Design** — the no-response handling flow and stakeholder routing
- **Validation Operating Model** — `docs/strategy/validation-operating-model.md`

Any Sprint 7 ticket that modifies the outcome data model must be reviewed against the principles in this document before implementation begins.

---

## Open Questions for Domain Expert Interviews

The following remain unresolved and must be addressed in the two Domain Expert interviews before Sprint 7 gate passes:

| # | Question | Load-bearing? |
|---|---|---|
| Q1 | Who actually knows the operational outcome, and how quickly? | Yes (H1) |
| Q2 | Does the operations manager have direct access to actual cost data, or is it locked in Finance? | Yes (H2) |
| Q3 | Is there a natural "case close" event in current practice that could trigger capture? | Yes (H3) |
| Q4 | Who owns the financial outcome — Operations or Finance? | Yes (H7) |
| Q5 | How many disruption decisions of CASE-001 severity does a typical ops manager face per year? | Yes (H9) |

These questions are operationalised in the full interview guide: `docs/strategy/outcome-reality-interview-guide.md`.

---

*Canonical model approved: June 2026*
*Authors: Amir, Claude / Platform Architect*
*Based on: Sprint 6 product review, domain-expert-validation-model.md, outcome-reality-interview-guide.md*
*Next review: After Sprint 7 Gate passes and pilot observations begin*
