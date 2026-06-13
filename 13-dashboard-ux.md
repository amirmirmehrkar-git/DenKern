---
title: Dashboard UX
type: ux
project: DenkKern
status: active
tags:
  - denkkern
  - dashboard
  - ux
  - mvp
---

# Dashboard UX

The MVP dashboard should help Lena move from disruption awareness to a decision-ready comparison.

It should not feel like a tracking dashboard. It should answer:

> What operational decision minimizes business loss right now?

## Core Dashboard Elements

Lena should see:

- Shipment status.
- Expected arrival time.
- Optimistic / pessimistic arrival window.
- Disruption explanation.
- Scenario cards.
- Financial comparison.
- Recommended action.
- Confidence / risk explanation.
- Timeline view.

## Scenario Card Requirements

Each scenario should show:

- Expected delay.
- Action cost.
- Production loss.
- Total expected cost.
- Risk level.
- Reasoning.

## Example Scenario Output

| Option | Delay | Total Cost | Risk |
| --- | ---: | ---: | --- |
| Wait | 5 days | EUR 750k | High |
| Expedite | 2 days | EUR 500k | Medium |
| Replacement Parts | 1 day | EUR 300k + emergency cost | Low |

Recommended action:

```text
Order replacement parts from Poland.
```

Reason:

```text
It reduces production downtime and avoids the worst-case delay from the maritime shipment.
```

## UX Principle

The interface should make the recommendation legible, but it should not imply automatic execution.

The system ranks and explains. The human operator decides.

## Reference Wireframe

The concrete Lena decision screen wireframe is captured in `48-lena-decision-screen-wireframe.md`.

The buildable UI design spec version is captured in `49-lena-decision-screen-ui-spec.md`.
