---
type: decision
status: draft
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Scenario Comparison UI (Control Tower Table)

Source: Amir provided a chat excerpt: canonical five scenarios plus a control-tower-grade scenario comparison table and side-panel interaction model.

## The 5 Canonical Decision Scenarios

These are described as enterprise-grade options that logistics managers evaluate in disruptions. They are intended to be used as-is in UI, scenario tables, and decision logic.

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

Why managers choose it: balances speed and risk without changing main sea route.

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

Description: cancel, rebook, or switch supplier / shipment entirely.

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

## How These Map To The UI

Each scenario feeds the same evaluation columns:

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

## Scenario Comparison Table (Primary UI)

Layout: one row per scenario.

Columns:

- Scenario
- Time impact (P50 / P90)
- Cost (min / likely / max)
- Legal risk
- Notice urgency
- Operational risk
- Confidence
- Overall score

Example table:

| Scenario | Time Impact (P50 / P90) | Cost (Min / Likely / Max) | Legal Risk | Notice Urgency | Operational Risk | Confidence | Overall Score |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| Wait & Hold | 4d / 9d | 15k / 35k / 80k | MED | 24h | MED | 0.72 | 68 |
| Reroute - Sea | 10d / 16d | 90k / 140k / 220k | HIGH | 12h | MED | 0.81 | 61 |
| Alt Port + Inland | 6d / 11d | 70k / 110k / 160k | MED | 24h | MED | 0.77 | 74 |
| Partial Expedite | 1d / 3d | 180k / 260k / 400k | HIGH | 6h | HIGH | 0.65 | 59 |
| Cancel / Rebook | 14d / 30d | 120k / 210k / 350k | CRITICAL | 48h | HIGH | 0.54 | 42 |

Default sort: overall weighted score, descending.

## Row Interaction (Key UX Behavior)

Clicking a scenario row opens a side panel, not a new page.

### Side Panel Content

Header:

- Scenario name
- Overall score
- Confidence score (explicitly labeled: model confidence, not recommendation)

Body:

- Why this option exists (use "why managers choose it")
- Key assumptions
- Trade-offs
- Failure modes
- Required actions (example: issue notice within 24h)

Decision CTAs:

- Mark as selected
- Request legal review
- Export decision brief (PDF)

## Visual Encoding (Subtle, Non-Prescriptive)

- Legal risk: text + icon, avoid alarming red unless CRITICAL.
- Confidence score: thin progress bar (grey -> blue).
- Notice urgency: countdown style (example: "12h remaining").
- Overall score: bold number only, avoid green/red judgments.

## Why This UI Works In Real Orgs

- Mirrors how decisions are discussed in war rooms.
- Makes legal and ops visible before selection.
- Supports audit trails (for example: why did you not reroute?).
- Avoids "AI made the call" anxiety.
- Fully honors: ranking + explanation, human decides.

