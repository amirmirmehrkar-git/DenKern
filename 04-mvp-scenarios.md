---
title: MVP Scenarios
type: note
project: DenkKern
status: active
tags:
  - denkkern
  - scenarios
  - mvp
---

# MVP Scenarios

The MVP compares three disruption response scenarios.

## 1. Wait For Shipment

The company waits for the original shipment to arrive.

This scenario is likely cheapest operationally, but may create large production losses if the delay materializes.

## 2. Expedite From Intermediate Port

The company intervenes in the logistics chain and expedites the shipment from an intermediate port.

This likely adds logistics cost but may reduce delay exposure.

Versioned details:

- Version 1: Expedite from an unspecified intermediate port.
- Version 2: Pivot by unloading the cargo in Porto and using a freight forwarder.
- Interface variant: The interface may also check freight-forwarding costs and arrival times from Amsterdam via API.

The Porto and Amsterdam details should both remain until the team decides whether the demo uses Porto as the pivot port, Amsterdam as the freight-forwarding check, or both as separate branches.

## 3. Order Replacement Parts

The company orders replacement marine-quality bolts from another supplier or source.

This may be expensive, but could be justified if cost-of-delay is high and the original shipment risk is severe.

Golden narrative detail: Lena can reorder from a shop or warehouse in Poland. The replacement order is more expensive and arrives on the 16th.

## Scenario Engine Requirement

The scenario engine should not merely list options. It should rank them using:

- Delay probability.
- Confidence / uncertainty.
- Cost of delay.
- Direct action cost.
- Time saved.
- Operational feasibility.
- Financial impact.

## MVP-Friendliness

The three scenarios are intentionally simple enough for the MVP:

- Wait: very low complexity, very realistic.
- Expedite: medium complexity, realistic.
- Reorder: low-to-medium complexity, extremely realistic.

They are understandable, explainable, demoable, and financially comparable without requiring full autonomous orchestration.
