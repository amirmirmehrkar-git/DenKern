---
title: Sprint 7 Evidence Gate — Customer Validation Interview Guide
project: DenkKern
status: ready-for-interviews
created: 2026-06-12
owner: Amir / Nick
purpose: Validate business risk before Sprint 7 engineering begins
---

# Sprint 7 Evidence Gate — Customer Validation Interview Guide

## Why this document exists

Sprint 6 proved that DenkKern can technically close the Decision Memory loop:

```text
Signal → Recommendation → Decision → DecisionRecord
       → Arrival → OutcomeDraft → Notification → Token Form → OutcomeRecord confirmed
```

The system is technically sound.

The business is still unvalidated.

Before Sprint 7 starts, the team needs evidence from real operations people. The goal is not to sell the product. The goal is to observe whether CASE-001 feels real, trusted, useful, and worth further engagement.

## Governing principle

Do not start Sprint 7 engineering until at least one real operations manager has walked through CASE-001.

Sprint 7 should be driven by customer evidence, not by the next interesting feature.

## Target participants

Prioritize people who regularly deal with disruption, operational pressure, production risk, or supply-chain exceptions.

Ideal profiles:

- Operations Manager
- Supply Chain Manager
- Production Manager
- Plant Manager
- Logistics / Procurement Lead
- COO or Head of Operations in an SME

Minimum useful participant:

Someone who has personally handled a delayed shipment, supplier issue, production interruption, urgent expedite decision, or customer delivery risk.

## Session format

Length: 45 minutes

Mode: live walkthrough, not sales demo

Facilitator: ideally Nick

Observer: Amir or James, silent if possible

Artifact shown: CASE-001 flow

What to observe:

- Where they trust the system
- Where they challenge the numbers
- Where they ask for missing context
- Where they say, “this is how it actually works”
- Whether they would complete outcome confirmation
- Whether they can identify a real use case from their own work

## Session structure

### 1. Opening — 3 minutes

Script:

> We are not here to sell you anything. We are testing whether this workflow reflects a real operational decision problem. Please be critical. If something feels unrealistic, unclear, or not valuable, that is the most useful feedback.

Set expectation:

- This is a prototype walkthrough.
- Some data is mocked.
- The scenario is intentionally specific.
- We are testing trust, usefulness, and workflow fit.

## 2. Problem reality — 8 minutes

Show the CASE-001 situation:

```text
Critical shipment delayed.
Predicted delay: 14 days
Inventory coverage: 3 days
Customer commitment at risk
Daily downtime cost: €150,000
```

Ask:

1. When something like this happens today, what do you actually do first?
2. Who becomes involved in the decision?
3. Who makes the final call?
4. What is the hardest part of making the decision?
5. What creates the most pressure: time, money, customers, internal escalation, or uncertainty?
6. How often do cases like this happen in your organization?

Listen for:

- Manual coordination
- Excel / email / ERP screenshots
- Escalation to managers
- Lack of cost clarity
- Uncertainty around alternatives
- Political pressure between teams

Strong signal:

They describe a real recent case without much prompting.

Weak signal:

They say this is rare, theoretical, or handled easily by existing tools.

## 3. Context trust — 8 minutes

Show the business context transformation:

```text
Signal: shipment delayed 14 days
Context: inventory = 3 days
Impact: production stop risk = 11 days
Financial exposure: €1.65M
Alternative: expedite for €220k
```

Ask:

7. Which of these data points would you trust immediately?
8. Which number would you challenge first?
9. Who in your company owns the downtime-cost number?
10. Would €150,000/day be available in your systems, or would someone have to estimate it manually?
11. What context is missing before you would take this seriously?
12. What would make the financial impact calculation credible?

Listen for:

- Finance ownership
- ERP availability
- skepticism about downtime cost
- need for customer priority, production schedule, supplier constraints
- request for source links or traceability

Strong signal:

They challenge the calculation but agree the calculation is important.

Weak signal:

They do not care about the cost calculation.

## 4. Recommendation usefulness — 8 minutes

Show options:

```text
WAIT: €1.65M estimated cost
EXPEDITE: €220k estimated cost
REPLACEMENT SUPPLIER: €350k estimated cost
Recommended action: EXPEDITE
```

Ask:

13. If you saw this recommendation, would you investigate it further?
14. What would stop you from following it?
15. What information would you need before approving EXPEDITE?
16. Would this recommendation help you decide, or only confirm what you already knew?
17. Who would need to approve the expedite cost?
18. What would make the recommendation unacceptable?

Listen for:

- procurement constraints
- supplier availability
- budget authority
- logistics feasibility
- need for confidence intervals
- need for audit trail

Strong signal:

They say the recommendation would accelerate alignment or escalation.

Weak signal:

They say the team would ignore it and use existing processes.

## 5. Outcome capture test — 10 minutes

Show the follow-up email / token confirmation concept:

```text
Vessel arrived.
System generated an outcome draft.
Please confirm production impact and decision quality.
```

Ask:

19. Would you open this confirmation link two weeks after the crisis?
20. What would make you ignore it?
21. What would make you complete it?
22. Is email the right channel, or should this appear somewhere else?
23. Who is the right person to confirm the outcome?
24. Would you trust a system-generated outcome draft?
25. What should the system infer automatically instead of asking you?
26. What is the maximum acceptable effort for outcome confirmation?

Force a concrete answer:

> Would you complete this if it took 30 seconds?
> Would you complete this if it took 3 minutes?
> Would you complete this if it required finding data in another system?

Listen for:

- email fatigue
- ownership ambiguity
- preference for ERP-derived actuals
- need for one-click confirmation
- desire for reminder timing

Strong signal:

They say they would confirm if the draft is mostly pre-filled.

Weak signal:

They say nobody would own this after the crisis.

## 6. Willingness-to-pilot — 6 minutes

Ask:

27. If this worked reliably, which team would benefit most?
28. What would need to be proven before you would pilot it?
29. Who would need to approve a pilot?
30. What data access would be politically or technically difficult?
31. What would be a successful pilot result?
32. What would make you reject the product?
33. If this saved one disruption per quarter, would it be worth paying for?

Best final question:

34. If you had this tomorrow, where would you use it first?

Then stop talking and let them answer.

## 7. Questions not to ask

Avoid these because they produce false-positive feedback:

- Do you like this idea?
- Would you use this?
- Is AI useful for your company?
- Is this interesting?
- Would your company pay for this?

Ask about behavior, recent cases, trust, decision ownership, and pilot conditions instead.

## 8. Evidence capture template

Use this immediately after the call.

```markdown
# Interview Notes — DenkKern Validation

Date:
Participant role:
Company type:
Industry:
Approx. company size:

## 1. Real pain evidence
- Did they describe a real recent disruption?
- What happened?
- Who was involved?
- What was painful?

Signal quality: Strong / Medium / Weak

## 2. Context trust
- Which numbers did they trust?
- Which numbers did they challenge?
- What missing context did they ask for?
- Who owns the financial impact calculation?

Signal quality: Strong / Medium / Weak

## 3. Recommendation reaction
- Did they find the recommendation useful?
- What would block approval?
- What additional evidence did they need?

Signal quality: Strong / Medium / Weak

## 4. Outcome capture behavior
- Would they confirm the outcome?
- What channel would work?
- What effort level is acceptable?
- What should be inferred automatically?

Signal quality: Strong / Medium / Weak

## 5. Pilot potential
- Would they introduce us to the right person?
- What would need to be proven?
- Who owns budget?
- What is the strongest buying trigger?

Signal quality: Strong / Medium / Weak

## 6. Exact quotes
- Quote 1:
- Quote 2:
- Quote 3:

## 7. Product implications
- Must build:
- Must not build:
- Needs more evidence:

## 8. Sprint 7 recommendation
Proceed to engineering? Yes / No
If yes, build:
If no, validate:
```

## 9. Decision rules before Sprint 7

Do not start Sprint 7 engineering unless at least one of these is true:

1. A real operations person confirms CASE-001 resembles a real decision workflow.
2. They identify a recent real disruption that DenkKern could have helped with.
3. They challenge the numbers but agree the financial framing is valuable.
4. They say the outcome confirmation is acceptable if mostly pre-filled.
5. They offer a pilot path, internal intro, or concrete next step.

Pause Sprint 7 engineering if:

- The problem feels theoretical.
- They do not trust the cost model at all.
- They would not confirm outcomes.
- They cannot identify a real owner.
- They see no reason to change from current tools.

## 10. Recommended Sprint 7 direction based on likely outcomes

If trust in cost numbers is weak:

Sprint 7 should focus on financial impact validation and cost-source traceability.

If outcome confirmation is the weak point:

Sprint 7 should focus on outcome capture automation and ERP/read-only actuals.

If recommendation usefulness is weak:

Sprint 7 should focus on decision option quality and operational constraints.

If workflow ownership is unclear:

Sprint 7 should focus on stakeholder map, role model, and escalation workflow.

If all signals are strong:

Sprint 7 can prepare pilot-readiness features, but still avoid Learning Layer, RAG, and multi-industry expansion.

## 11. What not to build in Sprint 7 yet

Do not build:

- Learning Layer
- Similar-case retrieval
- RAG over Decision Memory
- Multi-industry templates
- SAP automation
- Slack/Jira/Teams execution orchestration
- Complex dashboards
- Generic platform features

Reason:

DenkKern does not yet need more intelligence. It needs stronger evidence that the loop matters to real operators.

## 12. One-line strategic summary

Sprint 6 proved DenkKern can create Decision Memory.

The Evidence Gate must prove whether real operators care enough to use it.
