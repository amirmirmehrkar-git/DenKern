---
title: Golden Narrative Case
type: narrative
project: DenkKern
status: active
tags:
  - denkkern
  - golden-case
  - lena
  - demo
---

# Golden Narrative Case

This is the reference case for DenkKern's current MVP.

Source: Amir provided the scenario text and AI synthesis. It should be treated as the active demo narrative unless replaced by a newer version.

## Scenario: Manufacturing Issue

Lena works for a shipbuilding firm in Hamburg. She is concerned that marine-quality bolts will not arrive on time because of a maritime disruption. The shipping company says the parts will arrive on the 15th, but Lena worries that the disruption will delay them.

Every delayed day costs the firm EUR 150k in lost production.

The ship is currently off the southern coast of Spain, with expected stops in Porto, London, and Amsterdam. There is also possible traffic in Amsterdam and a strike in Hamburg.

## Versioned Disruption Geography

- Version 1: The concern is based on a disruption off the coast of France.
- Version 2: The expected disruption occurs off the coast of Spain.

Keep both versions until the team resolves the final demo geography.

## Options: Wait, Pivot, Reorder

1. Wait and hope the delay is not too long.
2. Pivot by unloading the cargo in Porto and using a freight forwarder.
3. Reorder from a shop or warehouse in Poland. This is more expensive and arrives on the 16th.

## Solution Method

DenkKern alerts Lena when it identifies a possible disruption and shows a dashboard with easily digestible costs and benefits.

The product helps Lena compare options using:

- ETA / delay probability.
- Financial exposure.
- Mitigation paths.
- Scenario timelines.
- Expected cost.
- Recommendation ranking.

## Solution Data

The platform uses a statistical model that observes the target vessel and other vessels in the same shipping lane. When a shipping incident is detected, the model assumes at least part of the journey will occur under disruption conditions.

A port-condition agent monitors port conditions. The model combines expected travel time and expected port time into a probabilistic ETA scenario.

## Technical Note: Amir

The model should output JSON containing expected transit time and optimistic / pessimistic outcome intervals.

Example delay distribution:

- 5 percent chance of 3 days late.
- 20 percent chance of 4 days late.
- 50 percent chance of 5 days late.
- 20 percent chance of 6 days late.
- 5 percent chance of 7 or more days late.

Expected losses:

```text
sum(probability_of_delay * delay_days * daily_loss)
```

For the Lena case, daily loss is currently EUR 150k. Amir noted that this number can be changed if it is not viable.

## Interface

Lena checks her laptop and sees the three scenarios:

- Expected arrival time and likelihood of earlier / later arrivals.
- Cost and arrival time for freight forwarding.
- Cost of replacement parts, theoretically drawn from the firm's own data.
- Timeline-linked scenario comparison.
- Expected cost per scenario using EUR 150k of lost production per day.

Versioned interface note:

- Scenario text says pivot from Porto.
- Interface text mentions freight forwarding from Amsterdam.

Both should be preserved until the demo flow decides whether Porto and Amsterdam are two separate logistics decision points or one needs to be corrected.

## Outcome

Lena orders a week's worth of replacement parts from Poland. The parts arrive on the 16th, only one day behind schedule. The ship arrives on the 20th.

The firm loses one day of production instead of a larger delay window, saving roughly EUR 450k minus emergency shipment and replacement costs.

## Strategic Role

This case functions as:

- Demo story.
- Product narrative.
- Investor story.
- MVP validation scenario.
- UX anchor.
- Technical contract example.
- Pricing conversation starter.
- Pilot discussion use case.
