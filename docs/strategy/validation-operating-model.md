---
title: DenkKern Validation Operating Model
version: 1.1
status: active
date: 2026-06-12
authors: [Amir, Claude / Platform Architect]
type: operating-model
changelog:
  - v1.1 (2026-06-12): Added Domain Expert as formal stakeholder category. Added Outcome Reality Gate as pre-Sprint-7 blocking gate. Added validation track concept.
  - v1.0 (2026-06-08): Initial model with Customer, Pilot Partner, Data Source categories.
---

# DenkKern Validation Operating Model

> **Purpose:** Define who we validate with, what each stakeholder type can and cannot tell us, how validation gates work, and what decisions are blocked until a gate is passed.

---

## Stakeholder Categories

DenkKern operates with four formal validation stakeholder categories. Each has a distinct function, a distinct set of questions it can answer, and a distinct set of questions it cannot.

---

### 1. Customer

**Who:** Current operations manager, supply chain manager, or production manager at a manufacturing company with maritime inbound supply dependency. Has budget authority or influences a buying decision.

**Primary function:** Validate product-market fit, willingness to pay, workflow integration, UI legibility.

**Can answer:**
- Would I use this in my company?
- Does this fit how we currently work?
- What would it take for us to buy this?
- What is missing that would make it a no-brainer?

**Cannot answer honestly:**
- How often our decisions are actually wrong
- Whether our daily downtime cost figure is accurate
- Whether our operations managers would honestly rate a decision as POOR
- Internal political dynamics around decision ownership
- How other companies in the industry handle this

**Relationship:** Commercial. They have an incentive to evaluate fit, not to give unfiltered operational truth.

**When to engage:** After Domain Expert interviews have calibrated the mental model. Customer conversations go better when the team is not pitching incorrect assumptions.

---

### 2. Pilot Partner

**Who:** A named company that has agreed to use DenkKern with real cases in a supervised pilot.

**Primary function:** Validate actual product behavior under real conditions — real data, real decisions, real edge cases, real operator behavior.

**Can answer:**
- Does the system work with our actual data?
- What breaks when a real disruption happens?
- Will our operations manager actually use this under time pressure?
- What does the approval workflow look like in our governance structure?

**Cannot answer:**
- Whether their situation is typical of the market
- Long-run outcome capture behavior (too few data points)
- Whether the financial calculations would survive CFO scrutiny

**Relationship:** Collaborative and partially commercial. They have agreed to participate, which means they have some incentive to make it work.

**When to engage:** After a Domain Expert–calibrated product demo has been validated with at least one Customer conversation. The pilot partner needs a product that is stable enough to not embarrass the team in a real operational context.

---

### 3. Data Source

**Who:** Maritime data provider (MarineTraffic, VesselFinder, or equivalent), weather API provider, port data provider, ERP integration vendor.

**Primary function:** Validate data availability, schema stability, freshness guarantees, licensing cost, and integration feasibility.

**Can answer:**
- What does the real API response look like?
- What is the freshness SLA?
- What does a pilot license cost?
- What are the schema stability guarantees?
- What edge cases does the data not cover?

**Cannot answer:**
- Whether operations managers will use the data
- Whether the data quality assumptions in the prediction adapter are correct

**Relationship:** Commercial. Data providers have an incentive to sign a contract. Their answers about data quality may be optimistic.

**When to engage:** Before any Sprint commits to real data integration. One conversation with a maritime data provider before Sprint 7 scope is locked is the minimum.

---

### 4. Domain Expert

**Who:** Former Supply Chain Director, Operations Director, Plant Manager, or Production Manager. Currently independent — consultant, advisor, non-executive, or retired. Has seen the inside of 3–10+ manufacturing companies. Has no stake in DenkKern's commercial success.

**Primary function:** Calibrate the mental model against operational reality before the model is presented to people with commercial stakes.

**Can answer:**
- How decisions are actually made (vs. how they should be made)
- Whether specific assumptions match real organisational practice
- What has killed similar tools in the past
- How decision outcomes are really captured (or not captured) in practice
- What an operations manager would actually do with this

**Cannot answer:**
- Whether a specific company would buy DenkKern
- Integration-specific questions about a particular customer's systems
- Current market pricing or procurement dynamics

**Relationship:** Non-commercial. No NDA required for early conversations. No payment in the first 2–3 conversations. Some Domain Experts may become informal advisors with a small equity stake or advisory fee after 3–4 generative conversations.

**When to engage:** Before customer demos, before pilot partner onboarding, and any time a load-bearing assumption has not been tested against real operational experience. Domain Experts are the pre-validation layer — they reduce the probability that customer conversations expose assumptions that should have been challenged earlier.

**Interview format:** 60 minutes, open conversation, product shown last (if at all). The guide is in `docs/strategy/outcome-reality-interview-guide.md`.

---

## Validation Tracks

A validation track is a focused sequence of interviews or experiments designed to test a specific cluster of assumptions before a sprint gate is passed. Tracks are time-boxed and have explicit deliverables.

| Track | Status | Gate | Lead | Deliverable |
|-------|--------|------|------|------------|
| **Outcome Reality** | OPEN | Sprint 7 Gate | Nick | 2 Domain Expert observation notes + hypothesis status table |

### Outcome Reality Track

**What it tests:** Whether the Outcome layer of the Decision Memory loop reflects how outcomes are actually captured inside manufacturing organisations.

**Why it exists:** Sprint 6 proved the technical loop. It did not prove the organisational truth of the outcome layer. The entire Decision Memory strategy depends on operations managers completing outcome capture. None of the assumptions behind this behavior have been tested against real practice.

**Deliverable:** Two structured observation notes, filed at:
- `docs/validation/outcome-reality-note-1.md`
- `docs/validation/outcome-reality-note-2.md`

Each note uses the template defined in `docs/sprints/sprint-7-gate.md`.

**Gate:** `docs/sprints/sprint-7-gate.md` — BLOCKING Sprint 7 engineering.

---

## Sprint Gates

A sprint gate is a formal hold on engineering work until a validation condition is met. Gates are created when a load-bearing assumption is untested and the cost of building on a wrong assumption exceeds the cost of a short hold.

Gates have:
- A named owner (the person responsible for passing it)
- Explicit criteria (what must be done before the gate passes)
- A decision rule (what the gate finding means for the sprint)
- A maximum hold duration (after which the team decides explicitly whether to proceed with acknowledged risk)
- A path map (what Sprint 7 looks like under each possible outcome)

### Active Gates

| Gate | Status | Owner | Unblocks | Max hold |
|------|--------|-------|----------|---------|
| **Outcome Reality Gate** | BLOCKING | Nick (interviews) / Amir (decision) | Sprint 7 engineering | 2026-06-26 |

### Passed Gates

*(none yet)*

---

## Principles

**1. Domain Experts before customers.**
Calibrate the mental model with people who have no commercial stake before presenting to people who do. A wrong assumption discovered in a Domain Expert conversation is free. The same assumption discovered in a customer meeting has a cost.

**2. Validate the layer before building on it.**
Sprint 6 built the Outcome layer. The Outcome Reality gate validates whether that layer rests on correct organisational assumptions before Sprint 7 adds more product on top of it. The principle generalises: before building on any layer, validate the layer.

**3. Gates are named risks, not bureaucracy.**
A gate is created because the team explicitly agrees that a specific assumption is load-bearing and untested. The gate converts implicit risk into a named, time-boxed hold. It is closed when the assumption is either confirmed (proceed) or contradicted (redesign), not when the team runs out of patience.

**4. Proceed with acknowledged risk is always available.**
If a gate cannot be passed within the hold period, the team may choose to proceed. The requirement is that the risk is documented explicitly: "We are building Sprint N without validating [assumption]. We accept the risk that [consequence] may follow." This is a legitimate choice. Undocumented proceeding is not.

**5. Observation notes are the output, not meeting summaries.**
Validation conversations produce structured observation notes within 24 hours. The note format is defined per track. Notes are filed in `docs/validation/`. They are the factual basis for all gate decisions and sprint plans. They are not replaced by email threads or Slack messages.

---

## Operating Cadence

| When | Activity | Who |
|------|---------|-----|
| Before any sprint plan | Check for open gates | Amir |
| Before customer demos | Check whether Domain Expert interviews have calibrated the relevant assumptions | Nick + Amir |
| After each Domain Expert interview | File observation note within 24 hours | Nick |
| After 2 interviews per track | Update hypothesis status table, apply decision rule, record gate decision | Amir |
| Sprint planning session | Gate decision is prerequisite agenda item | Full team |

---

*Document owner: Amir*
*Maintained by: Claude / Platform Architect*
*Last updated: June 2026 (v1.2 — Outcome Reality Model v1.0 added as canonical reference)*
*Canonical outcome model: `docs/strategy/outcome-reality-model-v1.md`*
