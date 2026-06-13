---
title: Domain Expert Validation Model
version: 1.0
status: active
date: 2026-06-12
authors: [Claude / Platform Architect]
type: strategy
trigger: pre-sprint-7-validation-review
---

# Domain Expert Validation Model

> **Purpose:** Evaluate whether Domain Experts should become a formal stakeholder category in DenkKern's validation operating model, distinct from Customers, Pilot Partners, and Data Sources.

---

## 1. Should Domain Expert Become a Formal Stakeholder Category?

Yes. And the case for it is stronger than it first appears.

The four categories currently operating in DenkKern's world serve distinct functions:

| Stakeholder | Primary function | What they can validate | What they cannot validate |
|-------------|-----------------|----------------------|--------------------------|
| **Customer** | Buy and use the product | Willingness to pay, workflow fit, UI legibility, real disruption frequency | Internal operational reality they aren't allowed to disclose |
| **Pilot Partner** | Use the product in a real context | Actual integration friction, data quality, operator behavior, genuine edge cases | Market-wide patterns, whether their situation is typical |
| **Data Source** | Provide raw signal feeds | Data availability, schema, latency, licensing | Whether the data is actionable for decisions |
| **Domain Expert** | Validate the mental model | Whether our assumptions match how this actually works | Whether they would pay for the product |

The distinction that makes Domain Expert a real category — not just a sub-type of Customer — is that **they have no commercial relationship and therefore no incentive to be polite**.

A potential customer in a demo has reasons to be generous: they want to see if the product might work for them, they do not want to offend the founder, and they are evaluating fit rather than reality. A Domain Expert who is a retired Supply Chain Director with nothing to buy or sell has none of these incentives. When they say "this doesn't work that way," they mean it. When they say "this is exactly the gap we always had," they mean that too.

There is a second, more specific reason Domain Experts are irreplaceable: **they have seen the failure modes that customers are too embarrassed to describe**. An operations manager at a prospective customer will tell you how decisions should work in their company. A former operations director who has been in 15 companies over 25 years will tell you how decisions actually work — including the 3am phone calls, the override decisions that were never documented, the supplier relationships that bypassed the formal approval process, and the 6 months of disruptions that nobody recorded because the IT system was down.

**Recommendation:** Add Domain Expert as a first-class stakeholder category with its own interview protocol, distinct from customer discovery and pilot partner onboarding.

---

## 2. What Unique Assumptions Can Only Domain Experts Validate?

The following assumptions cannot be validated by potential customers (who have a product-fit agenda), pilot partners (who have an implementation agenda), or data sources (who have a commercial agenda). They require someone who has lived inside the operational reality with no stake in what DenkKern builds.

**Assumption A — Decision frequency is high enough to justify a dedicated tool.**
DenkKern's value model assumes that a manufacturing operations team faces critical inbound disruptions regularly enough to make a purpose-built decision support system worth the cognitive overhead of a new tool. But "critical maritime disruption requiring a WAIT / REROUTE / REPLACE decision" is a specific event type. A Domain Expert can tell you: in a typical European mid-size manufacturer, how many times per year does a disruption rise to this level of urgency? Is it 3 times? 15 times? If the honest answer is 3–4 times per year, the product may need to cover a wider disruption surface to justify adoption.

**Assumption B — The three-scenario framework (WAIT / REROUTE / REPLACE) covers real decision space.**
The scenario engine is built around three choices. A Domain Expert can answer the question no customer will answer honestly: are there large categories of real decisions that don't fit this framework? "We once renegotiated the delivery timeline with the customer and waited — that's not WAIT, REPLACE, or REROUTE." "Sometimes we split the order — expedite 30% critical components, wait on the rest." If the scenario framework is structurally incomplete, the system gives confident-looking answers to incomplete questions.

**Assumption C — The approval threshold logic reflects real governance.**
DenkKern has a configurable financial threshold that triggers a second-approval gate. A Domain Expert can tell you: how does approval actually work in a manufacturing company of 500–5,000 employees? Is the threshold always financial? Are there categories of decisions (supplier switching, international freight) that require approval regardless of cost? Are there decisions that are formally escalated but the escalation is always rubber-stamped? The current model treats approval as a binary financial gate. Reality may be more complex.

**Assumption D — Operations managers want to record decision quality.**
The `decision_quality: EXCELLENT / GOOD / ACCEPTABLE / POOR` field requires Lena to self-rate her decision in hindsight. This is a product assumption about human behavior: that an operations manager will honestly assess their own decision quality, including when they made a poor one, inside a system that management may eventually see. A Domain Expert who has been an operations manager will know whether this is realistic or whether the field will always show EXCELLENT regardless of what happened.

**Assumption E — Outcome capture is possible 2 weeks post-disruption.**
The system sends a notification when the vessel arrives and asks Lena to confirm what happened. This assumes that 2 weeks after a disruption, the relevant facts are: (a) known, (b) accessible to Lena, (c) attributable to that specific disruption, and (d) within Lena's authority to record. A Domain Expert will know whether this is true. In reality, actual costs may not be booked for 6–8 weeks. Production impact may be partially attributable to the disruption and partially to other factors. The operations manager may not have access to the final cost figures — that may sit in Finance.

**Assumption F — The prediction error is something operators care about.**
The system shows `prediction_accuracy_assessment: OVERESTIMATED / ACCURATE / UNDERESTIMATED`. This assumes operators have the mental model to interpret this and find it useful. A Domain Expert can tell you whether operations managers actually think about prediction quality, or whether they think in categories: "late is late, I don't care if it was 11 days or 14 days, I care whether production stopped."

**Assumption G — Daily downtime cost is a number operators know.**
Every financial calculation in DenkKern flows from `daily_downtime_cost_eur`. The assumption is that this number exists, is reasonably accurate, and is known by the operations manager. A Domain Expert will tell you the truth: in many manufacturing companies, this number is computed by Finance once a year for insurance purposes and then never touched. The operations manager may have a rough estimate or may simply not know. If the number is wrong by 40%, every cost comparison in the system is wrong by 40%.

---

## 3. Which Current Assumptions Are Most Suitable for Domain Expert Interviews?

Ranked by: (risk to the core model if wrong) × (likelihood a customer would not tell us honestly).

**Tier 1 — Existential if wrong, customer won't volunteer it**

1. **Decision frequency** (Assumption A). If operations managers face this type of decision 2–3 times per year rather than 12–20 times, the usage model changes entirely. A customer may not know how to estimate this; a Domain Expert can give a range from direct experience.

2. **Daily downtime cost availability** (Assumption G). If this number routinely doesn't exist or is buried in Finance, the entire financial engine requires a different data entry strategy. A customer won't admit this because it makes their company look unsophisticated.

3. **Decision quality self-assessment realism** (Assumption D). If operations managers will never honestly self-rate a POOR decision in a system their manager can access, the decision quality field is cosmetic. This is impossible to test with a customer without creating an awkward situation.

**Tier 2 — Significant model risk, customer would answer partially**

4. **Scenario framework completeness** (Assumption B). A customer will answer this if asked directly ("are there decisions that don't fit WAIT / REROUTE / REPLACE?"), but they will anchor on their own experience rather than the breadth of the category. A Domain Expert has seen more variation.

5. **Actual cost timing** (Assumption E). Whether outcome capture is possible 2 weeks post-disruption depends heavily on cost booking cycles. A customer might know their own company's cycle; a Domain Expert knows the range across many companies.

**Tier 3 — Useful to validate, but less existential**

6. **Approval governance structure** (Assumption C). The current approval model is probably close enough for a pilot but may need extension later. A Domain Expert interview here is valuable for Sprint 8+, not immediately urgent.

7. **Prediction accuracy as operator signal** (Assumption F). This affects product positioning and explanation text more than the core model.

---

## 4. Distribution of 5 Conversations

If we had exactly 5 validation conversations before Sprint 7, here is how to distribute them and why.

**2 Domain Experts, 2 Customers (or Pilot Partners), 1 Data Source**

| # | Stakeholder type | Profile | Primary goal |
|---|-----------------|---------|-------------|
| 1 | **Domain Expert** | Former Supply Chain Director or Operations Director, manufacturing, 20+ years, currently independent (consultant, advisor, retired) | Validate Assumptions A, B, D, G. Challenge the mental model with no commercial filter. |
| 2 | **Domain Expert** | Former Plant Manager or Production Manager with direct experience of maritime disruptions in Northern Europe | Validate Assumption E (outcome capture timing, cost access). Get granular on what "a disruption event" actually looks like from inside a factory. |
| 3 | **Customer / Pilot Partner** | Current operations manager at a mid-size manufacturer with maritime supply dependency | Validate workflow fit, UI legibility, willingness to engage. The behavioral observation described in the sprint-6 review — specifically: will they complete outcome confirmation when handed the link. |
| 4 | **Customer / Pilot Partner** | Different company, similar profile. Focus: how they make decisions today without DenkKern, what tools they use, who is in the room. | Validate whether the problem is recognized and felt as a problem — or whether it is tolerated as part of the job. |
| 5 | **Data Source** | MarineTraffic or VesselFinder API team, or a maritime data broker who sells AIS feeds to enterprise customers | Validate data freshness, schema stability, cost, and whether the data quality assumptions in the prediction adapter are realistic. |

**The logic behind 2 Domain Experts:**

Before talking to a customer, it is important to know whether the story you are about to tell is accurate. Two Domain Expert conversations — roughly 90 minutes total — can expose gaps in the mental model that would otherwise embarrass the team in customer meetings. The cost of discovering Assumption G is wrong in front of a prospective customer is higher than the cost of discovering it in a private conversation with a retired Supply Chain Director.

**Why not 3 Domain Experts:**

After 2 conversations, the most important structural assumptions will either be confirmed or challenged. A third Domain Expert conversation has diminishing returns unless the first two produced conflicting answers. The two remaining conversations should be with people who have a commercial relationship — they will tell you things Domain Experts cannot, specifically about willingness to pay, existing budget, and internal approval dynamics.

**Why the Data Source conversation is still necessary:**

The prediction model and signal feeds are entirely mock. Before committing to Sprint 7 scope that depends on real AIS data or real weather feeds, one conversation with a maritime data provider will reveal: what the real schema looks like, what the freshness guarantees are, and what a pilot license costs. This conversation may directly change what is feasible to build in Sprint 7.

---

## 5. Interview Questions for a Domain Expert

These are questions to ask a Domain Expert that you would not — or could not — ask a potential customer.

The distinction is: a customer has a commercial relationship in mind and will answer in a way that reflects whether they think the product might work for them. A Domain Expert has no such filter and can answer from lived experience without worrying about what it implies for a potential purchase.

---

**On decision reality**

> "When a critical vessel was delayed, describe exactly how you found out, what the first hour looked like, and who was in the room when the decision was made."

This question would be intrusive to ask a prospective customer before a relationship is established. A Domain Expert will answer with institutional honesty. The answer will probably contain things the team has never modeled: a weekend call, a supplier relationship that short-circuited the formal process, a decision made before the data arrived.

> "In your experience, when was the formal decision the real decision, and when was the formal decision a ratification of something already decided informally?"

This is almost impossible to ask a customer (it implies their company's formal processes are theater). A Domain Expert who has been a director can answer freely. If the answer is "usually a ratification," the audit trail and approval gate DenkKern builds may be solving the wrong problem.

> "How often did operations managers actually know the daily production downtime cost? Where did that number come from?"

A customer won't say "we made it up" even if they did. A Domain Expert will tell you the range of what they've seen: finance-computed once a year, rough management estimate, never asked, or tracked precisely in some companies. This calibrates how much weight to put on the financial calculations.

---

**On behavior and change**

> "If a tool like this had existed when you were an operations director, under what conditions would you have actually used it — and under what conditions would it have stayed open in a browser tab you never checked?"

This is the most important question for product strategy. The answer separates "tools that are adopted" from "tools that are evaluated and then quietly abandoned." A customer in a demo will not give you this answer honestly; they have not yet formed a view on their own adoption. A Domain Expert has seen a hundred tools introduced and either adopted or abandoned.

> "Describe the last time an operations decision created a political problem inside the company. What happened, and what documentation existed?"

This surfaces the real motivation for an audit trail. It is too sensitive to ask a customer before trust is established. A Domain Expert will have examples and will be honest about what documentation existed and whether it helped or made things worse.

> "In your experience, would an operations manager self-rate a decision as POOR in a system that their VP could access? What would actually happen?"

This directly tests Assumption D. A customer might answer theoretically. A Domain Expert will answer from memory of how people actually behaved with performance data in systems above them.

---

**On the market and competitive reality**

> "What tools were operations managers actually using when a disruption happened? Not the official answer — what was actually on the screen?"

The honest answer to this is usually: a carrier tracking website, a spreadsheet, WhatsApp, and phone calls. This is valuable because it reveals the real competitive landscape — not other enterprise software, but the improvised workflows that DenkKern needs to replace. A prospective customer will name whatever formal systems they have because they have a reputation to maintain.

> "If you were advising a team building this, what is the thing they are most likely to get wrong?"

Only a Domain Expert will answer this without worrying about whether the answer sounds like they don't want to buy the product. This is the question that generates the most unexpected, useful information.

> "When you have seen similar tools fail to get adopted, what was the most common reason?"

A customer won't have perspective on this. A Domain Expert who has been in operations for 25 years has seen dozens of tools succeed and fail. The patterns they name will tell the team more about adoption risk than any user research framework.

---

**On operations reality — specific to DenkKern's model**

> "When a vessel arrived after a long delay and the disruption was resolved, did anyone go back and record what the decision cost and whether it was right? If yes, what did that look like? If no, why not?"

This directly tests the outcome capture assumption (Assumption E). A customer will tell you what their current process is. A Domain Expert will tell you whether any company they ever worked for did this reliably, and if so, what made it possible, and if not, what always got in the way.

> "When costs like expedite freight or alternative sourcing were booked, how long did it take for the actual cost to appear in the system? Who had access to that number, and when?"

This is an accounting process question. It would feel intrusive in a sales context. It is completely natural with a Domain Expert. The answer directly determines whether a 7-day token TTL for outcome confirmation is realistic, or whether 30 days would be closer to when the real numbers are available.

---

## Operating Model Recommendation

If Domain Experts are added as a formal stakeholder category, the operating model should reflect the difference in relationship and purpose:

**Sourcing:** LinkedIn, former-colleagues network, industry associations (VDA, VDMA, BVL in Germany/Europe). Former directors are often reachable directly. No NDA needed for these conversations — ask them not to share proprietary details, but DenkKern should share its product vision freely. The value flows both ways.

**Format:** 60 minutes, unstructured conversation anchored on their experience, not a product demo. Show the product at the end, not the beginning. If you show the product first, they will answer about the product. If you talk about their experience first, they will answer about reality.

**Incentive:** No payment needed for early conversations. The offer is: "We will share what we learn across all conversations and give you a view of the market patterns we observe." Former directors find this interesting. Nick should lead these conversations — he has the commercial vocabulary to build trust quickly with senior operations people.

**Output format:** Each conversation produces a structured observation note: confirmed assumptions, challenged assumptions, new information that wasn't in the model, direct quotes. These notes accumulate into a validation corpus that becomes the factual basis for Sprint 7 prioritization.

**Relationship cadence:** Domain Experts who are generous in early conversations can become informal advisors. One or two of them, offered a small equity stake or advisory fee after 3–4 conversations, could provide ongoing reality-checking throughout the first year. This is standard practice in B2B enterprise product development and has a significantly higher ROI than most early hires.

---

## Summary

Domain Experts are not customers and should not be treated as a pipeline. They are a calibration instrument. Their function is to stress-test the mental model before it is presented to people with a commercial stake in the answer.

The three things only Domain Experts can provide:
1. **Honest frequency data** — how often this type of decision actually occurs in practice
2. **Behavioral truth** — how operations managers actually behave (vs. how they say they should behave)
3. **Failure mode inventory** — what has killed similar tools in the past, from direct experience

At the current stage — one synthetic case, zero real customers, zero outcomes from real disruptions — two Domain Expert conversations are probably worth more than two customer demos. The customer demos will go better if the mental model has been calibrated first.

---

*Document owner: Claude / Platform Architect*
*Written: June 2026, pre-Sprint 7*
*Trigger: Amir's observation that Domain Experts represent a missing validation layer*
