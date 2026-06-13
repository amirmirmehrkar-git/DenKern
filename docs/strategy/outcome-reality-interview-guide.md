---
title: Outcome Reality — Domain Expert Interview Guide
version: 1.0
status: active
date: 2026-06-12
authors: [Claude / Platform Architect]
type: interview-guide
trigger: pre-sprint-7-validation-track
related: domain-expert-validation-model.md, sprint-6-product-review.md
---

# Outcome Reality — Domain Expert Interview Guide

> **Purpose:** Validate the assumptions behind the Outcome layer of DenkKern's Decision Memory loop before Sprint 7 planning. This guide is for Nick to use in structured 60-minute conversations with Domain Experts — former Supply Chain Directors, Operations Directors, Plant Managers, or Production Managers with direct experience of maritime supply disruptions in manufacturing.

---

## Before You Start

### What we are trying to learn

DenkKern's Decision Memory loop assumes that after a disruption resolves, someone will know what happened, will have access to the numbers, and will record the outcome within days. This guide exists to find out whether that assumption is true.

We are not selling anything in this conversation. We are trying to understand how outcomes are actually captured (or not captured) inside manufacturing organisations. If the answer is "they aren't," that is extremely valuable — it tells us what DenkKern needs to solve before building anything else.

### What not to do

- Do not show the product until the last 10 minutes, if at all.
- Do not describe how DenkKern captures outcomes before asking how outcomes are currently captured. You will anchor the answer.
- Do not correct wrong assumptions. If the expert describes a process that seems inefficient, listen — that gap is exactly what we need to understand.
- Do not ask leading questions ("Do you think recording decision quality would be valuable?"). Ask open questions and follow the answer.

### Who to recruit

Former (not current) directors and managers work better than current ones. Former directors speak freely. Current ones are managing a reputation. Ideal profiles:

- Former Supply Chain Director or VP Supply Chain, manufacturing sector, European operations
- Former Operations Director or Plant Manager with direct responsibility for disruption decisions
- Former Production Manager who lived through maritime supply delays
- Supply chain consultant who has worked inside 5+ manufacturing organisations

Target 2–3 conversations before Sprint 7 planning. Each is 60 minutes.

---

## Interview Structure

```
0–5 min    Framing and context
5–20 min   Their experience — a specific disruption story
20–40 min  The outcome layer — what happened after the decision
40–55 min  The systemic picture — across all the companies they know
55–60 min  Optional: show DenkKern, gather reaction
```

---

## Section 1: Framing (5 minutes)

Use this opening. Say it naturally, not as a script.

> "We are building a tool to help manufacturing operations teams make better decisions when critical shipments are delayed. We are at an early stage and the most important thing we can do right now is understand how these decisions and their outcomes are actually handled inside organisations — not how they should be handled, but how they really are.
>
> I'd like to spend most of our time on your experience, not on our product. The questions might feel unusually direct — things like whether anyone actually records what a decision cost, or whether anyone ever admits a decision was wrong. I'm asking because those are the things that determine whether a tool like ours can work in practice.
>
> There is no right answer. The most useful thing you can tell me is what you actually observed."

---

## Section 2: The Disruption Story (15 minutes)

Start with a specific story. This gets the expert out of the abstract and into memory. Everything that follows will be more accurate.

**Opening question:**

> "Can you take me back to a specific disruption — a time when a critical inbound shipment was significantly delayed and you had to make a decision under real time pressure? Walk me through what happened from the moment you found out to the moment the disruption was resolved."

Let them talk. Take notes on: who was involved, what information was available, what decision was made, and — importantly — where the story naturally ends. Most people will end the story when the vessel arrived or the decision was executed. Note whether they mention anything about what happened afterward.

**If they end the story at the decision point (likely):**

> "What happened after that? After the vessel arrived or the action was taken — what was the next step in the process?"

Listen carefully. The answer to this question reveals the natural endpoint of the disruption in their mental model. If the story ends when the vessel docked, outcome capture is not a natural part of the process.

**Follow-up questions for the story:**

> "Looking back — did that decision turn out to be the right one?"

> "How do you know?"

These two questions together are extremely revealing. The first asks for a judgment. The second asks for the evidence behind it. If the answer to "how do you know" is "it felt right" or "production kept running," that tells you outcome assessment is qualitative, not quantitative. If the answer is "we ran the numbers six weeks later," that tells you timing and data access.

---

## Section 3: The Outcome Layer — 12 Questions (20 minutes)

These are the core validation questions. You will not get through all 12 in 20 minutes. Prioritise the ones marked **[critical]**. The others are follow-up probes depending on the conversation.

Do not ask them in sequence like a questionnaire. Use them as anchors to follow the conversation.

---

### Question Group A — Who knows

**[Critical] "After a disruption like that — who in the organisation actually knew whether the decision was successful?"**

What you are testing: whether "success" is a shared, defined concept or a personal judgment. Listen for: does one person know, or multiple people with different pieces of information? Is there disagreement about what "successful" means?

Follow-up if needed: *"Was there a shared definition of success, or did different people have different views?"*

---

**"Who knew what the decision actually cost — the total financial impact of what was done?"**

What you are testing: whether financial outcome is a single traceable number or a distributed set of figures across departments. Listen for: operations vs. finance ownership, whether expedite costs were tracked separately from production impact, whether the number ever converged anywhere.

Follow-up if needed: *"Was that number ever in one place, or did you have to go to three different people to assemble it?"*

---

**"Was the person who made the decision the same person who would eventually learn whether it was right?"**

What you are testing: feedback loop closure. In many organisations, the operations manager makes the decision and moves on to the next crisis. The financial outcome is eventually computed by Finance but never fed back to the decision maker. This is the specific structural gap DenkKern is trying to close — but it may not feel like a gap to the people inside it.

---

### Question Group B — When the information becomes available

**[Critical] "When did you actually know — with real numbers, not estimates — what the disruption had cost?"**

What you are testing: the lag between decision and measurable outcome. The answer to this question directly determines whether a 7-day confirmation window is realistic or whether the real number takes 4–8 weeks to appear in the accounting system.

Listen for: cost booking cycles, when invoices from expedite freight are settled, how long production impact takes to show up in the ERP.

Follow-up if needed: *"Was that days, weeks, or months after the disruption resolved?"*

---

**"Was there a moment when everyone involved agreed: 'this disruption is over, here is what happened'? Or did it just fade?"**

What you are testing: whether there is a natural close event that DenkKern can attach outcome capture to. If disruptions "fade" rather than formally close, automated outcome prompts may fire at the wrong moment — too early (before the costs are known) or too late (when nobody cares anymore).

---

**"If you had wanted to record the full outcome — actual cost, production impact, whether the decision was right — when was the earliest moment you could have done that with confidence?"**

What you are testing: the earliest realistic capture window. This is the most direct test of the 7-day token TTL assumption. If the honest answer is "probably 4–6 weeks," the token design needs to change.

---

### Question Group C — Where it is recorded today

**[Critical] "Where, if anywhere, was the outcome of that disruption recorded? Not the decision itself — the outcome."**

What you are testing: whether any current system captures outcomes at all, and in what form. Possible answers range from "nowhere" to "a post-mortem document" to "a Jira ticket" to "a cell in a shared spreadsheet." Any of these is informative.

Follow-up if needed: *"Could you go back today and find out what that decision cost and whether it was the right one?"*

---

**"Was there a post-mortem, lessons-learned, or incident review for disruptions above a certain size?"**

What you are testing: whether formal retrospective processes exist and, if so, what they capture. A post-mortem may capture what went wrong without capturing the financial outcome. Or it may capture the financial outcome but not the decision quality assessment.

Follow-up if needed: *"What did those reviews actually record? And who saw the output?"*

---

### Question Group D — Decision quality

**[Critical] "Was the quality of the decision ever explicitly assessed — separate from whether the outcome was good? In other words: did anyone ever say 'that was a good decision even though the outcome was bad' or 'that was a poor decision even though it worked out'?"**

What you are testing: whether decision quality as a concept exists in operations culture, distinct from outcome quality. This is important because DenkKern asks Lena to rate `decision_quality` — a judgment that requires separating process from result. If this distinction doesn't exist in practice, the field may always be filled based on outcome, making it useless as a signal.

---

**"If an operations manager made a decision that turned out to be wrong — say, they chose to wait and production stopped — was that ever recorded somewhere that could affect their performance review or standing?"**

What you are testing: the political risk of honest self-assessment. This is the question that determines whether `decision_quality: POOR` will ever appear in a real DenkKern record. If the answer is yes — decisions are traceable and have consequences — then honest self-assessment is unlikely in a system that management can access. DenkKern may need to make decision quality anonymous at the team level, or visible only to the decision maker themselves.

---

### Question Group E — Financial ownership

**[Critical] "Who owned the financial outcome of a disruption decision — operations, finance, procurement, or someone else?"**

What you are testing: the organisational home of outcome data. If the financial outcome lives in Finance and not in Operations, then asking an operations manager to record `actual_cost_eur` is asking them to record a number they may not have or may not be authorised to record. This is a permissions and data access problem, not a product design problem.

Follow-up if needed: *"Would the operations manager have access to that number in a normal week, or would they have to request it from Finance?"*

---

**"Was there ever a formal comparison — 'here is what we spent on the response, here is what it would have cost if we had done nothing'? Did anyone compute that counterfactual?"**

What you are testing: whether `estimated_cost_avoided_eur` maps to a concept that exists in operations practice, or whether DenkKern is introducing a metric that nobody currently tracks. If nobody computes the counterfactual today, DenkKern's "savings" figure may be genuinely novel — which means it either needs to be explained carefully or will be viewed with suspicion.

---

## Section 4: The Systemic Picture (15 minutes)

Move from the specific story to patterns across organisations. Domain Experts who have worked in multiple companies will have comparison points that are more valuable than any single organisation's practices.

**Opening:**

> "You've seen this across multiple companies. Setting aside the specific case we talked about — what is the most common pattern you have observed for how operational disruption outcomes are handled after the fact?"

Let them answer fully. This is often where the most honest observations come out — they are no longer describing their own practice but observing others.

---

**"In your experience, do operations managers generally know whether their decisions were good ones — in the financial sense?"**

This is a summary question that invites reflection on the whole field. The answer may be: "they have a feel for it but not a number," or "the good managers track it obsessively, the average ones don't," or "nobody does because the incentive is to make a decision and move on."

---

**"If a team wanted to systematically learn from disruption decisions — to get better over time — what would need to be true inside the organisation for that to work?"**

This is the question that generates the most strategic insight. The expert is being asked to describe the preconditions for the behaviour DenkKern depends on. Their answer may reveal structural requirements (Finance integration, management buy-in, defined close events) that DenkKern currently assumes but doesn't enable.

---

**"What would make an operations manager trust a system that recorded their decisions and outcomes over time?"**

This is the trust and adoption question. The answer may include: anonymity, no management access, seeing value back (prediction accuracy feedback), peer comparison only, or "nothing — they would never trust it." All of these are actionable design signals.

---

**"What is the thing teams building tools like this most commonly get wrong?"**

This is the same question from the previous document but delivered at the end of a full conversation, after 50 minutes of context. The answer here will be more specific and more honest than in a cold conversation.

---

## Section 5: Optional Product Reaction (10 minutes)

Only show the product if the conversation has been generative and the expert is engaged. Do not use this time to pitch. Use it to test specific reactions.

**Setup:**

> "I want to show you one thing we have built and get your honest reaction — specifically whether it matches the reality you've been describing."

Show: the confirmation form (`/cases/CASE-001/confirm-outcome?token=...`) with the pre-populated draft values and the 5 fields.

**Observation question:**

> "If you were Lena — the operations manager in this scenario — and this arrived in your email two weeks after the disruption resolved, what would you do?"

Watch for: do they immediately say "I'd fill it in"? Or do they pause? Or do they ask "who sees this?"

---

**Show the confirmed outcome summary with `estimated_cost_avoided_eur: €1,430,000`.**

> "If this number appeared in a system after a disruption you were involved in — what would your reaction be, and what would you want to know about where it came from?"

This is the single most important product reaction test in the guide. The answer will tell you whether the savings figure is credible at face value, requires explanation, or triggers scepticism that needs to be addressed before any customer presentation.

---

## What to Record After Each Conversation

Within 24 hours, write a structured observation note with:

```
Expert profile:        [role, sector, years experience, companies seen]
Disruption story:      [1 paragraph — the specific case they described]
Outcome capture today: [how they described current practice]
Critical answers:
  - Who knows the outcome?
  - When is it available?
  - Where is it recorded?
  - Is decision quality assessed?
  - Who owns the financial outcome?
  - How long until true outcome is visible?
Confirmed assumptions:  [what we believed that they confirmed]
Challenged assumptions: [what we believed that they contradicted]
New information:        [things we had not modelled at all]
Direct quotes:          [verbatim, the 2-3 most important things they said]
Product reaction:       [if shown — what was their response to the savings figure?]
Implication for Sprint 7: [one sentence — what does this change or confirm?]
```

---

## Hypotheses Being Tested

These are the specific hypotheses the interview guide is designed to test. After 2–3 conversations, each hypothesis should be marked: **Confirmed**, **Challenged**, **Contradicted**, or **Insufficient data**.

| # | Hypothesis | Critical? |
|---|-----------|----------|
| H1 | Operations managers know within 1–2 weeks whether a disruption decision was financially correct | Yes |
| H2 | The actual cost of the response (expedite, replacement) is accessible to the operations manager | Yes |
| H3 | There is a natural "disruption close" event that can trigger an outcome capture prompt | Yes |
| H4 | Operations managers are willing to self-assess decision quality honestly in a recorded system | Yes |
| H5 | The counterfactual ("cost if we had done nothing") is a concept that resonates with operations managers | Yes |
| H6 | Disruption outcomes are currently recorded somewhere in most manufacturing organisations | No |
| H7 | The financial outcome of a disruption is owned by operations, not finance | Yes |
| H8 | Post-mortems exist for disruptions above a certain financial threshold | No |
| H9 | Operations managers have more than 10 disruptions of CASE-001 severity per year | Yes |
| H10 | There is a feedback loop between disruption outcomes and future decision-making in most organisations | No |

---

## The Stakes

To be explicit about why this validation track matters before Sprint 7:

DenkKern's long-term value — the Decision Memory moat — depends entirely on outcomes being captured accurately and at reasonable scale. The email notification and confirmation form built in Sprint 6B are technically complete. But they solve a product design problem. The deeper question is whether outcome capture is a **product problem** or an **organisational behavior problem**.

If H1, H2, H3, and H7 are confirmed — operations managers know the outcome within 2 weeks, have the cost figures, recognise the close event, and own the financial outcome — then Sprint 7 should focus on making DenkKern the easiest place to record what they already know.

If H1, H2, H3, or H7 are contradicted — the outcome isn't known within 2 weeks, the cost figures are locked in Finance, disruptions fade without a clear endpoint, or financial ownership is ambiguous — then Sprint 7 should focus on a different problem: either a Finance integration, a longer capture window, a manager-facing outcome view (not just Lena's view), or a fundamentally different capture strategy.

Two 60-minute conversations with former operations directors will answer this more reliably than any amount of engineering.

---

*Document owner: Claude / Platform Architect*
*Written: June 2026*
*Trigger: Amir's identification of Outcome Reality as a separate validation track*
*For use by: Nick (interview lead), Amir (product implication), James (model recalibration implications)*
