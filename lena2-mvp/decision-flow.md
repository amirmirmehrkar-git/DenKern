---
type: decision
status: active
created: 2026-05-18
updated: 2026-05-17
related: []
tags: 
project: lena-2.0
---

# Decision Flow

The main DenkKern product flow is:

```text
Delayed shipment
-> operational risk
-> ETA / delay prediction
-> decision scenarios
-> financial impact
-> recommendation / ranking
-> human decision
-> production saved
```

## System Goal

The system should translate a logistics disruption into a decision-ready operational view.

The dashboard should make clear:

- What is likely to happen.
- How uncertain the prediction is.
- Which operational options exist.
- What each option costs.
- What each option saves or risks.
- Which option is recommended and why.

## Human Decision

The final decision remains with the operator. DenkKern should support auditability by preserving the available options, recommendation logic, assumptions, and chosen action.

## Reference Walkthrough

The golden Lena walkthrough should be the first deterministic demo flow:

```text
Alert about possible disruption
-> Lena opens dashboard
-> sees delay distribution and confidence
-> compares Wait / Pivot / Reorder
-> sees expected financial impact
-> chooses replacement parts from Poland
-> audit trail records decision and assumptions
-> production loss is reduced
```

This flow should be polished before adding broader platform behavior.

## Best MVP Success Metric

The best MVP success metric is not MAU, dashboard usage, or AI accuracy alone.

The better question is:

```text
Did the customer make a faster and financially better disruption decision?
```
