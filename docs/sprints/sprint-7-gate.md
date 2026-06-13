---
title: Sprint 7 Gate — Outcome Reality
version: 1.1
status: BLOCKING
date: 2026-06-12
accepted: 2026-06-12
authors: [Amir, Claude / Platform Architect]
type: gate
gate_name: Outcome Reality Gate
blocks: Sprint 7 engineering
owner: Nick (interview lead)
---

# Sprint 7 Gate — Outcome Reality

> **Status: BLOCKING**
> Sprint 7 engineering cannot begin until this gate is passed.
> This document defines the gate criteria, the decision rule, and the two paths forward.

---

## Why This Gate Exists

Sprint 6 proved the technical loop:

```
Signal → Recommendation → Decision → DecisionRecord
       → Arrival → OutcomeDraft → Notification → Token form → OutcomeRecord confirmed
```

It did not prove the organisational truth of the outcome layer.

The Decision Memory strategy depends on operations managers completing outcome capture after disruptions resolve. Every assumption about *who knows the outcome*, *when the data is available*, *where it is currently recorded*, and *who owns the financial figure* is still untested against real organisational practice.

If any load-bearing assumption is wrong, building more product on top of the current capture model compounds the error. The cost of discovering this after Sprint 7 is significantly higher than the cost of two 60-minute conversations before Sprint 7 begins.

This gate converts that risk into a deliberate hold.

---

## Gate Criteria

Sprint 7 engineering is unlocked when **all four conditions are met**:

| # | Condition | Owner | Done when |
|---|-----------|-------|-----------|
| G1 | Domain Expert Interview 1 completed | Nick | Structured observation note filed at `docs/validation/outcome-reality-note-1.md` |
| G2 | Domain Expert Interview 2 completed | Nick | Structured observation note filed at `docs/validation/outcome-reality-note-2.md` |
| G3 | Hypotheses H1–H10 marked with status | Nick + Amir | Each hypothesis in the interview guide marked: Confirmed / Challenged / Contradicted / Insufficient data |
| G4 | Sprint 7 path decision recorded | Amir | Path A or Path B selected and documented in this file (Section: Gate Decision) |

**Target completion:** Before Sprint 7 planning session.
**Maximum hold:** 2 weeks from today (2026-06-26). If interviews cannot be completed within 2 weeks, convene a team session to decide whether to proceed with explicit acknowledged risk or extend the hold.

---

## The Hypotheses Being Tested

These are reproduced from the interview guide for reference. They are the basis of the gate decision.

| # | Hypothesis | Load-bearing? |
|---|-----------|--------------|
| **H1** | Operations managers know within 1–2 weeks whether a disruption decision was financially correct | **Yes** |
| **H2** | The actual cost of the response is accessible to the operations manager (not locked in Finance) | **Yes** |
| **H3** | There is a natural "disruption close" event that can trigger an outcome capture prompt | **Yes** |
| H4 | Operations managers will honestly self-assess decision quality in a recorded system | No |
| H5 | The counterfactual cost-avoided figure resonates with operations managers | No |
| H6 | Disruption outcomes are currently recorded somewhere in most manufacturing organisations | No |
| **H7** | The financial outcome of a disruption is owned by operations, not finance | **Yes** |
| H8 | Post-mortems exist for disruptions above a certain financial threshold | No |
| **H9** | Operations managers face more than 10 disruptions of CASE-001 severity per year | **Yes** |
| H10 | There is a feedback loop between disruption outcomes and future decision-making in most organisations | No |

**Load-bearing hypotheses are H1, H2, H3, H7, and H9.** If all five are confirmed, the current capture model is sound and Sprint 7 can build forward. If any are contradicted, the capture model must be redesigned before more product is built on it.

H9 is added as load-bearing here because it was not originally in the gate definition but is equally critical: if the answer to "how often does this happen?" is 2–3 times per year, the tool is used too infrequently to build habit, accumulate data, or justify a contract renewal.

---

## Interview Requirements

Two interviews, each 60 minutes, run by Nick.

**Expert profiles to target:**
- Former Supply Chain Director or Operations Director, manufacturing sector, European operations, 15+ years experience, currently independent (consultant, advisor, or retired)
- Former Plant Manager or Production Manager with direct experience of maritime supply disruptions who has since moved roles or left the company

**Interview guide:** `docs/strategy/outcome-reality-interview-guide.md`

**Observation note template** (file each at `docs/validation/outcome-reality-note-N.md`):

```markdown
---
interview: N
date: YYYY-MM-DD
expert_profile: [role, sector, years, independence status]
interviewer: Nick
---

## Disruption Story
[1 paragraph — the specific case they described]

## Critical Question Answers

**Who knows the outcome?**
[their answer]

**When does the outcome become visible?**
[their answer — specific timing if given]

**Where is outcome data recorded today?**
[their answer]

**Is decision quality ever honestly assessed?**
[their answer]

**Who owns the financial outcome?**
[their answer — operations / finance / split]

**Is a 7–14 day confirmation window realistic?**
[their answer]

## Hypothesis Status After This Interview

| Hypothesis | Status | Evidence |
|-----------|--------|---------|
| H1 — outcome known within 1–2 weeks | Confirmed / Challenged / Contradicted / Insufficient |  |
| H2 — cost accessible to ops manager | Confirmed / Challenged / Contradicted / Insufficient |  |
| H3 — natural close event exists | Confirmed / Challenged / Contradicted / Insufficient |  |
| H4 — honest self-assessment realistic | Confirmed / Challenged / Contradicted / Insufficient |  |
| H5 — cost-avoided figure resonates | Confirmed / Challenged / Contradicted / Insufficient |  |
| H6 — outcomes recorded somewhere today | Confirmed / Challenged / Contradicted / Insufficient |  |
| H7 — financial outcome owned by ops | Confirmed / Challenged / Contradicted / Insufficient |  |
| H8 — post-mortems exist | Confirmed / Challenged / Contradicted / Insufficient |  |
| H9 — 10+ disruptions per year | Confirmed / Challenged / Contradicted / Insufficient |  |
| H10 — feedback loop to future decisions | Confirmed / Challenged / Contradicted / Insufficient |  |

## Confirmed Assumptions
[list]

## Challenged or Contradicted Assumptions
[list — include the direct quote or observation that challenged it]

## New Information Not Previously Modelled
[list]

## Direct Quotes
[2–3 verbatim quotes, the most important things they said]

## Product Reaction
[if shown — reaction to the confirmation form and the €1.43M savings figure]

## Implication for Sprint 7
[one sentence]
```

---

## The Decision Rule

After both interviews are complete and hypotheses are marked, Amir applies the following decision rule:

### Path A — Confirmed: Sprint 7 builds forward

**Condition:** H1, H2, H3, H7, and H9 are all marked Confirmed or Challenged (not Contradicted) across both interviews.

**What this means:** The current capture model is structurally sound. Operations managers know the outcome within the capture window, have access to the cost data, recognise a natural close event, own the financial figure, and face enough disruptions to build the tool into routine practice.

**Sprint 7 direction under Path A:**
- Workflow state persistence (fix the in-memory bug — highest technical risk)
- Pilot readiness: real vessel data feed, first real case outside CASE-001
- Capture refinement: longer token TTL if interviews suggest 2 weeks is too short
- Optional: Finance Validation workflow if H2 was Challenged (cost accessible but with friction)

---

### Path B — Contradicted: Sprint 7 redesigns the capture model

**Condition:** Any of H1, H2, H3, H7, or H9 is marked Contradicted in either interview.

**What this means:** A load-bearing assumption is wrong. Building more product on the current capture model compounds the error.

**Sprint 7 direction under Path B depends on which hypothesis was contradicted:**

| Contradicted hypothesis | Redesign required |
|------------------------|------------------|
| **H1** — ops manager doesn't know outcome within 2 weeks | Extend capture window to 30–60 days. Redesign token TTL. Add a "not yet" option to the confirmation form — "I don't have the numbers yet, remind me in 2 weeks." |
| **H2** — cost locked in Finance, ops manager doesn't have it | Add a Finance-facing view. The confirmation form must either pull from ERP or route to Finance for cost entry. Ops manager confirms production impact; Finance confirms cost. |
| **H3** — no natural close event | Do not trigger outcome capture on vessel arrival. Instead: trigger on a calendar-based delay (30 days after decision), or require a manual "close case" action in the UI, or use the workflow state machine to require explicit case close. |
| **H7** — financial outcome owned by Finance, not ops | The capture form has the wrong actor. A second role (Finance contact) must be introduced. The notification email goes to two people: ops for production impact, finance for cost figures. This requires a role model that doesn't currently exist. |
| **H9** — fewer than 5–6 disruptions per year | The product needs to cover a wider disruption surface (air freight, supplier delays, domestic logistics) or reposition as a periodic decision support tool rather than a routine workflow tool. This is a scope and ICP change, not a capture design change. |

---

## Formal Standing Orders (accepted 2026-06-12)

The following constraints are in effect until the Gate Decision section is filled:

**Required before Sprint 7 planning:**
- `docs/validation/outcome-reality-note-1.md` — Domain Expert interview 1 (Nick)
- `docs/validation/outcome-reality-note-2.md` — Domain Expert interview 2 (Nick)
- Gate Decision section completed by Amir

**Explicitly blocked until gate resolves:**
- Learning Layer / similar-case retrieval
- RAG or vector search on decision records
- Analytics dashboards or outcome visualisations
- Multi-industry expansion (template 2+)
- Additional product polish (modal, dashboard indicator, UX improvements)
- Any new API surface beyond what Sprint 6B delivered

**Permitted while gate is open (low-regret only):**
- Workflow state persistence fix (in-memory → file/DB backed) — highest-risk technical item, justified regardless of interview findings
- Token TTL extension if interviews suggest 7 days is too short — safe to do in advance
- Documentation and knowledge base maintenance

**Decision frequency note (H9):** If Domain Expert interviews contradict H9 — operations managers face fewer than 5–6 disruptions per year of CASE-001 severity — Sprint 7 must address ICP selection before capture design. The fix is not a technical change; it is a scope and beachhead decision.

---

## Gate Decision

*This section must remain blank until both observation notes exist. Amir fills it in after both interviews are complete. The Gate Decision section is the unlock key for Sprint 7 planning.*

```
Gate decision date:     [to be filled]
Path selected:          [A or B]
Decision basis:         [which hypotheses were confirmed, challenged, contradicted]
Sprint 7 first ticket:  [the first engineering task that is now unblocked]
Signed:                 [Amir]
```

---

## What Happens If the Gate Is Never Passed

If interviews cannot be secured within 2 weeks, the team has two options:

**Option 1 — Proceed with acknowledged risk.** Document explicitly: "We are building Sprint 7 without validating H1–H9. We accept the risk that the capture model may require redesign after pilot." This is a legitimate choice if the pilot timeline is fixed. The risk is known and named.

**Option 2 — Extend the hold and use the time differently.** Use the 2-week hold for technical debt reduction: fix the workflow state persistence bug, add the Finance validation flow as an option, extend the token TTL to 30 days. These are low-regret investments that are justified regardless of what the interviews reveal.

Option 2 is the stronger default if the interviews are genuinely blocked. Fix the highest-risk technical issue (in-memory workflow state) while waiting for the validation signal. Do not start new product surface.

---

*Gate owner: Amir*
*Interview lead: Nick*
*Drafted: June 2026*
*Based on: sprint-6-product-review.md, domain-expert-validation-model.md, outcome-reality-interview-guide.md*
*Canonical outcome model: `docs/strategy/outcome-reality-model-v1.md`*
*Sprint 7 implementation plan: `docs/sprints/sprint-7-plan.md`*
*Gate status updated June 2026: interviews validate/refine, no longer block implementation.*
