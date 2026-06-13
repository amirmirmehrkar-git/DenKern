---
type: decision
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Canonical Decision Scenarios (V2) + Production Tightening

Source: Amir provided a chat excerpt that validates and tightens the five canonical decision scenarios for an IDSS.

## Validation Summary

This option set is described as enterprise-grade because:

- Complete but minimal: all real decisions fit into one of the five; no overlap, no gaps.
- Mode-agnostic: structure generalizes beyond maritime (rail/road/intermodal).
- Defensible: each option has a rational reason to choose it (audit trails and post-mortems).
- Human-in-the-loop by design: ranking + explanation, not automation.

One-liner pitch:

> Our system doesn’t invent options — it structures the five decisions logistics managers already make, and makes them defensible.

## Subtle Production Upgrades (Small, High Impact)

### 1) Make "Wait & Hold" explicitly active

Internal rename (not necessarily UI):

- Wait & Hold -> Controlled Hold

Rationale: signals managed mitigation rather than negligence in later disputes.

### 2) Normalize legal + notice as first-class signals

Split:

- Legal risk: likelihood of claim / breach
- Notice urgency: expressed in hours (for example 4h / 24h / 72h), not just LOW/MED/HIGH labels

Rationale: managers feel notice pressure more than abstract legal risk.

### 3) Define confidence as model humility

Suggested definition:

- Confidence score = similarity to past resolved disruptions

Rationale: explainable, non-threatening, and avoids implying "perfect prediction".

## System Wiring (At A Glance)

```text
Trigger -> Scenario generation -> Scoring -> Ranked table -> Explanation panel
```

Each scenario instance should carry:

- Assumptions (example: weather clears in <= 72h)
- What must be true for it to work
- What breaks if the assumption fails

This is what makes the output feel senior rather than "AI-ish".

## The 5 Canonical Decision Scenarios

### 1) Wait & Hold

Description: pause movement and wait for the disruption to resolve (port reopens, weather clears, security improves).

Typical triggers:

- Port closure due to weather
- Temporary navigation restriction
- No viable reroute once cargo is loaded

Key factors:

- Time: unknown / variable delay
- Cost: demurrage, detention, storage
- Legal: delay notice likely; force majeure may apply
- Risk: cargo degradation, SLA breach

Why managers choose it: lowest immediate cost, preserves original contract route.

### 2) Reroute (Same Mode - Sea)

Description: change maritime route to avoid the affected area (example: Cape of Good Hope instead of Suez).

Typical triggers:

- Geopolitical conflict
- War-risk zones
- Canal or strait disruption

Key factors:

- Time: plus 7-14 days typical
- Cost: fuel, crew, war-risk insurance
- Legal: deviation clause plus notice obligations
- Risk: insurance coverage, sanctions exposure

Why managers choose it: reduces security risk while keeping shipment intact.

### 3) Alternative Port + Inland Transport

Description: discharge at a different port (example: Rotterdam/Antwerp) and complete delivery via rail or truck.

Typical triggers:

- Destination port congestion
- Weather shutdowns
- Labor strikes

Key factors:

- Time: often faster than waiting
- Cost: port handling plus inland transport
- Legal: destination change approval; cost allocation
- Risk: capacity constraints, customs friction

Why managers choose it: balances speed and risk without changing the main sea route.

### 4) Partial Expedite (Split Shipment / Airfreight)

Description: send critical cargo by air while the rest continues by sea.

Typical triggers:

- Risk of production line stop
- High-value or time-sensitive items
- Customer penalties for late delivery

Key factors:

- Time: fast for critical items
- Cost: very high (airfreight)
- Legal: cargo substitution permissions; insurance
- Risk: export controls, capacity limits

Why managers choose it: prevents catastrophic business impact (line stop).

### 5) Cancel / Rebook / Substitute

Description: cancel, rebook, or switch supplier/shipment entirely.

Typical triggers:

- Long-term disruption
- Severe geopolitical escalation
- Contractual exit clauses available

Key factors:

- Time: variable
- Cost: cancellation fees, higher rebooking rates
- Legal: termination clauses; breach risk
- Risk: supplier reliability, market availability

Why managers choose it: last-resort option when disruption is structural, not temporary.

## UI Mapping Columns

Each scenario should feed the same evaluation columns:

- Time impact (P50 / P90 days)
- Estimated cost (min / likely / max)
- Legal risk (LOW / MED / HIGH / CRITICAL)
- Notice urgency
- Operational risk
- Confidence score
- Overall weighted score

Principle:

- No decision is made automatically.
- The system ranks and explains; the manager decides.

## Next Artifacts (Pick One)

1. JSON schema for all five scenarios (API + LLM prompt grounding)
2. n8n flow: disruption input -> scenario scoring -> Slack/Email briefing
3. Scenario comparison UI table (control tower style)
4. Scoring logic: weighting time vs cost vs legal across cargo profiles

Status update:

- JSON schema drafted in `32-canonical-scenario-json-schema.md`.
